"use server";

import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

/**
 * Returns all batches currently in stock, grouped with supplier and product info.
 * Only shows batches where quantityRemaining > 0.
 */
export async function getAvailableStockByBatch() {
  try {
    const batches = await prisma.batch.findMany({
      where: { quantityRemaining: { gt: 0 } },
      include: {
        product: true,
        supplier: true,
        importInvoiceLine: {
          include: {
            importInvoice: true,
            serialNumbers: {
              where: { isSold: false, isReturned: false },
            },
          },
        },
      },
      orderBy: { entryDate: "asc" },
    });
    return { success: true, batches };
  } catch (error) {
    console.error("getAvailableStockByBatch error:", error);
    return { success: false, message: "Failed to fetch stock." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS SUPPLIER RETURN (atomic 3-way sync)
// ─────────────────────────────────────────────────────────────────────────────

const ReturnSchema = z.object({
  importInvoiceLineId: z.string().min(1, "Batch reference is required"),
  quantityReturned: z.number().int().positive("Quantity must be a positive integer"),
  returnedSerials: z.array(z.string().trim().min(1)).optional().default([]),
});

export async function processReturn(data) {
  try {
    const parsed = ReturnSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    const { importInvoiceLineId, quantityReturned, returnedSerials } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // Fetch the invoice line and its related data
      const line = await tx.importInvoiceLine.findUnique({
        where: { id: importInvoiceLineId },
        include: {
          importInvoice: true,
          batch: true,
          serialNumbers: { where: { isSold: false, isReturned: false } },
        },
      });

      if (!line) throw new Error("Invoice line / batch not found.");
      if (!line.batch) throw new Error("No active batch found for this invoice line.");

      const invoice = line.importInvoice;
      const batch = line.batch;
      const purchasePrice = parseFloat(line.purchasePrice);

      // Validate return quantity does not exceed available stock
      if (quantityReturned > batch.quantityRemaining) {
        throw new Error(
          `Cannot return ${quantityReturned} units. Only ${batch.quantityRemaining} remaining in this batch.`
        );
      }

      // Validate serial numbers if serialised batch
      if (line.isSerialised) {
        if (returnedSerials.length !== quantityReturned) {
          throw new Error(
            `Expected ${quantityReturned} serial numbers for serialised return but received ${returnedSerials.length}.`
          );
        }

        const availableSerials = line.serialNumbers.map((s) => s.serial);
        for (const sn of returnedSerials) {
          if (!availableSerials.includes(sn)) {
            throw new Error(`Serial number "${sn}" is not available in this batch.`);
          }
        }

        // Mark returned serials as returned
        await tx.serialNumber.updateMany({
          where: { serial: { in: returnedSerials }, importInvoiceLineId },
          data: { isReturned: true },
        });
      }

      // 1. Deduct from Batch
      await tx.batch.update({
        where: { id: batch.id },
        data: { quantityRemaining: { decrement: quantityReturned } },
      });

      // 2. Deduct from Product stock
      await tx.product.update({
        where: { id: line.productId },
        data: { stockBalance: { decrement: quantityReturned } },
      });

      // 3. Calculate cost of returned goods
      const costDeducted = purchasePrice * quantityReturned;

      // 4. Update ImportInvoice totals (bypasses row lock as per spec)
      const oldInvoiceTotal = parseFloat(invoice.totalAmount);
      const oldDebt = parseFloat(invoice.debtBalance);
      const newInvoiceTotal = Math.max(0, oldInvoiceTotal - costDeducted);
      const amountPaid = parseFloat(invoice.amountPaid);
      const newDebt = Math.max(0, newInvoiceTotal - amountPaid);

      let newStatus = "UNPAID";
      if (newDebt === 0 && newInvoiceTotal > 0) newStatus = "PAID";
      else if (amountPaid > 0 && newDebt > 0) newStatus = "PARTIAL";

      await tx.importInvoice.update({
        where: { id: invoice.id },
        data: {
          totalAmount: newInvoiceTotal,
          debtBalance: newDebt,
          status: newStatus,
        },
      });

      // 5. Decrement Supplier totalDebt by the same cost (delta based on debt change)
      const debtDelta = newDebt - oldDebt; // will be negative (reduction)
      if (debtDelta !== 0) {
        await tx.supplier.update({
          where: { id: invoice.supplierId },
          data: { totalDebt: { increment: debtDelta } },
        });
      }

      // 6. Create SupplierReturn audit record
      const supplierReturn = await tx.supplierReturn.create({
        data: {
          supplierId: invoice.supplierId,
          importInvoiceLineId,
          quantityReturned,
          returnedSerials,
          costDeducted,
        },
      });

      return { supplierReturn, costDeducted, newInvoiceTotal, newDebt };
    });

    return {
      success: true,
      message: `Return processed. $${result.costDeducted.toFixed(2)} deducted from invoice and supplier debt.`,
      result,
    };
  } catch (error) {
    console.error("processReturn error:", error);
    return { success: false, message: error.message || "Failed to process return." };
  }
}

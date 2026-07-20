"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Race-condition-safe sales invoice number generator.
 * Format: SAL-{YYYY}-{0001}
 */
async function generateSalesInvoiceNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `SAL-${year}-`;
  const count = await tx.salesInvoice.count({
    where: { invoiceNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/**
 * Recalculate SalesInvoice totals from its lines + delivery cost.
 * Must be called inside a transaction.
 * Returns the new totals and handles customer debt delta sync.
 */
async function recalculateSalesInvoiceTotals(tx, invoiceId) {
  const invoice = await tx.salesInvoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true },
  });
  if (!invoice) throw new Error("Sales invoice not found during recalculation.");

  const linesTotal = invoice.lines.reduce(
    (sum, l) => sum + parseFloat(l.sellingPrice) * l.quantity,
    0
  );
  const totalAmount = linesTotal + parseFloat(invoice.deliveryCost);
  const amountPaid = parseFloat(invoice.amountPaid);
  const debtBalance = Math.max(0, totalAmount - amountPaid);

  let status = "UNPAID";
  if (debtBalance === 0 && totalAmount > 0) status = "PAID";
  else if (amountPaid > 0 && debtBalance > 0) status = "PARTIAL";

  await tx.salesInvoice.update({
    where: { id: invoiceId },
    data: { totalAmount, debtBalance, status },
  });

  return { totalAmount, debtBalance, status };
}

/**
 * Zero-State Unlock Trigger:
 * If the total sold quantity for a given batch drops to 0,
 * unlock the isLocked flag on the ImportInvoiceLine, restoring editability.
 */
async function checkAndUnlockBatchRow(tx, batchId) {
  const batch = await tx.batch.findUnique({
    where: { id: batchId },
    include: { importInvoiceLine: true },
  });
  if (!batch || !batch.importInvoiceLine) return;

  // Sum all sales line quantities for this batch
  const salesLinesQty = await tx.salesInvoiceLine.aggregate({
    where: { batchId },
    _sum: { quantity: true },
  });
  // Sum all quick sale quantities for this batch
  const quickSalesQty = await tx.quickSale.aggregate({
    where: { batchId, isReturned: false },
    _sum: { quantity: true },
  });

  const totalSold = (salesLinesQty._sum.quantity || 0) + (quickSalesQty._sum.quantity || 0);

  if (totalSold === 0) {
    // Restore editability on the import invoice line
    await tx.importInvoiceLine.update({
      where: { id: batch.importInvoiceLineId },
      data: { isLocked: false, quantitySold: 0 },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE SALES INVOICE HEADER
// ─────────────────────────────────────────────────────────────────────────────

const CreateSalesInvoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
});

export async function createSalesInvoice(formData) {
  try {
    const raw = {
      customerId: formData.get("customerId"),
      invoiceDate: formData.get("invoiceDate"),
    };
    const parsed = CreateSalesInvoiceSchema.safeParse(raw);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await generateSalesInvoiceNumber(tx);
      return tx.salesInvoice.create({
        data: {
          invoiceNumber,
          customerId: parsed.data.customerId,
          invoiceDate: new Date(parsed.data.invoiceDate),
          isHeaderLocked: false,
        },
      });
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Sales invoice created.", invoice };
  } catch (error) {
    console.error("createSalesInvoice error:", error);
    return { success: false, message: error.message || "Failed to create sales invoice." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCK SALES INVOICE HEADER
// ─────────────────────────────────────────────────────────────────────────────

export async function lockSalesInvoiceHeader(invoiceId) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new Error("Invoice not found.");
      if (invoice.isHeaderLocked) return { alreadyLocked: true };

      await tx.salesInvoice.update({
        where: { id: invoiceId },
        data: { isHeaderLocked: true },
      });
      return { alreadyLocked: false };
    });

    revalidatePath("/", "layout");
    return { success: true, ...result };
  } catch (error) {
    return { success: false, message: error.message || "Failed to lock header." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD LINE TO SALES INVOICE
// ─────────────────────────────────────────────────────────────────────────────

const AddSalesLineSchema = z.object({
  salesInvoiceId: z.string().min(1),
  batchId: z.string().min(1, "Batch is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  sellingPrice: z.number().positive("Selling price must be positive"),
  soldSerials: z.array(z.string().trim().min(1)).optional().default([]),
});

export async function addLineToSalesInvoice(data) {
  try {
    const parsed = AddSalesLineSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    const { salesInvoiceId, batchId, quantity, sellingPrice, soldSerials } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // Verify batch has enough stock
      const batch = await tx.batch.findUnique({ where: { id: batchId } });
      if (!batch) throw new Error("Batch not found.");
      if (batch.quantityRemaining < quantity) {
        throw new Error(
          `Insufficient stock. Only ${batch.quantityRemaining} unit(s) remaining in this batch.`
        );
      }

      // Serialised batch: validate SNs
      const line_isSerialised = batch.importInvoiceLine
        ? (await tx.importInvoiceLine.findUnique({ where: { id: batch.importInvoiceLineId } }))?.isSerialised
        : false;

      if (line_isSerialised) {
        if (soldSerials.length !== quantity) {
          throw new Error(`Expected ${quantity} serial number(s) but got ${soldSerials.length}.`);
        }
        // Verify each SN is available (not sold)
        const snRecords = await tx.serialNumber.findMany({
          where: { serial: { in: soldSerials }, importInvoiceLineId: batch.importInvoiceLineId },
        });
        for (const sn of snRecords) {
          if (sn.isSold || sn.isReturned) {
            throw new Error(`Serial number "${sn.serial}" is no longer available.`);
          }
        }
        // Mark SNs as sold
        await tx.serialNumber.updateMany({
          where: { serial: { in: soldSerials } },
          data: { isSold: true },
        });
      }

      // Deduct from Batch
      await tx.batch.update({
        where: { id: batchId },
        data: { quantityRemaining: { decrement: quantity } },
      });

      // Decrement product stock balance
      await tx.product.update({
        where: { id: batch.productId },
        data: { stockBalance: { decrement: quantity } },
      });

      // Update ImportInvoiceLine quantitySold and lock status
      await tx.importInvoiceLine.update({
        where: { id: batch.importInvoiceLineId },
        data: {
          quantitySold: { increment: quantity },
          isLocked: true,
        },
      });

      // Create the sales invoice line (purchasePriceSnapshot hidden from UI)
      const line = await tx.salesInvoiceLine.create({
        data: {
          salesInvoiceId,
          batchId,
          quantity,
          sellingPrice,
          purchasePriceSnapshot: batch.purchasePrice,
          soldSerials: soldSerials,
        },
      });

      // Recalculate invoice totals
      const oldDebt = await tx.salesInvoice
        .findUnique({ where: { id: salesInvoiceId } })
        .then((i) => parseFloat(i?.debtBalance ?? 0));

      const newTotals = await recalculateSalesInvoiceTotals(tx, salesInvoiceId);

      // Sync customer debt delta
      const debtDelta = newTotals.debtBalance - oldDebt;
      if (debtDelta !== 0) {
        const inv = await tx.salesInvoice.findUnique({ where: { id: salesInvoiceId } });
        await tx.customer.update({
          where: { id: inv.customerId },
          data: { totalDebt: { increment: debtDelta } },
        });
      }

      return { line, newTotals };
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Line added to invoice.", ...result };
  } catch (error) {
    console.error("addLineToSalesInvoice error:", error);
    return { success: false, message: error.message || "Failed to add line." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE SALES INVOICE LINE (qty change / return via reduction)
// ─────────────────────────────────────────────────────────────────────────────

const UpdateSalesLineSchema = z.object({
  lineId: z.string().min(1),
  quantity: z.number().int().min(0),
  sellingPrice: z.number().positive(),
  soldSerials: z.array(z.string()).optional().default([]),
});

export async function updateSalesInvoiceLine(data) {
  try {
    const parsed = UpdateSalesLineSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    const { lineId, quantity, sellingPrice, soldSerials } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const line = await tx.salesInvoiceLine.findUnique({
        where: { id: lineId },
        include: { salesInvoice: true, batch: { include: { importInvoiceLine: true } } },
      });
      if (!line) throw new Error("Sales invoice line not found.");

      const oldQty = line.quantity;
      const delta = quantity - oldQty; // negative = return, positive = addition
      const batch = line.batch;

      if (delta > 0) {
        // ADDING — stock guardrail
        if (batch.quantityRemaining < delta) {
          throw new Error(
            `Cannot add ${delta} more unit(s). Only ${batch.quantityRemaining} remaining in batch.`
          );
        }
      }

      // Handle serial numbers for delta
      if (batch.importInvoiceLine?.isSerialised && delta !== 0) {
        if (delta < 0) {
          // Returning serials — mark them as not sold
          const returningSerials = line.soldSerials.slice(0, Math.abs(delta));
          await tx.serialNumber.updateMany({
            where: { serial: { in: returningSerials } },
            data: { isSold: false },
          });
        } else if (delta > 0) {
          if (soldSerials.length !== delta) {
            throw new Error(`Need ${delta} new serial number(s) for addition.`);
          }
          await tx.serialNumber.updateMany({
            where: { serial: { in: soldSerials } },
            data: { isSold: true },
          });
        }
      }

      // Sync batch stock
      await tx.batch.update({
        where: { id: batch.id },
        data: { quantityRemaining: { decrement: delta } },
      });

      // Sync product stock balance
      await tx.product.update({
        where: { id: batch.productId },
        data: { stockBalance: { decrement: delta } },
      });

      // Sync ImportInvoiceLine quantitySold
      await tx.importInvoiceLine.update({
        where: { id: batch.importInvoiceLineId },
        data: { quantitySold: { increment: delta } },
      });

      // Update the sales invoice line
      const newSoldSerials =
        batch.importInvoiceLine?.isSerialised && delta < 0
          ? line.soldSerials.slice(Math.abs(delta)) // remove returned serials from front
          : [...line.soldSerials, ...soldSerials];

      await tx.salesInvoiceLine.update({
        where: { id: lineId },
        data: { quantity, sellingPrice, soldSerials: newSoldSerials },
      });

      // Recalculate totals + sync customer debt delta
      const oldDebt = parseFloat(line.salesInvoice.debtBalance);
      const newTotals = await recalculateSalesInvoiceTotals(tx, line.salesInvoiceId);
      const debtDelta = newTotals.debtBalance - oldDebt;

      if (debtDelta !== 0) {
        await tx.customer.update({
          where: { id: line.salesInvoice.customerId },
          data: { totalDebt: { increment: debtDelta } },
        });
      }

      // Zero-State Unlock Trigger (if reduction brings batch sold qty to 0)
      if (delta < 0) {
        await checkAndUnlockBatchRow(tx, batch.id);
      }

      return { newTotals };
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Line updated.", ...result };
  } catch (error) {
    console.error("updateSalesInvoiceLine error:", error);
    return { success: false, message: error.message || "Failed to update line." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE SALES INVOICE LINE (full return)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteSalesInvoiceLine(lineId) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const line = await tx.salesInvoiceLine.findUnique({
        where: { id: lineId },
        include: { salesInvoice: true, batch: { include: { importInvoiceLine: true } } },
      });
      if (!line) throw new Error("Line not found.");

      const { quantity, batchId, batch, soldSerials } = line;

      // Restore serial numbers
      if (soldSerials.length > 0) {
        await tx.serialNumber.updateMany({
          where: { serial: { in: soldSerials } },
          data: { isSold: false },
        });
      }

      // Restore batch stock
      await tx.batch.update({
        where: { id: batchId },
        data: { quantityRemaining: { increment: quantity } },
      });

      // Restore product stock
      await tx.product.update({
        where: { id: batch.productId },
        data: { stockBalance: { increment: quantity } },
      });

      // Decrement ImportInvoiceLine quantitySold
      await tx.importInvoiceLine.update({
        where: { id: batch.importInvoiceLineId },
        data: { quantitySold: { decrement: quantity } },
      });

      // Delete the line
      await tx.salesInvoiceLine.delete({ where: { id: lineId } });

      // Recalculate totals + customer debt delta
      const oldDebt = parseFloat(line.salesInvoice.debtBalance);
      const newTotals = await recalculateSalesInvoiceTotals(tx, line.salesInvoiceId);
      const debtDelta = newTotals.debtBalance - oldDebt;

      if (debtDelta !== 0) {
        await tx.customer.update({
          where: { id: line.salesInvoice.customerId },
          data: { totalDebt: { increment: debtDelta } },
        });
      }

      // Zero-State Unlock Trigger
      await checkAndUnlockBatchRow(tx, batchId);

      return { newTotals };
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Line deleted and stock restored.", ...result };
  } catch (error) {
    console.error("deleteSalesInvoiceLine error:", error);
    return { success: false, message: error.message || "Failed to delete line." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE INVOICE FOOTER (delivery cost + amount paid — COD workflow)
// ─────────────────────────────────────────────────────────────────────────────

const UpdateSalesFooterSchema = z.object({
  invoiceId: z.string().min(1),
  deliveryCost: z.number().min(0),
  amountPaid: z.number().min(0),
});

export async function updateSalesInvoiceFooter(data) {
  try {
    const parsed = UpdateSalesFooterSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    const { invoiceId, deliveryCost, amountPaid } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findUnique({
        where: { id: invoiceId },
        include: { lines: true },
      });
      if (!invoice) throw new Error("Invoice not found.");

      // Guardrail: compute projected total BEFORE writing anything
      const linesSubtotal = invoice.lines.reduce(
        (sum, l) => sum + parseFloat(l.sellingPrice) * l.quantity,
        0
      );
      const projectedTotal = linesSubtotal + deliveryCost;
      if (amountPaid > projectedTotal) {
        throw new Error("Paid amount cannot exceed the total invoice value.");
      }

      const oldDebt = parseFloat(invoice.debtBalance);

      await tx.salesInvoice.update({
        where: { id: invoiceId },
        data: { deliveryCost, amountPaid },
      });

      const newTotals = await recalculateSalesInvoiceTotals(tx, invoiceId);
      const debtDelta = newTotals.debtBalance - oldDebt;

      // Sync customer debt (COD workflow — absorb the delta)
      if (debtDelta !== 0) {
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: { totalDebt: { increment: debtDelta } },
        });
      }

      return { newTotals };
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Invoice amounts saved. Customer debt updated.", ...result };
  } catch (error) {
    console.error("updateSalesInvoiceFooter error:", error);
    return { success: false, message: error.message || "Failed to update footer." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ / SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export async function getSalesInvoices() {
  try {
    const invoices = await prisma.salesInvoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    });
    return { success: true, invoices };
  } catch (error) {
    return { success: false, message: "Failed to fetch sales invoices." };
  }
}

export async function getSalesInvoiceById(id) {
  try {
    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: {
          include: {
            // Only expose retail price and remaining qty — NOT purchasePriceSnapshot
            batch: {
              select: {
                id: true,
                quantityRemaining: true,
                retailPrice: true,
                importInvoiceLineId: true,
                importInvoiceLine: { select: { isSerialised: true } },
                product: { select: { id: true, name: true } },
                supplier: { select: { name: true } },
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!invoice) return { success: false, message: "Sales invoice not found." };
    return { success: true, invoice };
  } catch (error) {
    return { success: false, message: "Failed to fetch invoice." };
  }
}

export async function searchSalesInvoices(query) {
  try {
    const invoices = await prisma.salesInvoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: query, mode: "insensitive" } },
          { customer: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, invoices };
  } catch (error) {
    return { success: false, message: "Search failed." };
  }
}

export async function searchSalesBySerial(serial) {
  try {
    const sn = await prisma.serialNumber.findUnique({
      where: { serial: serial.trim() },
      include: {
        importInvoiceLine: {
          include: {
            batch: {
              include: {
                salesLines: {
                  include: { salesInvoice: { include: { customer: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!sn || !sn.isSold) {
      return { success: false, message: `Serial "${serial}" not found in any sales invoice.` };
    }
    // Find the sales invoice line that contains this serial
    const allSalesLines = sn.importInvoiceLine.batch?.salesLines ?? [];
    const matchingLine = allSalesLines.find((l) => l.soldSerials.includes(serial.trim()));
    if (!matchingLine) return { success: false, message: "Could not locate the invoice for this serial." };
    return { success: true, invoice: matchingLine.salesInvoice, lineId: matchingLine.id };
  } catch (error) {
    return { success: false, message: "Serial search failed." };
  }
}

export async function getAvailableBatchesForProduct(productId) {
  try {
    const batches = await prisma.batch.findMany({
      where: { productId, quantityRemaining: { gt: 0 } },
      select: {
        id: true,
        quantityRemaining: true,
        retailPrice: true, // Retail price shown; purchase price NEVER returned
        entryDate: true,
        importInvoiceLine: { select: { isSerialised: true } },
        supplier: { select: { name: true } },
        // purchasePrice intentionally excluded
      },
      orderBy: { entryDate: "asc" },
    });
    return { success: true, batches };
  } catch (error) {
    return { success: false, message: "Failed to fetch batches." };
  }
}

export async function getAvailableSerialsForBatch(batchId) {
  try {
    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) return { success: false, message: "Batch not found." };
    const serials = await prisma.serialNumber.findMany({
      where: { importInvoiceLineId: batch.importInvoiceLineId, isSold: false, isReturned: false },
      select: { serial: true },
    });
    return { success: true, serials: serials.map((s) => s.serial) };
  } catch (error) {
    return { success: false, message: "Failed to fetch serials." };
  }
}

export async function getCustomers() {
  try {
    const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
    return { success: true, customers };
  } catch (error) {
    return { success: false, message: "Failed to fetch customers." };
  }
}

export async function getProducts() {
  try {
    const products = await prisma.product.findMany({
      where: { isArchived: false, stockBalance: { gt: 0 } },
      orderBy: { name: "asc" },
    });
    return { success: true, products };
  } catch (error) {
    return { success: false, message: "Failed to fetch products." };
  }
}

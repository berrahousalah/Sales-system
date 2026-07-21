"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { serializeSupplier } from "@/lib/serialize";


const SupplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required").trim(),
});

/**
 * Creates a new Supplier.
 * Enforces a case-insensitive unique name check.
 */
export async function createSupplier(formData) {
  try {
    const rawData = { name: formData.get("name") };
    const parsed = SupplierSchema.safeParse(rawData);

    if (!parsed.success) {
      return { success: false, message: parsed.error.errors[0].message };
    }

    // Case-insensitive duplicate check (SQLite-compatible)
    const allSuppliers = await prisma.supplier.findMany({ select: { name: true } });
    const isDuplicate = allSuppliers.some(
      (s) => s.name.toLowerCase() === parsed.data.name.toLowerCase()
    );
    if (isDuplicate) {
      return { success: false, message: `A supplier named "${parsed.data.name}" already exists.` };
    }

    const newSupplier = await prisma.supplier.create({
      data: { name: parsed.data.name },
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Supplier created successfully", supplier: serializeSupplier(newSupplier) };
  } catch (error) {
    console.error("Failed to create supplier:", error);
    return { success: false, message: "Database error: Failed to create supplier" };
  }
}

/**
 * Retrieves all Suppliers
 */
export async function getSuppliers() {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, suppliers: suppliers.map(serializeSupplier) };
  } catch (error) {
    console.error("Failed to fetch suppliers:", error);
    return { success: false, message: "Database error: Failed to fetch suppliers" };
  }
}

/**
 * Deletes a Supplier.
 * BLOCKED if: totalDebt > 0, or if any import invoices reference this supplier.
 */
export async function deleteSupplier(supplierId) {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: { _count: { select: { importInvoices: true, batches: true } } },
    });

    if (!supplier) {
      return { success: false, message: "Supplier not found." };
    }

    const totalDebt = parseFloat(supplier.totalDebt);
    if (totalDebt > 0) {
      return {
        success: false,
        message: `Cannot delete "${supplier.name}". They have an outstanding debt balance of $${totalDebt.toFixed(2)}. Clear all debt before deleting.`,
      };
    }

    if (supplier._count.importInvoices > 0) {
      return {
        success: false,
        message: `Cannot delete "${supplier.name}". They have ${supplier._count.importInvoices} import invoice(s) on record. This supplier cannot be removed while invoices exist.`,
      };
    }

    await prisma.supplier.delete({ where: { id: supplierId } });
    revalidatePath("/", "layout");
    return { success: true, message: `Supplier "${supplier.name}" deleted successfully.` };
  } catch (error) {
    console.error("Failed to delete supplier:", error);
    return { success: false, message: error.message || "Database error: Failed to delete supplier." };
  }
}

/**
 * Manually adjusts a Supplier's total debt by a delta amount (additive).
 * Positive delta = add debt. Negative delta = reduce debt (manual credit).
 * This is for initial/manual debt entry — it does NOT allocate against invoices.
 */
export async function adjustSupplierDebt(supplierId, deltaStr) {
  try {
    const delta = parseFloat(deltaStr);
    if (isNaN(delta) || delta === 0) {
      return { success: false, message: "Please enter a valid non-zero adjustment amount." };
    }

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return { success: false, message: "Supplier not found." };

    const currentDebt = parseFloat(supplier.totalDebt);
    const newDebt = currentDebt + delta;

    if (newDebt < 0) {
      return {
        success: false,
        message: `Adjustment would result in a negative debt balance ($${newDebt.toFixed(2)}). Reduce the adjustment amount.`,
      };
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: { totalDebt: newDebt },
    });

    revalidatePath("/", "layout");
    return {
      success: true,
      message: `Debt adjusted by $${delta >= 0 ? "+" : ""}${delta.toFixed(2)}. New balance: $${newDebt.toFixed(2)}.`,
      supplier: serializeSupplier(updated),
    };
  } catch (error) {
    console.error("Failed to adjust supplier debt:", error);
    return { success: false, message: "Database error: Failed to adjust debt." };
  }
}

/**
 * FIFO Debt Allocation Algorithm (Sequential Repayment)
 */
export async function paySupplierDebt(supplierId, paymentAmountStr) {
  try {
    if (!supplierId || !paymentAmountStr) {
      return { success: false, message: "Supplier ID and Payment Amount are required." };
    }

    let paymentAmount = parseFloat(paymentAmountStr);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return { success: false, message: "Payment amount must be greater than zero." };
    }

    // Wrap the entire FIFO algorithm in a transaction for data safety
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get supplier to check total debt
      const supplier = await tx.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier) {
        throw new Error("Supplier not found.");
      }

      const totalDebt = parseFloat(supplier.totalDebt);

      // 2. Overpayment Prevention Guardrail
      if (paymentAmount > totalDebt) {
        throw new Error(`Payment amount ($${paymentAmount}) exceeds total outstanding debt ($${totalDebt}).`);
      }

      // 3. Query all ImportInvoice records linked to this SupplierId where remaining Debt Balance > 0
      const unpaidInvoices = await tx.importInvoice.findMany({
        where: {
          supplierId,
          debtBalance: { gt: 0 }
        },
        orderBy: { createdAt: "asc" } // chronologically from oldest to newest
      });

      let remainingPayment = paymentAmount;

      // 4. Iteratively deduct the payment pool across the sorted invoices
      for (const invoice of unpaidInvoices) {
        if (remainingPayment <= 0) break;

        const invoiceDebt = parseFloat(invoice.debtBalance);

        let amountToDeduct = 0;
        let newStatus = invoice.status;

        if (remainingPayment >= invoiceDebt) {
          // Fully clear the oldest invoice
          amountToDeduct = invoiceDebt;
          newStatus = "PAID";
        } else {
          // Partially clear the invoice
          amountToDeduct = remainingPayment;
          newStatus = "PARTIAL";
        }

        const newAmountPaid = parseFloat(invoice.amountPaid) + amountToDeduct;
        const newDebtBalance = invoiceDebt - amountToDeduct;

        // Update the Invoice
        await tx.importInvoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: newAmountPaid,
            debtBalance: newDebtBalance,
            status: newStatus,
          }
        });

        remainingPayment -= amountToDeduct;
      }

      // 5. Decrement the supplier's aggregate "Outstanding Debt"
      const newSupplierTotalDebt = totalDebt - paymentAmount;
      await tx.supplier.update({
        where: { id: supplierId },
        data: { totalDebt: newSupplierTotalDebt }
      });

      return {
        success: true,
        message: `Successfully allocated $${paymentAmount} towards outstanding debt.`
      };
    });

    revalidatePath("/", "layout");
    return result;
  } catch (error) {
    console.error("Payment allocation failed:", error);
    return { success: false, message: error.message || "Database error during payment allocation." };
  }
}

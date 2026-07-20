"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { serializeSupplier } from "@/lib/serialize";


const SupplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required").trim(),
});

/**
 * Creates a new Supplier
 */
export async function createSupplier(formData) {
  try {
    const rawData = { name: formData.get("name") };
    const parsed = SupplierSchema.safeParse(rawData);
    
    if (!parsed.success) {
      return { success: false, message: parsed.error.errors[0].message };
    }

    const newSupplier = await prisma.supplier.create({
      data: { name: parsed.data.name },
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Supplier created successfully", supplier: newSupplier };
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

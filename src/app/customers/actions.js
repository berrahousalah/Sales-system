"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { serializeCustomer } from "@/lib/serialize";


const CustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required").trim(),
});

/**
 * Creates a new Customer
 */
export async function createCustomer(formData) {
  try {
    const rawData = { name: formData.get("name") };
    const parsed = CustomerSchema.safeParse(rawData);

    if (!parsed.success) {
      return { success: false, message: parsed.error.errors[0].message };
    }

    const newCustomer = await prisma.customer.create({
      data: { name: parsed.data.name },
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Customer created successfully", customer: newCustomer };
  } catch (error) {
    console.error("Failed to create customer:", error);
    return { success: false, message: "Database error: Failed to create customer" };
  }
}

/**
 * Retrieves all Customers
 */
export async function getCustomers() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, customers: customers.map(serializeCustomer) };
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return { success: false, message: "Database error: Failed to fetch customers" };
  }
}

/**
 * FIFO Collection Allocation Algorithm (Sequential Debt Clearing)
 * Collects a payment from a customer and allocates it against their oldest unpaid SalesInvoices first.
 */
export async function collectCustomerPayment(customerId, paymentAmountStr) {
  try {
    if (!customerId || !paymentAmountStr) {
      return { success: false, message: "Customer ID and Payment Amount are required." };
    }

    const paymentAmount = parseFloat(paymentAmountStr);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return { success: false, message: "Payment amount must be greater than zero." };
    }

    // Wrap entire FIFO algorithm in a transaction for atomic data safety
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get customer to validate total debt
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new Error("Customer not found.");
      }

      const totalDebt = parseFloat(customer.totalDebt);

      // 2. Overpayment Prevention Guardrail — backend enforcement
      if (paymentAmount > totalDebt) {
        throw new Error(
          `Collected amount ($${paymentAmount.toFixed(2)}) exceeds total outstanding debt ($${totalDebt.toFixed(2)}).`
        );
      }

      // 3. Query all SalesInvoice records where debtBalance > 0, sorted oldest to newest (FIFO)
      const unpaidInvoices = await tx.salesInvoice.findMany({
        where: {
          customerId,
          debtBalance: { gt: 0 },
        },
        orderBy: { createdAt: "asc" },
      });

      let remainingPayment = paymentAmount;

      // 4. Iteratively deduct payment pool across sorted invoices
      for (const invoice of unpaidInvoices) {
        if (remainingPayment <= 0) break;

        const invoiceDebt = parseFloat(invoice.debtBalance);
        let amountToDeduct = 0;
        let newStatus = invoice.status;

        if (remainingPayment >= invoiceDebt) {
          // Fully clear this invoice
          amountToDeduct = invoiceDebt;
          newStatus = "PAID";
        } else {
          // Partially clear this invoice
          amountToDeduct = remainingPayment;
          newStatus = "PARTIAL";
        }

        const newAmountPaid = parseFloat(invoice.amountPaid) + amountToDeduct;
        const newDebtBalance = invoiceDebt - amountToDeduct;

        await tx.salesInvoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: newAmountPaid,
            debtBalance: newDebtBalance,
            status: newStatus,
          },
        });

        remainingPayment -= amountToDeduct;
      }

      // 5. Decrement customer's aggregate outstanding debt
      const newTotalDebt = totalDebt - paymentAmount;
      await tx.customer.update({
        where: { id: customerId },
        data: { totalDebt: newTotalDebt },
      });

      return {
        success: true,
        message: `Successfully collected $${paymentAmount.toFixed(2)} from customer.`,
      };
    });

    revalidatePath("/", "layout");
    return result;
  } catch (error) {
    console.error("Payment collection failed:", error);
    return { success: false, message: error.message || "Database error during payment collection." };
  }
}

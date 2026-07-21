"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { serializeCustomer } from "@/lib/serialize";


const CustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required").trim(),
});

/**
 * Creates a new Customer.
 * Enforces a case-insensitive unique name check.
 */
export async function createCustomer(formData) {
  try {
    const rawData = { name: formData.get("name") };
    const parsed = CustomerSchema.safeParse(rawData);

    if (!parsed.success) {
      return { success: false, message: parsed.error.errors[0].message };
    }

    // Case-insensitive duplicate check (SQLite-compatible)
    const allCustomers = await prisma.customer.findMany({ select: { name: true } });
    const isDuplicate = allCustomers.some(
      (c) => c.name.toLowerCase() === parsed.data.name.toLowerCase()
    );
    if (isDuplicate) {
      return { success: false, message: `A customer named "${parsed.data.name}" already exists.` };
    }

    const newCustomer = await prisma.customer.create({
      data: { name: parsed.data.name },
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Customer created successfully", customer: serializeCustomer(newCustomer) };
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
 * Deletes a Customer.
 * BLOCKED if: totalDebt > 0, or if any sales invoices reference this customer.
 */
export async function deleteCustomer(customerId) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { _count: { select: { salesInvoices: true } } },
    });

    if (!customer) {
      return { success: false, message: "Customer not found." };
    }

    const totalDebt = parseFloat(customer.totalDebt);
    if (totalDebt > 0) {
      return {
        success: false,
        message: `Cannot delete "${customer.name}". They have an outstanding debt balance of $${totalDebt.toFixed(2)}. Clear all debt before deleting.`,
      };
    }

    if (customer._count.salesInvoices > 0) {
      return {
        success: false,
        message: `Cannot delete "${customer.name}". They have ${customer._count.salesInvoices} sales invoice(s) on record. This customer cannot be removed while invoices exist.`,
      };
    }

    await prisma.customer.delete({ where: { id: customerId } });
    revalidatePath("/", "layout");
    return { success: true, message: `Customer "${customer.name}" deleted successfully.` };
  } catch (error) {
    console.error("Failed to delete customer:", error);
    return { success: false, message: error.message || "Database error: Failed to delete customer." };
  }
}

/**
 * Manually adjusts a Customer's total debt by a delta amount (additive).
 * Positive delta = add debt. Negative delta = reduce debt (manual credit).
 * This is for initial/manual debt entry — it does NOT allocate against invoices.
 */
export async function adjustCustomerDebt(customerId, deltaStr) {
  try {
    const delta = parseFloat(deltaStr);
    if (isNaN(delta) || delta === 0) {
      return { success: false, message: "Please enter a valid non-zero adjustment amount." };
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { success: false, message: "Customer not found." };

    const currentDebt = parseFloat(customer.totalDebt);
    const newDebt = currentDebt + delta;

    if (newDebt < 0) {
      return {
        success: false,
        message: `Adjustment would result in a negative debt balance ($${newDebt.toFixed(2)}). Reduce the adjustment amount.`,
      };
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { totalDebt: newDebt },
    });

    revalidatePath("/", "layout");
    return {
      success: true,
      message: `Debt adjusted by $${delta >= 0 ? "+" : ""}${delta.toFixed(2)}. New balance: $${newDebt.toFixed(2)}.`,
      customer: serializeCustomer(updated),
    };
  } catch (error) {
    console.error("Failed to adjust customer debt:", error);
    return { success: false, message: "Database error: Failed to adjust debt." };
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

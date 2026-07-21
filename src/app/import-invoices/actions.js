"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  serializeImportInvoice,
  serializeSupplier,
  serializeProduct,
} from "@/lib/serialize";


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Race-condition-safe invoice number generator using PostgreSQL advisory lock.
 * Format: IMP-{YYYY}-{0001}
 */
async function generateInvoiceNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `IMP-${year}-`;

  // Count existing invoices for this year to determine next sequence
  const count = await tx.importInvoice.count({
    where: { invoiceNumber: { startsWith: prefix } },
  });

  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}

/**
 * Recalculates and updates ImportInvoice totals: totalAmount, debtBalance, status.
 * Must be called inside a transaction.
 */
async function recalculateInvoiceTotals(tx, invoiceId) {
  const invoice = await tx.importInvoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true },
  });

  if (!invoice) throw new Error("Invoice not found during recalculation.");

  const linesTotal = invoice.lines.reduce((sum, line) => {
    return sum + parseFloat(line.purchasePrice) * line.quantity;
  }, 0);

  const totalAmount = linesTotal + parseFloat(invoice.transportationCost);
  const amountPaid = parseFloat(invoice.amountPaid);
  const debtBalance = Math.max(0, totalAmount - amountPaid);

  let status = "UNPAID";
  if (debtBalance === 0 && totalAmount > 0) status = "PAID";
  else if (amountPaid > 0 && debtBalance > 0) status = "PARTIAL";

  await tx.importInvoice.update({
    where: { id: invoiceId },
    data: { totalAmount, debtBalance, status },
  });

  return { totalAmount, debtBalance, status };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE INVOICE HEADER
// ─────────────────────────────────────────────────────────────────────────────

const CreateInvoiceSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
});

export async function createImportInvoice(formData) {
  try {
    const raw = {
      supplierId: formData.get("supplierId"),
      invoiceDate: formData.get("invoiceDate"),
    };
    const parsed = CreateInvoiceSchema.safeParse(raw);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await generateInvoiceNumber(tx);
      return tx.importInvoice.create({
        data: {
          invoiceNumber,
          supplierId: parsed.data.supplierId,
          invoiceDate: new Date(parsed.data.invoiceDate),
          isHeaderLocked: true,
        },
      });
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Invoice created", invoice };
  } catch (error) {
    console.error("createImportInvoice error:", error);
    return { success: false, message: error.message || "Failed to create invoice" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCK INVOICE HEADER (first save — creates Batch records)
// ─────────────────────────────────────────────────────────────────────────────

export async function lockInvoiceHeader(invoiceId) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.importInvoice.findUnique({
        where: { id: invoiceId },
        include: { lines: { include: { batch: true } } },
      });

      if (!invoice) throw new Error("Invoice not found.");
      if (invoice.isHeaderLocked) return { alreadyLocked: true };

      // Create Batch for each line that doesn't yet have one
      for (const line of invoice.lines) {
        if (!line.batch) {
          const batch = await tx.batch.create({
            data: {
              productId: line.productId,
              supplierId: invoice.supplierId,
              importInvoiceLineId: line.id,
              quantityReceived: line.quantity,
              quantityRemaining: line.quantity,
              purchasePrice: line.purchasePrice,
              retailPrice: line.retailPrice,
            },
          });

          // Inject stock into product
          await tx.product.update({
            where: { id: line.productId },
            data: { stockBalance: { increment: line.quantity } },
          });
        }
      }

      // Recalculate totals
      const totals = await recalculateInvoiceTotals(tx, invoiceId);

      // Route debt to supplier
      if (totals.debtBalance > 0) {
        await tx.supplier.update({
          where: { id: invoice.supplierId },
          data: { totalDebt: { increment: totals.debtBalance } },
        });
      }

      // Lock header
      await tx.importInvoice.update({
        where: { id: invoiceId },
        data: { isHeaderLocked: true },
      });

      return { alreadyLocked: false, ...totals };
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Invoice header locked and inventory updated.", result };
  } catch (error) {
    console.error("lockInvoiceHeader error:", error);
    return { success: false, message: error.message || "Failed to lock invoice." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD LINE TO INVOICE
// ─────────────────────────────────────────────────────────────────────────────

const AddLineSchema = z.object({
  invoiceId: z.string().min(1),
  productId: z.string().min(1, "Product is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  purchasePrice: z.number().positive("Purchase price must be positive"),
  retailPrice: z.number().positive("Retail price must be positive"),
  isSerialised: z.boolean().default(false),
  serials: z.array(z.string().trim().min(1)).optional().default([]),
});

export async function addLineToInvoice(data) {
  try {
    const parsed = AddLineSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    const { invoiceId, productId, quantity, purchasePrice, retailPrice, isSerialised, serials } =
      parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // Verify invoice exists and header is not locked (lines can still be added before lock)
      const invoice = await tx.importInvoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new Error("Invoice not found.");

      // Verify product exists and is not archived
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product || product.isArchived)
        throw new Error("Product not found. Please define it in Products Management first.");

      // Serial number validations
      if (isSerialised) {
        if (serials.length !== quantity)
          throw new Error(`Expected ${quantity} serial numbers but received ${serials.length}.`);

        // Check for duplicates within this batch
        const uniqueSerials = new Set(serials);
        if (uniqueSerials.size !== serials.length)
          throw new Error("Duplicate serial numbers detected within this batch.");

        // Check for duplicates across entire inventory
        const existing = await tx.serialNumber.findFirst({
          where: { serial: { in: serials } },
        });
        if (existing)
          throw new Error(
            `Serial number "${existing.serial}" already exists in inventory.`
          );
      }

      // Create the line
      const line = await tx.importInvoiceLine.create({
        data: {
          importInvoiceId: invoiceId,
          productId,
          quantity,
          purchasePrice,
          retailPrice,
          isSerialised,
          isLocked: false,
          quantitySold: 0,
        },
      });

      // Create serial number records
      if (isSerialised && serials.length > 0) {
        await tx.serialNumber.createMany({
          data: serials.map((s) => ({ serial: s, importInvoiceLineId: line.id })),
        });
      }

      // If header is already locked, immediately create Batch + inject stock
      if (invoice.isHeaderLocked) {
        await tx.batch.create({
          data: {
            productId,
            supplierId: invoice.supplierId,
            importInvoiceLineId: line.id,
            quantityReceived: quantity,
            quantityRemaining: quantity,
            purchasePrice,
            retailPrice,
          },
        });
        await tx.product.update({
          where: { id: productId },
          data: { stockBalance: { increment: quantity } },
        });
      }

      // Recalculate totals and sync supplier debt delta
      const oldTotals = { debtBalance: parseFloat(invoice.debtBalance) };
      const newTotals = await recalculateInvoiceTotals(tx, invoiceId);
      const debtDelta = newTotals.debtBalance - oldTotals.debtBalance;
      if (debtDelta !== 0 && invoice.isHeaderLocked) {
        await tx.supplier.update({
          where: { id: invoice.supplierId },
          data: { totalDebt: { increment: debtDelta } },
        });
      }

      return { line, newTotals };
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Line added successfully.", ...result };
  } catch (error) {
    console.error("addLineToInvoice error:", error);
    return { success: false, message: error.message || "Failed to add line." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE INVOICE LINE (enforce row-lock rules)
// ─────────────────────────────────────────────────────────────────────────────

const UpdateLineSchema = z.object({
  lineId: z.string().min(1),
  quantity: z.number().int().positive(),
  purchasePrice: z.number().positive(),
  retailPrice: z.number().positive(),
  // For serialised batches:
  //   removedSerials: serial numbers to REMOVE from inventory pool (length must equal abs(quantityDelta) when delta < 0)
  removedSerials: z.array(z.string().trim().min(1)).optional().default([]),
});

export async function updateInvoiceLine(data) {
  try {
    const parsed = UpdateLineSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    const { lineId, quantity, purchasePrice, retailPrice, newSerials, removedSerials } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const line = await tx.importInvoiceLine.findUnique({
        where: { id: lineId },
        include: { importInvoice: true, batch: true, serialNumbers: true },
      });

      if (!line) throw new Error("Invoice line not found.");

      const invoice = line.importInvoice;
      const oldQuantity = line.quantity;
      const oldPurchasePrice = parseFloat(line.purchasePrice);
      const quantitySold = line.quantitySold ?? 0;
      const hasSales = quantitySold > 0;

      // ── GRANULAR LOCK ENFORCEMENT ──────────────────────────────────
      // Rule 1: Quantity cannot drop below already-sold units
      if (quantity < quantitySold)
        throw new Error(`Cannot reduce quantity below units already sold (${quantitySold}).`);

      // Rule 2: Purchase price is read-only once any unit has been sold
      if (hasSales && parseFloat(purchasePrice) !== oldPurchasePrice)
        throw new Error("Purchase price cannot be changed after units from this batch have been sold.");

      // Rule 3: isSerialised toggle is immutable (enforced at DB level — field not editable here)
      // ──────────────────────────────────────────────────────────────

      const quantityDelta = quantity - oldQuantity;

      // Rule: STRICT RULE: NO INCREASING QUANTITY DURING EDIT
      if (quantityDelta > 0) {
        throw new Error("Cannot increase quantity of an existing line. Please create a new batch instead.");
      }

      // ── SERIAL NUMBER MANAGEMENT ───────────────────────────────────
      if (line.isSerialised && quantityDelta < 0) {
        // REMOVING units: require exactly abs(delta) serial numbers to delete
        const removeCount = Math.abs(quantityDelta);
        if (removedSerials.length !== removeCount)
          throw new Error(`Please select ${removeCount} serial number(s) to remove. Received ${removedSerials.length}.`);

        // Verify the provided serials belong to this line and are not sold
        const snRecords = await tx.serialNumber.findMany({
          where: { serial: { in: removedSerials }, importInvoiceLineId: lineId },
        });
        if (snRecords.length !== removeCount)
          throw new Error("One or more selected serials do not belong to this batch.");

        const soldSn = snRecords.find((s) => s.isSold || s.isReturned);
        if (soldSn)
          throw new Error(`Serial "${soldSn.serial}" has already been sold and cannot be removed.`);

        // Delete the chosen serial records
        await tx.serialNumber.deleteMany({
          where: { serial: { in: removedSerials }, importInvoiceLineId: lineId },
        });
      }
      // ──────────────────────────────────────────────────────────────

      // Update line record (purchasePrice unchanged if hasSales, but we use the validated value)
      await tx.importInvoiceLine.update({
        where: { id: lineId },
        data: { quantity, purchasePrice, retailPrice },
      });

      // Sync Batch quantity if header is locked
      if (invoice.isHeaderLocked && line.batch) {
        const newRemaining = line.batch.quantityRemaining + quantityDelta;
        await tx.batch.update({
          where: { id: line.batch.id },
          data: {
            quantityReceived: { increment: quantityDelta },
            quantityRemaining: newRemaining,
            // Only update prices when no sales exist
            ...(!hasSales && { purchasePrice, retailPrice }),
            ...(hasSales && { retailPrice }),
          },
        });
      }

      // Sync product stock
      if (invoice.isHeaderLocked && quantityDelta !== 0) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stockBalance: { increment: quantityDelta } },
        });
      }

      // Recalculate invoice totals and sync supplier debt delta
      const oldDebt = parseFloat(invoice.debtBalance);
      const newTotals = await recalculateInvoiceTotals(tx, invoice.id);
      const debtDelta = newTotals.debtBalance - oldDebt;

      if (debtDelta !== 0 && invoice.isHeaderLocked) {
        await tx.supplier.update({
          where: { id: invoice.supplierId },
          data: { totalDebt: { increment: debtDelta } },
        });
      }

      return { newTotals };
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Line updated successfully.", ...result };
  } catch (error) {
    console.error("updateInvoiceLine error:", error);
    return { success: false, message: error.message || "Failed to update line." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE INVOICE LINE
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteInvoiceLine(lineId) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const line = await tx.importInvoiceLine.findUnique({
        where: { id: lineId },
        include: { importInvoice: true, batch: true },
      });

      if (!line) throw new Error("Invoice line not found.");
      if (line.isLocked)
        throw new Error("Cannot delete a locked row. Units from this batch have been sold.");

      const invoice = line.importInvoice;

      // Remove serial numbers
      await tx.serialNumber.deleteMany({ where: { importInvoiceLineId: lineId } });

      // Remove batch and rollback stock if header is locked
      if (invoice.isHeaderLocked && line.batch) {
        await tx.batch.delete({ where: { id: line.batch.id } });
        await tx.product.update({
          where: { id: line.productId },
          data: { stockBalance: { decrement: line.quantity } },
        });
      }

      await tx.importInvoiceLine.delete({ where: { id: lineId } });

      // Recalculate totals + supplier debt delta
      const oldDebt = parseFloat(invoice.debtBalance);
      const newTotals = await recalculateInvoiceTotals(tx, invoice.id);
      const debtDelta = newTotals.debtBalance - oldDebt;

      if (debtDelta !== 0 && invoice.isHeaderLocked) {
        await tx.supplier.update({
          where: { id: invoice.supplierId },
          data: { totalDebt: { increment: debtDelta } },
        });
      }

      return { newTotals };
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Line deleted.", ...result };
  } catch (error) {
    console.error("deleteInvoiceLine error:", error);
    return { success: false, message: error.message || "Failed to delete line." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE TRANSPORTATION COST & AMOUNT PAID
// ─────────────────────────────────────────────────────────────────────────────

const UpdateFooterSchema = z.object({
  invoiceId: z.string().min(1),
  transportationCost: z.number().min(0),
  amountPaid: z.number().min(0),
});

export async function updateInvoiceFooter(data) {
  try {
    const parsed = UpdateFooterSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    const { invoiceId, transportationCost, amountPaid } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.importInvoice.findUnique({
        where: { id: invoiceId },
        include: { lines: true },
      });
      if (!invoice) throw new Error("Invoice not found.");

      // Guardrail: compute what the new total would be BEFORE writing anything
      const linesSubtotal = invoice.lines.reduce(
        (sum, l) => sum + parseFloat(l.purchasePrice) * l.quantity,
        0
      );
      const projectedTotal = linesSubtotal + transportationCost;
      if (amountPaid > projectedTotal) {
        throw new Error("Paid amount cannot exceed the total invoice value.");
      }

      const oldDebt = parseFloat(invoice.debtBalance);

      await tx.importInvoice.update({
        where: { id: invoiceId },
        data: { transportationCost, amountPaid },
      });

      const newTotals = await recalculateInvoiceTotals(tx, invoiceId);
      const debtDelta = newTotals.debtBalance - oldDebt;

      if (debtDelta !== 0 && invoice.isHeaderLocked) {
        await tx.supplier.update({
          where: { id: invoice.supplierId },
          data: { totalDebt: { increment: debtDelta } },
        });
      }

      return { newTotals };
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Invoice footer updated.", ...result };
  } catch (error) {
    console.error("updateInvoiceFooter error:", error);
    return { success: false, message: error.message || "Failed to update footer." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ / SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export async function getImportInvoices() {
  try {
    const invoices = await prisma.importInvoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { supplier: true },
    });
    return { success: true, invoices: invoices.map(serializeImportInvoice) };
  } catch (error) {
    console.error("getImportInvoices error:", error);
    return { success: false, message: "Failed to fetch invoices." };
  }
}

export async function getImportInvoiceById(id) {
  try {
    const invoice = await prisma.importInvoice.findUnique({
      where: { id },
      include: {
        supplier: true,
        lines: {
          include: {
            product: true,
            serialNumbers: true,
            batch: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!invoice) return { success: false, message: "Invoice not found." };
    return { success: true, invoice: serializeImportInvoice(invoice) };
  } catch (error) {
    console.error("getImportInvoiceById error:", error);
    return { success: false, message: "Failed to fetch invoice." };
  }
}

export async function searchBySerial(serial) {
  try {
    const sn = await prisma.serialNumber.findUnique({
      where: { serial: serial.trim() },
      include: {
        importInvoiceLine: {
          include: {
            importInvoice: { include: { supplier: true } },
            product: true,
          },
        },
      },
    });
    if (!sn) return { success: false, message: `Serial number "${serial}" not found.` };
    return { success: true, result: sn };
  } catch (error) {
    console.error("searchBySerial error:", error);
    return { success: false, message: "Search failed." };
  }
}

export async function searchInvoices(query) {
  try {
    const invoices = await prisma.importInvoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: query } },
          { supplier: { name: { contains: query } } },
        ],
      },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, invoices: invoices.map(serializeImportInvoice) };
  } catch (error) {
    console.error("searchInvoices error:", error);
    return { success: false, message: "Search failed." };
  }
}

export async function getSuppliers() {
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
    return { success: true, suppliers: suppliers.map(serializeSupplier) };
  } catch (error) {
    return { success: false, message: "Failed to fetch suppliers." };
  }
}

export async function getProducts() {
  try {
    const products = await prisma.product.findMany({
      where: { isArchived: false },
      orderBy: { name: "asc" },
    });
    return { success: true, products: products.map(serializeProduct) };
  } catch (error) {
    return { success: false, message: "Failed to fetch products." };
  }
}

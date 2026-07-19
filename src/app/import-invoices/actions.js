"use server";

import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

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
          isHeaderLocked: false,
        },
      });
    });

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
        const existing = await tx.importInvoice.findUnique({ where: { id: invoiceId } });
        const previousDebt = parseFloat(existing?.debtBalance ?? 0);
        const delta = totals.debtBalance - previousDebt;
        if (delta !== 0) {
          await tx.supplier.update({
            where: { id: invoice.supplierId },
            data: { totalDebt: { increment: delta } },
          });
        }
      }

      // Lock header
      await tx.importInvoice.update({
        where: { id: invoiceId },
        data: { isHeaderLocked: true },
      });

      return { alreadyLocked: false, ...totals };
    });

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
  serials: z.array(z.string().trim().min(1)).optional().default([]),
});

export async function updateInvoiceLine(data) {
  try {
    const parsed = UpdateLineSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    const { lineId, quantity, purchasePrice, retailPrice, serials } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const line = await tx.importInvoiceLine.findUnique({
        where: { id: lineId },
        include: { importInvoice: true, batch: true, serialNumbers: true },
      });

      if (!line) throw new Error("Invoice line not found.");

      const invoice = line.importInvoice;
      const oldQuantity = line.quantity;
      const oldPurchasePrice = parseFloat(line.purchasePrice);

      // ── ROW LOCK ENFORCEMENT ─────────────────────────────────────
      if (line.isLocked) {
        // Cannot decrease quantity below units already sold
        if (quantity < line.quantitySold)
          throw new Error(
            `Cannot reduce quantity below units already sold (${line.quantitySold}).`
          );
        // Price field is Read-Only on locked rows
        if (parseFloat(purchasePrice) !== oldPurchasePrice)
          throw new Error("Purchase price is locked because units from this batch have been sold.");
        // Cannot re-assign individual serial numbers on a locked row
        if (line.isSerialised && serials.length > 0)
          throw new Error("Serial numbers are locked for this batch.");
      }
      // ─────────────────────────────────────────────────────────────

      const quantityDelta = quantity - oldQuantity;

      // Validate new serial numbers if serialised and unlocked
      if (line.isSerialised && !line.isLocked && serials.length > 0) {
        if (serials.length !== quantity)
          throw new Error(`Expected ${quantity} serial numbers but received ${serials.length}.`);

        const existingSerials = line.serialNumbers.map((s) => s.serial);
        const newSerials = serials.filter((s) => !existingSerials.includes(s));

        if (newSerials.length > 0) {
          const duplicate = await tx.serialNumber.findFirst({
            where: { serial: { in: newSerials }, importInvoiceLineId: { not: lineId } },
          });
          if (duplicate)
            throw new Error(`Serial number "${duplicate.serial}" already exists in inventory.`);
        }

        // Replace all serial numbers
        await tx.serialNumber.deleteMany({
          where: { importInvoiceLineId: lineId, isSold: false, isReturned: false },
        });
        await tx.serialNumber.createMany({
          data: serials.map((s) => ({ serial: s, importInvoiceLineId: lineId })),
        });
      }

      // Update line record
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
            purchasePrice,
            retailPrice,
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
      const invoice = await tx.importInvoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new Error("Invoice not found.");

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
    return { success: true, invoices };
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
    return { success: true, invoice };
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
          { invoiceNumber: { contains: query, mode: "insensitive" } },
          { supplier: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, invoices };
  } catch (error) {
    console.error("searchInvoices error:", error);
    return { success: false, message: "Search failed." };
  }
}

export async function getSuppliers() {
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
    return { success: true, suppliers };
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
    return { success: true, products };
  } catch (error) {
    return { success: false, message: "Failed to fetch products." };
  }
}

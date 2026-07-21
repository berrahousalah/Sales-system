"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { serializeProduct, serializeBatch, serializeInventoryAdjustment } from "@/lib/serialize";


// ─────────────────────────────────────────────────────────────────────────────
// FETCH DATA FOR UI
// ─────────────────────────────────────────────────────────────────────────────

export async function getProducts() {
  try {
    const products = await prisma.product.findMany({
      where: { isArchived: false, stockBalance: { gt: 0 } },
      orderBy: { name: "asc" },
    });
    return { success: true, products: products.map(serializeProduct) };
  } catch (error) {
    return { success: false, message: "Failed to fetch products." };
  }
}

export async function getAvailableBatchesForProduct(productId) {
  try {
    const batches = await prisma.batch.findMany({
      where: { productId, quantityRemaining: { gt: 0 } },
      select: {
        id: true,
        quantityRemaining: true,
        entryDate: true,
        importInvoiceLine: { select: { isSerialised: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { entryDate: "asc" },
    });
    // Partial batch so we do custom serialization to match serializeBatch behavior for dates
    const serialized = batches.map(b => ({
      ...b,
      entryDate: b.entryDate instanceof Date ? b.entryDate.toISOString() : b.entryDate,
    }));
    return { success: true, batches: serialized };
  } catch (error) {
    return { success: false, message: "Failed to fetch batches." };
  }
}

export async function getAvailableSerialsForBatch(batchId) {
  try {
    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) return { success: false, message: "Batch not found." };

    const serials = await prisma.serialNumber.findMany({
      where: {
        importInvoiceLineId: batch.importInvoiceLineId,
        isSold: false,
        isReturned: false,
        isAdjusted: false, // Ensure we don't show already burned serials
      },
      select: { serial: true },
    });
    return { success: true, serials: serials.map((s) => s.serial) };
  } catch (error) {
    return { success: false, message: "Failed to fetch serial numbers." };
  }
}

export async function getInventoryAdjustments() {
  try {
    const adjustments = await prisma.inventoryAdjustment.findMany({
      include: {
        batch: {
          include: {
            product: true,
            supplier: true,
            importInvoiceLine: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, adjustments: adjustments.map(serializeInventoryAdjustment) };
  } catch (error) {
    return { success: false, message: "Failed to fetch inventory adjustments history." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTE INVENTORY ADJUSTMENT
// ─────────────────────────────────────────────────────────────────────────────

const VALID_REASONS = ["DAMAGED", "LOST", "INTERNAL_USE", "AUDIT_CORRECTION"];

const AdjustmentSchema = z.object({
  batchId: z.string().min(1, "Batch is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  reason: z.enum(VALID_REASONS, {
    errorMap: () => ({ message: "Invalid adjustment reason." }),
  }),
  adjustedSerials: z.array(z.string().trim().min(1)).optional().default([]),
});

export async function executeInventoryAdjustment(data) {
  try {
    const parsed = AdjustmentSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    const { batchId, quantity, reason, adjustedSerials } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify Batch & Stock
      const batch = await tx.batch.findUnique({
        where: { id: batchId },
        include: { importInvoiceLine: true },
      });
      
      if (!batch) throw new Error("Batch not found.");
      if (batch.quantityRemaining < quantity) {
        throw new Error(
          `Insufficient stock. Only ${batch.quantityRemaining} unit(s) remaining in this batch.`
        );
      }

      // 2. Serialized Burn Logic
      if (batch.importInvoiceLine?.isSerialised) {
        if (adjustedSerials.length !== quantity) {
          throw new Error(`Expected ${quantity} serial number(s) but got ${adjustedSerials.length}.`);
        }
        
        const snRecords = await tx.serialNumber.findMany({
          where: { serial: { in: adjustedSerials }, importInvoiceLineId: batch.importInvoiceLineId },
        });
        
        for (const sn of snRecords) {
          if (sn.isSold || sn.isReturned || sn.isAdjusted) {
            throw new Error(`Serial number "${sn.serial}" is no longer available in the warehouse.`);
          }
        }
        
        // Burn the SNs by marking them adjusted and logging the reason
        await tx.serialNumber.updateMany({
          where: { serial: { in: adjustedSerials } },
          data: {
            isAdjusted: true,
            adjustmentReason: reason,
          },
        });
      }

      // 3. Deduct Inventory (Batch & Product only)
      await tx.batch.update({
        where: { id: batchId },
        data: { quantityRemaining: { decrement: quantity } },
      });

      await tx.product.update({
        where: { id: batch.productId },
        data: { stockBalance: { decrement: quantity } },
      });
      // NOTE: We intentionally do NOT touch ImportInvoiceLine.quantitySold or isLocked here.
      // Adjustments are pure write-offs, not sales. Only SalesInvoiceLine / QuickSale
      // transitions affect the sold-quantity tracker and row-lock status.

      // 4. Financial Loss Logging
      // The exact actual purchase price is pulled to record the true cost basis of the loss
      const purchasePriceSnapshot = parseFloat(batch.purchasePrice);
      const financialLoss = purchasePriceSnapshot * quantity;

      // 5. Create the Adjustment Record
      const adjustment = await tx.inventoryAdjustment.create({
        data: {
          batchId,
          quantity,
          reason,
          purchasePriceSnapshot,
          financialLoss,
          adjustedSerials: JSON.stringify(adjustedSerials),
        },
        include: {
          batch: {
            include: { product: true },
          },
        },
      });

      return { adjustment };
    });

    revalidatePath("/", "layout");
    return { success: true,
      message: "Inventory adjustment executed successfully. Financial loss logged.",
      ...result,
    };
  } catch (error) {
    console.error("executeInventoryAdjustment error:", error);
    return { success: false, message: error.message || "Failed to execute inventory adjustment." };
  }
}

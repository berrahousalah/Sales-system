"use server";

import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function checkAndUnlockBatchRow(tx, batchId) {
  const batch = await tx.batch.findUnique({
    where: { id: batchId },
    include: { importInvoiceLine: true },
  });
  if (!batch || !batch.importInvoiceLine) return;

  const salesLinesQty = await tx.salesInvoiceLine.aggregate({
    where: { batchId },
    _sum: { quantity: true },
  });
  const quickSalesQty = await tx.quickSale.aggregate({
    where: { batchId, isReturned: false },
    _sum: { quantity: true },
  });

  const totalSold = (salesLinesQty._sum.quantity || 0) + (quickSalesQty._sum.quantity || 0);

  if (totalSold === 0) {
    await tx.importInvoiceLine.update({
      where: { id: batch.importInvoiceLineId },
      data: { isLocked: false, quantitySold: 0 },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTE QUICK SALE
// ─────────────────────────────────────────────────────────────────────────────

const ExecuteQuickSaleSchema = z.object({
  batchId: z.string().min(1, "Batch is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  sellingPrice: z.number().positive("Selling price must be positive"),
  soldSerials: z.array(z.string().trim().min(1)).optional().default([]),
});

export async function executeQuickSale(data) {
  try {
    const parsed = ExecuteQuickSaleSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    const { batchId, quantity, sellingPrice, soldSerials } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify batch stock
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

      // 2. Serialised Validation
      if (batch.importInvoiceLine?.isSerialised) {
        if (soldSerials.length !== quantity) {
          throw new Error(`Expected ${quantity} serial number(s) but got ${soldSerials.length}.`);
        }
        const snRecords = await tx.serialNumber.findMany({
          where: { serial: { in: soldSerials }, importInvoiceLineId: batch.importInvoiceLineId },
        });
        for (const sn of snRecords) {
          if (sn.isSold || sn.isReturned) {
            throw new Error(`Serial number "${sn.serial}" is no longer available.`);
          }
        }
        await tx.serialNumber.updateMany({
          where: { serial: { in: soldSerials } },
          data: { isSold: true },
        });
      }

      // 3. Deduct Inventory
      await tx.batch.update({
        where: { id: batchId },
        data: { quantityRemaining: { decrement: quantity } },
      });

      await tx.product.update({
        where: { id: batch.productId },
        data: { stockBalance: { decrement: quantity } },
      });

      await tx.importInvoiceLine.update({
        where: { id: batch.importInvoiceLineId },
        data: {
          quantitySold: { increment: quantity },
          isLocked: true,
        },
      });

      // 4. Record the Sale (Cash Only - totalAmount exactly equals (sellingPrice * quantity))
      const totalAmount = parseFloat(sellingPrice) * quantity;
      
      const sale = await tx.quickSale.create({
        data: {
          batchId,
          quantity,
          sellingPrice,
          totalAmount,
          purchasePriceSnapshot: batch.purchasePrice,
          soldSerials,
          saleDate: new Date(), // Locked to exact current moment
          isReturned: false,
        },
        include: { batch: { include: { product: true } } },
      });

      return { sale };
    });

    return { success: true, message: "Direct POS sale executed successfully.", ...result };
  } catch (error) {
    console.error("executeQuickSale error:", error);
    return { success: false, message: error.message || "Failed to execute sale." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RETURN QUICK SALE
// ─────────────────────────────────────────────────────────────────────────────

export async function returnQuickSale(saleId) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.quickSale.findUnique({
        where: { id: saleId },
        include: { batch: { include: { importInvoiceLine: true } } },
      });
      if (!sale) throw new Error("Sale record not found.");
      if (sale.isReturned) throw new Error("This sale has already been returned.");

      const { quantity, batchId, batch, soldSerials } = sale;

      // Restore serial numbers
      if (soldSerials.length > 0) {
        await tx.serialNumber.updateMany({
          where: { serial: { in: soldSerials } },
          data: { isSold: false },
        });
      }

      // Restore inventory
      await tx.batch.update({
        where: { id: batchId },
        data: { quantityRemaining: { increment: quantity } },
      });

      await tx.product.update({
        where: { id: batch.productId },
        data: { stockBalance: { increment: quantity } },
      });

      await tx.importInvoiceLine.update({
        where: { id: batch.importInvoiceLineId },
        data: { quantitySold: { decrement: quantity } },
      });

      // Mark as returned (purge from active UI, retain for DB audit)
      await tx.quickSale.update({
        where: { id: saleId },
        data: { isReturned: true },
      });

      // Zero-State Unlock Trigger
      await checkAndUnlockBatchRow(tx, batchId);

      return { success: true };
    });

    return { success: true, message: "Item returned. Inventory and financials reversed.", ...result };
  } catch (error) {
    console.error("returnQuickSale error:", error);
    return { success: false, message: error.message || "Failed to process return." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HISTORY (Last 12 months)
// ─────────────────────────────────────────────────────────────────────────────

export async function getQuickSalesHistory() {
  try {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const sales = await prisma.quickSale.findMany({
      where: {
        isReturned: false,
        saleDate: { gte: twelveMonthsAgo },
      },
      include: { batch: { include: { product: true } } },
      orderBy: { saleDate: "desc" },
    });
    return { success: true, sales };
  } catch (error) {
    return { success: false, message: "Failed to fetch quick sales history." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH (by product name or serial number)
// ─────────────────────────────────────────────────────────────────────────────

export async function searchQuickSales(query) {
  try {
    const term = query.trim();
    if (!term) return await getQuickSalesHistory();

    const sales = await prisma.quickSale.findMany({
      where: {
        isReturned: false,
        OR: [
          { batch: { product: { name: { contains: term, mode: "insensitive" } } } },
          { soldSerials: { has: term } },
        ],
      },
      include: { batch: { include: { product: true } } },
      orderBy: { saleDate: "desc" },
    });

    return { success: true, sales };
  } catch (error) {
    return { success: false, message: "Search failed." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FOR POS TERMINAL (re-used from sales invoice actions but exported here)
// ─────────────────────────────────────────────────────────────────────────────

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

export async function getAvailableBatchesForProduct(productId) {
  try {
    const batches = await prisma.batch.findMany({
      where: { productId, quantityRemaining: { gt: 0 } },
      select: {
        id: true,
        quantityRemaining: true,
        retailPrice: true,
        importInvoiceLine: { select: { isSerialised: true } },
        supplier: { select: { name: true } },
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

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { serializeQuickSale, serializeProduct } from "@/lib/serialize";


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
          soldSerials: JSON.stringify(soldSerials),
          saleDate: new Date(), // Locked to exact current moment
          isReturned: false,
        },
        include: { batch: { include: { product: true } } },
      });

      return { sale };
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Direct POS sale executed successfully.", ...result };
  } catch (error) {
    console.error("executeQuickSale error:", error);
    return { success: false, message: error.message || "Failed to execute sale." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RETURN QUICK SALE
// ─────────────────────────────────────────────────────────────────────────────
const ReturnQuickSaleSchema = z.string().min(1, "Sale ID is required");

export async function returnQuickSale(saleId) {
  try {
    const parsed = ReturnQuickSaleSchema.safeParse(saleId);
    if (!parsed.success) throw new Error(parsed.error.errors[0].message);
    const validSaleId = parsed.data;

    await prisma.$transaction(async (tx) => {
      const sale = await tx.quickSale.findUnique({
        where: { id: validSaleId },
        include: { batch: { include: { importInvoiceLine: true } } },
      });
      if (!sale) throw new Error("Sale record not found.");
      if (sale.isReturned) throw new Error("This sale has already been returned.");

      const { quantity, batchId, batch, soldSerials } = sale;

      // Restore serial numbers
      let serialsToRestore = [];
      if (typeof sale.soldSerials === 'string') {
        try {
          serialsToRestore = JSON.parse(sale.soldSerials);
        } catch (e) {
          serialsToRestore = sale.soldSerials ? [sale.soldSerials] : [];
        }
      } else if (Array.isArray(sale.soldSerials)) {
        serialsToRestore = sale.soldSerials;
      }

      if (Array.isArray(serialsToRestore) && serialsToRestore.length > 0) {
        await tx.serialNumber.updateMany({
          where: { serial: { in: serialsToRestore } },
          data: { isSold: false }
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
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Item returned. Inventory and financials reversed." };
  } catch (error) {
    console.error("returnQuickSale error:", error);
    return { success: false, message: error.message || "Failed to process return." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT QUICK SALE
// ─────────────────────────────────────────────────────────────────────────────
const EditQuickSaleSchema = z.object({
  saleId: z.string().min(1, "Sale ID is required"),
  quantity: z.number().int().positive("Quantity must be greater than zero"),
  sellingPrice: z.number().nonnegative("Selling price cannot be negative"),
  soldSerials: z.array(z.string()).default([]),
});

export async function editQuickSale(data) {
  try {
    const parsed = EditQuickSaleSchema.safeParse(data);
    if (!parsed.success) throw new Error(parsed.error.errors[0].message);
    const { saleId, quantity, sellingPrice, soldSerials } = parsed.data;
    
    await prisma.$transaction(async (tx) => {
      const sale = await tx.quickSale.findUnique({
        where: { id: saleId },
        include: { batch: { include: { importInvoiceLine: true } } },
      });
      if (!sale) throw new Error("Quick sale not found.");
      if (sale.isReturned) throw new Error("Cannot edit a returned sale.");

      const oldQty = sale.quantity;
      const delta = quantity - oldQty;
      const batch = sale.batch;

      if (delta > 0) {
        throw new Error("Cannot increase quantity of an existing quick sale. Please ring up a new sale.");
      }

      // Handle serial numbers
      if (batch.importInvoiceLine?.isSerialised && delta < 0) {
        let oldSerialsList = [];
        if (typeof sale.soldSerials === 'string') {
          try { oldSerialsList = JSON.parse(sale.soldSerials); } 
          catch (e) { oldSerialsList = sale.soldSerials ? [sale.soldSerials] : []; }
        } else if (Array.isArray(sale.soldSerials)) {
          oldSerialsList = sale.soldSerials;
        }

        const serialsToReturn = oldSerialsList.filter(s => !soldSerials.includes(s));
        if (serialsToReturn.length !== Math.abs(delta)) {
          throw new Error(`Please select exactly ${Math.abs(delta)} serial number(s) to remove.`);
        }
        
        if (serialsToReturn.length > 0) {
          await tx.serialNumber.updateMany({
            where: { serial: { in: serialsToReturn } },
            data: { isSold: false },
          });
        }
      }

      if (delta < 0) {
        const absDelta = Math.abs(delta);
        await tx.batch.update({
          where: { id: batch.id },
          data: { quantityRemaining: { increment: absDelta } },
        });
        await tx.product.update({
          where: { id: batch.productId },
          data: { stockBalance: { increment: absDelta } },
        });
        await tx.importInvoiceLine.update({
          where: { id: batch.importInvoiceLineId },
          data: { quantitySold: { decrement: absDelta } },
        });
        
        await checkAndUnlockBatchRow(tx, batch.id);
      }

      const safeSellingPrice = parseFloat(sellingPrice) || 0;
      const totalAmount = quantity * safeSellingPrice;

      await tx.quickSale.update({
        where: { id: saleId },
        data: {
          quantity,
          sellingPrice: safeSellingPrice,
          totalAmount,
          soldSerials: batch.importInvoiceLine?.isSerialised ? JSON.stringify(soldSerials) : "",
        },
      });
    });

    revalidatePath("/quick-sales");
    return { success: true, message: "Sale updated successfully." };
  } catch (error) {
    console.error("editQuickSale error:", error);
    return { success: false, message: error.message || "Failed to update sale." };
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
      include: { batch: { include: { product: true, importInvoiceLine: true } } },
      orderBy: { saleDate: "desc" },
    });
    return { success: true, sales: sales.map(serializeQuickSale) };
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

    // SQLite-compatible search: contains (maps to LIKE) is case-insensitive for ASCII by default.
    // soldSerials is stored as a JSON string — substring match catches serial numbers within the array.
    const sales = await prisma.quickSale.findMany({
      where: {
        isReturned: false,
        OR: [
          { batch: { product: { name: { contains: term } } } },
          { soldSerials: { contains: term } },
        ],
      },
      include: { batch: { include: { product: true, importInvoiceLine: true } } },
      orderBy: { saleDate: "desc" },
    });
    return { success: true, sales: sales.map(serializeQuickSale) };
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

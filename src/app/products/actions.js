"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";


// Zod Schema for validation
const ProductSchema = z.object({
  name: z.string().min(1, "Product name is required").trim(),
});

/**
 * Creates a new Product
 */
export async function createProduct(formData) {
  try {
    const rawData = {
      name: formData.get("name"),
    };

    // Sanitize and Validate
    const parsed = ProductSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.errors[0].message,
      };
    }

    const { name } = parsed.data;

    // Insert Product (Stock Balance defaults to 0 as per schema)
    const newProduct = await prisma.product.create({
      data: {
        name,
      },
    });

    revalidatePath("/", "layout");
    return { success: true,
      message: "Product created successfully",
      product: newProduct,
    };
  } catch (error) {
    console.error("Failed to create product:", error);
    return {
      success: false,
      message: "Database error: Failed to create product",
    };
  }
}

/**
 * Retrieves all active (non-archived) Products
 */
export async function getProducts() {
  try {
    const products = await prisma.product.findMany({
      where: {
        isArchived: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return { success: true, products };
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return { success: false, message: "Database error: Failed to fetch products" };
  }
}

/**
 * Soft deletes or Hard deletes a product based on historical batch references
 */
export async function deleteProduct(productId) {
  try {
    if (!productId) {
      return { success: false, message: "Product ID is required" };
    }

    // Check if product has historical batches (Import Invoices)
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { batches: true },
    });

    if (!product) {
      return { success: false, message: "Product not found" };
    }

    // If references exist, soft delete (Archive)
    if (product.batches && product.batches.length > 0) {
      await prisma.product.update({
        where: { id: productId },
        data: { isArchived: true },
      });
      revalidatePath("/", "layout");
    return { success: true,
        message: "Product archived because it has historical batches.",
        archived: true,
      };
    }

    // Otherwise, hard delete
    await prisma.product.delete({
      where: { id: productId },
    });

    revalidatePath("/", "layout");
    return { success: true,
      message: "Product permanently deleted.",
      archived: false,
    };
  } catch (error) {
    console.error("Failed to delete product:", error);
    return {
      success: false,
      message: "Database error: Failed to delete product",
    };
  }
}

/**
 * Retrieves independent batches for a specific product
 */
export async function getProductBatches(productId) {
  try {
    if (!productId) {
      return { success: false, message: "Product ID is required" };
    }

    const batches = await prisma.batch.findMany({
      where: { productId },
      include: {
        supplier: { select: { id: true, name: true } },
        importInvoiceLine: {
          select: {
            importInvoice: { select: { invoiceNumber: true } },
          },
        },
      },
      orderBy: { entryDate: "desc" },
    });

    // Serialize Decimal fields to plain numbers to avoid serialization boundary issues
    const serialized = batches.map((b) => ({
      id: b.id,
      supplierId: b.supplierId,
      supplierName: b.supplier?.name ?? "Unknown",
      invoiceNumber: b.importInvoiceLine?.importInvoice?.invoiceNumber ?? "N/A",
      entryDate: b.entryDate.toISOString(),
      quantityReceived: b.quantityReceived,
      quantityRemaining: b.quantityRemaining,
      purchasePrice: parseFloat(b.purchasePrice),
      retailPrice: parseFloat(b.retailPrice),
    }));

    return { success: true, batches: serialized };
  } catch (error) {
    console.error("Failed to fetch product batches:", error);
    return { success: false, message: "Database error: Failed to fetch batches" };
  }
}

/**
 * Imports products from CSV and creates initial store stock batches
 */
export async function importProductsFromCsv(rows) {
  try {
    if (!rows || rows.length === 0) return { success: false, message: "No data provided." };

    await prisma.$transaction(async (tx) => {
      // 1. Ensure default system supplier exists
      const supplierName = "مخزون المحل الأولي";
      let supplier = await tx.supplier.findFirst({
        where: { name: { equals: supplierName } }
      });
      
      if (!supplier) {
        supplier = await tx.supplier.create({
          data: {
            name: supplierName,
            contactPhone: "",
            contactEmail: "",
            totalDebt: 0,
          }
        });
      }

      // 2. Process each row
      for (const row of rows) {
        const { name, quantity, purchasePrice, retailPrice } = row;
        if (!name) continue; // Skip empty rows

        const parsedQty = parseInt(quantity, 10) || 0;
        const parsedPurchase = parseFloat(purchasePrice) || 0;
        const parsedRetail = parseFloat(retailPrice) || 0;

        // Find or create product
        let product = await tx.product.findFirst({ where: { name } });
        if (!product) {
          product = await tx.product.create({ data: { name, stockBalance: 0 } });
        }

        if (parsedQty > 0) {
          // Increment stock
          await tx.product.update({
            where: { id: product.id },
            data: { stockBalance: { increment: parsedQty } }
          });

          // Create initial batch linked to the system supplier
          await tx.batch.create({
            data: {
              productId: product.id,
              supplierId: supplier.id,
              quantityReceived: parsedQty,
              quantityRemaining: parsedQty,
              purchasePrice: parsedPurchase,
              retailPrice: parsedRetail,
            }
          });
        }
      }
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Products imported successfully." };
  } catch (error) {
    console.error("Failed to import CSV:", error);
    return { success: false, message: "Failed to import products from CSV." };
  }
}

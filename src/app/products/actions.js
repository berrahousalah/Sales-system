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
      orderBy: { entryDate: "desc" },
    });
    return { success: true, batches };
  } catch (error) {
    console.error("Failed to fetch product batches:", error);
    return { success: false, message: "Database error: Failed to fetch batches" };
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const newProduct = await prisma.product.create({
      data: {
        name: "Test Product",
      },
    });
    console.log("Success:", newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
  } finally {
    await prisma.$disconnect();
  }
}
main();

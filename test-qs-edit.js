const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    // find a quick sale
    const qs = await prisma.quickSale.findFirst({
       where: { isReturned: false },
       include: { batch: { include: { importInvoiceLine: true } } }
    });
    if (!qs) {
       console.log("No quick sale found");
       return;
    }
    console.log("Found QS:", qs.id, "Qty:", qs.quantity, "Serials:", qs.soldSerials);

    // simulate editQuickSale
    const data = {
       saleId: qs.id,
       quantity: qs.quantity - 1,
       sellingPrice: qs.sellingPrice,
       soldSerials: qs.soldSerials ? JSON.parse(qs.soldSerials).slice(1) : []
    };
    
    // Call the same code as editQuickSale
    const { saleId, quantity, sellingPrice, soldSerials } = data;
    
    if (quantity <= 0) throw new Error("Quantity must be greater than zero.");
    
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

        const returningSerials = oldSerialsList.filter(s => !soldSerials.includes(s));
        if (returningSerials.length !== Math.abs(delta)) {
          throw new Error(`Please select exactly ${Math.abs(delta)} serial number(s) to remove. (Got ${returningSerials.length})`);
        }
        
        if (returningSerials.length > 0) {
          await tx.serialNumber.updateMany({
            where: { serial: { in: returningSerials } },
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
      }

      const totalAmount = quantity * sellingPrice;
      const profit = totalAmount - (quantity * parseFloat(sale.purchasePriceSnapshot));

      await tx.quickSale.update({
        where: { id: saleId },
        data: {
          quantity,
          sellingPrice,
          totalAmount,
          profit,
          soldSerials: batch.importInvoiceLine?.isSerialised ? JSON.stringify(soldSerials) : "",
        },
      });
    });

    console.log("Success!");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();

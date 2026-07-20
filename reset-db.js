const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('Starting database reset...');

  // Delete in reverse dependency order to respect foreign key constraints
  const deleted = {};

  deleted.TransactionLedger = await prisma.transactionLedger.deleteMany({});
  console.log('Cleared TransactionLedger:', deleted.TransactionLedger.count);

  deleted.MonthlyFinancialReport = await prisma.monthlyFinancialReport.deleteMany({});
  console.log('Cleared MonthlyFinancialReport:', deleted.MonthlyFinancialReport.count);

  deleted.InventoryAdjustment = await prisma.inventoryAdjustment.deleteMany({});
  console.log('Cleared InventoryAdjustment:', deleted.InventoryAdjustment.count);

  deleted.QuickSale = await prisma.quickSale.deleteMany({});
  console.log('Cleared QuickSale:', deleted.QuickSale.count);

  deleted.SalesInvoiceLine = await prisma.salesInvoiceLine.deleteMany({});
  console.log('Cleared SalesInvoiceLine:', deleted.SalesInvoiceLine.count);

  deleted.SalesInvoice = await prisma.salesInvoice.deleteMany({});
  console.log('Cleared SalesInvoice:', deleted.SalesInvoice.count);

  deleted.SupplierReturn = await prisma.supplierReturn.deleteMany({});
  console.log('Cleared SupplierReturn:', deleted.SupplierReturn.count);

  deleted.Batch = await prisma.batch.deleteMany({});
  console.log('Cleared Batch:', deleted.Batch.count);

  deleted.SerialNumber = await prisma.serialNumber.deleteMany({});
  console.log('Cleared SerialNumber:', deleted.SerialNumber.count);

  deleted.ImportInvoiceLine = await prisma.importInvoiceLine.deleteMany({});
  console.log('Cleared ImportInvoiceLine:', deleted.ImportInvoiceLine.count);

  deleted.ImportInvoice = await prisma.importInvoice.deleteMany({});
  console.log('Cleared ImportInvoice:', deleted.ImportInvoice.count);

  deleted.Customer = await prisma.customer.deleteMany({});
  console.log('Cleared Customer:', deleted.Customer.count);

  deleted.Supplier = await prisma.supplier.deleteMany({});
  console.log('Cleared Supplier:', deleted.Supplier.count);

  deleted.Product = await prisma.product.deleteMany({});
  console.log('Cleared Product:', deleted.Product.count);

  console.log('\n=== DATABASE RESET COMPLETE ===');
  console.log('All transactional data wiped. Schema and structure preserved.');
  console.log('System is at absolute zero state. Ready for clean testing.');

  await prisma.$disconnect();
}

resetDatabase().catch((e) => {
  console.error('Reset failed:', e.message);
  process.exit(1);
});

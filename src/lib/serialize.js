/**
 * Serialization utilities for Prisma objects.
 *
 * Prisma returns Decimal objects for @db.Decimal fields.
 * These cannot be passed directly from Server Components to Client Components
 * because Next.js serializes props as JSON, and Decimal is not a standard JSON type.
 *
 * These helpers convert all Decimal fields to plain JavaScript numbers.
 */

/** Convert a single Decimal-or-number-or-string value to a float */
export function toFloat(val) {
  if (val === null || val === undefined) return 0;
  return parseFloat(val.toString());
}

/** Serialize a Supplier record */
export function serializeSupplier(s) {
  return {
    id: s.id,
    name: s.name,
    totalDebt: toFloat(s.totalDebt),
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
  };
}

/** Serialize a Customer record */
export function serializeCustomer(c) {
  return {
    id: c.id,
    name: c.name,
    totalDebt: toFloat(c.totalDebt),
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  };
}

/** Serialize an ImportInvoice (with optional supplier + lines) */
export function serializeImportInvoice(inv) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    supplierId: inv.supplierId,
    invoiceDate: inv.invoiceDate instanceof Date ? inv.invoiceDate.toISOString() : inv.invoiceDate,
    transportationCost: toFloat(inv.transportationCost),
    totalAmount: toFloat(inv.totalAmount),
    amountPaid: toFloat(inv.amountPaid),
    debtBalance: toFloat(inv.debtBalance),
    status: inv.status,
    isHeaderLocked: inv.isHeaderLocked,
    createdAt: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
    updatedAt: inv.updatedAt instanceof Date ? inv.updatedAt.toISOString() : inv.updatedAt,
    supplier: inv.supplier ? serializeSupplier(inv.supplier) : undefined,
    lines: inv.lines ? inv.lines.map(serializeImportInvoiceLine) : undefined,
  };
}

/** Serialize an ImportInvoiceLine */
export function serializeImportInvoiceLine(line) {
  return {
    id: line.id,
    importInvoiceId: line.importInvoiceId,
    productId: line.productId,
    quantity: line.quantity,
    quantitySold: line.quantitySold,
    purchasePrice: toFloat(line.purchasePrice),
    retailPrice: toFloat(line.retailPrice),
    isSerialised: line.isSerialised,
    isLocked: line.isLocked,
    product: line.product
      ? { id: line.product.id, name: line.product.name, stockBalance: line.product.stockBalance, isArchived: line.product.isArchived }
      : undefined,
    serialNumbers: line.serialNumbers
      ? line.serialNumbers.map((sn) => ({
          id: sn.id,
          serial: sn.serial,
          importInvoiceLineId: sn.importInvoiceLineId,
          isSold: sn.isSold,
          isReturned: sn.isReturned,
          isAdjusted: sn.isAdjusted,
          adjustmentReason: sn.adjustmentReason,
          createdAt: sn.createdAt instanceof Date ? sn.createdAt.toISOString() : sn.createdAt,
        }))
      : undefined,
    batch: line.batch ? serializeBatch(line.batch) : undefined,
  };
}

/** Serialize a Batch record */
export function serializeBatch(b) {
  return {
    id: b.id,
    productId: b.productId,
    supplierId: b.supplierId,
    importInvoiceLineId: b.importInvoiceLineId,
    quantityReceived: b.quantityReceived,
    quantityRemaining: b.quantityRemaining,
    purchasePrice: toFloat(b.purchasePrice),
    retailPrice: toFloat(b.retailPrice),
    entryDate: b.entryDate instanceof Date ? b.entryDate.toISOString() : b.entryDate,
    product: b.product
      ? { id: b.product.id, name: b.product.name, stockBalance: b.product.stockBalance }
      : undefined,
    supplier: b.supplier ? { id: b.supplier.id, name: b.supplier.name } : undefined,
    importInvoiceLine: b.importInvoiceLine
      ? serializeImportInvoiceLine(b.importInvoiceLine)
      : undefined,
  };
}

/** Serialize a SalesInvoice (with optional customer + lines) */
export function serializeSalesInvoice(inv) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    customerId: inv.customerId,
    invoiceDate: inv.invoiceDate instanceof Date ? inv.invoiceDate.toISOString() : inv.invoiceDate,
    deliveryCost: toFloat(inv.deliveryCost),
    totalAmount: toFloat(inv.totalAmount),
    amountPaid: toFloat(inv.amountPaid),
    debtBalance: toFloat(inv.debtBalance),
    status: inv.status,
    isHeaderLocked: inv.isHeaderLocked,
    createdAt: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
    updatedAt: inv.updatedAt instanceof Date ? inv.updatedAt.toISOString() : inv.updatedAt,
    customer: inv.customer ? serializeCustomer(inv.customer) : undefined,
    lines: inv.lines ? inv.lines.map(serializeSalesInvoiceLine) : undefined,
  };
}

/** Serialize a SalesInvoiceLine */
export function serializeSalesInvoiceLine(line) {
  return {
    id: line.id,
    salesInvoiceId: line.salesInvoiceId,
    batchId: line.batchId,
    quantity: line.quantity,
    sellingPrice: toFloat(line.sellingPrice),
    purchasePriceSnapshot: toFloat(line.purchasePriceSnapshot),
    soldSerials: line.soldSerials ?? [],
    batch: line.batch ? {
      id: line.batch.id,
      quantityRemaining: line.batch.quantityRemaining,
      retailPrice: toFloat(line.batch.retailPrice),
      importInvoiceLineId: line.batch.importInvoiceLineId,
      importInvoiceLine: line.batch.importInvoiceLine
        ? { isSerialised: line.batch.importInvoiceLine.isSerialised }
        : undefined,
      product: line.batch.product
        ? { id: line.batch.product.id, name: line.batch.product.name }
        : undefined,
      supplier: line.batch.supplier
        ? { name: line.batch.supplier.name }
        : undefined,
    } : undefined,
  };
}

/** Serialize a QuickSale record */
export function serializeQuickSale(qs) {
  return {
    id: qs.id,
    batchId: qs.batchId,
    quantity: qs.quantity,
    sellingPrice: toFloat(qs.sellingPrice),
    totalAmount: toFloat(qs.totalAmount),
    purchasePriceSnapshot: toFloat(qs.purchasePriceSnapshot),
    soldSerials: qs.soldSerials ?? [],
    saleDate: qs.saleDate instanceof Date ? qs.saleDate.toISOString() : qs.saleDate,
    isReturned: qs.isReturned,
    batch: qs.batch
      ? {
          id: qs.batch.id,
          productId: qs.batch.productId,
          product: qs.batch.product
            ? { id: qs.batch.product.id, name: qs.batch.product.name }
            : undefined,
        }
      : undefined,
  };
}

/** Serialize a Product record */
export function serializeProduct(p) {
  return {
    id: p.id,
    name: p.name,
    stockBalance: p.stockBalance,
    isArchived: p.isArchived,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
  };
}

/** Serialize an InventoryAdjustment record */
export function serializeInventoryAdjustment(adj) {
  return {
    id: adj.id,
    batchId: adj.batchId,
    quantity: adj.quantity,
    reason: adj.reason,
    purchasePriceSnapshot: toFloat(adj.purchasePriceSnapshot),
    financialLoss: toFloat(adj.financialLoss),
    adjustedSerials: adj.adjustedSerials ?? [],
    createdAt: adj.createdAt instanceof Date ? adj.createdAt.toISOString() : adj.createdAt,
    batch: adj.batch
      ? {
          id: adj.batch.id,
          purchasePrice: toFloat(adj.batch.purchasePrice),
          retailPrice: toFloat(adj.batch.retailPrice),
          quantityRemaining: adj.batch.quantityRemaining,
          product: adj.batch.product
            ? { id: adj.batch.product.id, name: adj.batch.product.name }
            : undefined,
          supplier: adj.batch.supplier
            ? { id: adj.batch.supplier.id, name: adj.batch.supplier.name }
            : undefined,
          importInvoiceLine: adj.batch.importInvoiceLine
            ? { isSerialised: adj.batch.importInvoiceLine.isSerialised }
            : undefined,
        }
      : undefined,
  };
}

/** Serialize a MonthlyFinancialReport record */
export function serializeMonthlyFinancialReport(report) {
  return {
    closingMonthId: report.closingMonthId,
    totalRevenue: toFloat(report.totalRevenue),
    totalCOGS: toFloat(report.totalCOGS),
    totalLogisticsExpenses: toFloat(report.totalLogisticsExpenses),
    totalAdjustmentLosses: toFloat(report.totalAdjustmentLosses),
    finalNetProfit: toFloat(report.finalNetProfit),
    closedAt: report.closedAt instanceof Date ? report.closedAt.toISOString() : report.closedAt,
  };
}


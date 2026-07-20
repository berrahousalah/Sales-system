const fs = require('fs');

// 1. Update Import Invoices Backend
let importActions = fs.readFileSync('src/app/import-invoices/actions.js', 'utf8');
importActions = importActions.replace(
  'const invoice = await tx.importInvoice.findUnique({ where: { id: invoiceId } });',
  'const invoice = await tx.importInvoice.findUnique({ where: { id: invoiceId }, include: { lines: true } });'
);
importActions = importActions.replace(
  'const oldDebt = parseFloat(invoice.debtBalance);',
  const oldDebt = parseFloat(invoice.debtBalance);
      
      const linesTotal = invoice.lines.reduce((sum, l) => sum + (parseFloat(l.purchasePrice) * l.quantity), 0);
      const computedTotal = linesTotal + deliveryCost;
      if (amountPaid > computedTotal) {
        throw new Error("Paid amount cannot exceed total invoice value.");
      }
);
// In import invoices, deliveryCost is called transportationCost. Let me double check what variable name is used.

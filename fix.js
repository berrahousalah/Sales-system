const fs = require('fs');

function fixFile(filePath, type) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix writes
  if (type === 'sales') {
    content = content.replace(/soldSerials:\s*soldSerials(?!,)/g, 'soldSerials: JSON.stringify(soldSerials)');
    content = content.replace(/soldSerials:\s*soldSerials,/g, 'soldSerials: JSON.stringify(soldSerials),');
    content = content.replace(/soldSerials:\s*newSoldSerials/g, 'soldSerials: JSON.stringify(newSoldSerials)');
    // Fix reads
    content = content.replace(/line\.soldSerials(?!\.)/g, '(typeof line.soldSerials === \'string\' ? JSON.parse(line.soldSerials || \'[]\') : (line.soldSerials || []))');
    content = content.replace(/line\.soldSerials\.slice/g, '(typeof line.soldSerials === \'string\' ? JSON.parse(line.soldSerials || \'[]\') : (line.soldSerials || [])).slice');
  }

  if (type === 'quick') {
    content = content.replace(/soldSerials:\s*soldSerials(?!,)/g, 'soldSerials: JSON.stringify(soldSerials)');
    content = content.replace(/soldSerials:\s*soldSerials,/g, 'soldSerials: JSON.stringify(soldSerials),');
    content = content.replace(/sale\.soldSerials/g, '(typeof sale.soldSerials === \'string\' ? JSON.parse(sale.soldSerials || \'[]\') : (sale.soldSerials || []))');
    content = content.replace(/qs\.soldSerials/g, '(typeof qs.soldSerials === \'string\' ? JSON.parse(qs.soldSerials || \'[]\') : (qs.soldSerials || []))');
  }

  if (type === 'returns') {
    content = content.replace(/returnedSerials,\n/g, 'returnedSerials: JSON.stringify(returnedSerials),\n');
    content = content.replace(/returnedSerials: returnedSerials,/g, 'returnedSerials: JSON.stringify(returnedSerials),');
  }

  if (type === 'adjustments') {
    content = content.replace(/adjustedSerials:\s*adjustedSerials(?!,)/g, 'adjustedSerials: JSON.stringify(adjustedSerials)');
    content = content.replace(/adjustedSerials:\s*adjustedSerials,/g, 'adjustedSerials: JSON.stringify(adjustedSerials),');
  }

  fs.writeFileSync(filePath, content);
}

fixFile('src/app/sales-invoices/actions.js', 'sales');
fixFile('src/app/quick-sales/actions.js', 'quick');
fixFile('src/app/supplier-returns/actions.js', 'returns');
fixFile('src/app/inventory-adjustments/actions.js', 'adjustments');

// Also fix serialize.js
let serializeContent = fs.readFileSync('src/lib/serialize.js', 'utf8');
serializeContent = serializeContent.replace(/line\.soldSerials \?\? \[\]/g, 'typeof line.soldSerials === \'string\' ? JSON.parse(line.soldSerials || \'[]\') : (line.soldSerials || [])');
serializeContent = serializeContent.replace(/qs\.soldSerials \?\? \[\]/g, 'typeof qs.soldSerials === \'string\' ? JSON.parse(qs.soldSerials || \'[]\') : (qs.soldSerials || [])');
serializeContent = serializeContent.replace(/adj\.adjustedSerials \?\? \[\]/g, 'typeof adj.adjustedSerials === \'string\' ? JSON.parse(adj.adjustedSerials || \'[]\') : (adj.adjustedSerials || [])');
serializeContent = serializeContent.replace(/ret\.returnedSerials \?\? \[\]/g, 'typeof ret.returnedSerials === \'string\' ? JSON.parse(ret.returnedSerials || \'[]\') : (ret.returnedSerials || [])');
fs.writeFileSync('src/lib/serialize.js', serializeContent);


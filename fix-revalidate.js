const fs = require('fs');
const path = require('path');

const actionFiles = [
  'src/app/customers/actions.js',
  'src/app/financials/actions.js',
  'src/app/import-invoices/actions.js',
  'src/app/inventory-adjustments/actions.js',
  'src/app/products/actions.js',
  'src/app/quick-sales/actions.js',
  'src/app/sales-invoices/actions.js',
  'src/app/supplier-returns/actions.js',
  'src/app/suppliers/actions.js',
];

// These function name prefixes are READ-ONLY — they must never call revalidatePath
const READ_PREFIXES = ['get', 'search', 'fetch', 'find', 'list'];

function isReadFunction(funcName) {
  return READ_PREFIXES.some(prefix => funcName.startsWith(prefix));
}

actionFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Split into function blocks by locating `export async function <name>`
  // We'll process the string and track which function we're in
  const funcPattern = /export async function (\w+)/g;
  let match;
  const funcPositions = [];

  while ((match = funcPattern.exec(content)) !== null) {
    funcPositions.push({ name: match[1], start: match.index });
  }

  // For each read function, find its body range and strip revalidatePath calls
  let modified = content;
  let removedCount = 0;

  // Process in reverse so indices stay valid
  for (let i = funcPositions.length - 1; i >= 0; i--) {
    const { name, start } = funcPositions[i];
    const end = i + 1 < funcPositions.length ? funcPositions[i + 1].start : content.length;

    if (isReadFunction(name)) {
      const before = modified.slice(0, start);
      let funcBody = modified.slice(start, end);

      // Remove all revalidatePath lines within this function body
      const originalLen = funcBody.length;
      funcBody = funcBody.replace(/\s*revalidatePath\([^)]+\);\s*\n(\s*)/g, '\n$1');
      
      if (funcBody.length !== originalLen) {
        removedCount++;
      }

      modified = before + funcBody + modified.slice(end);
    }
  }

  fs.writeFileSync(filePath, modified, 'utf8');
  console.log(`${filePath}: removed revalidatePath from ${removedCount} read function(s)`);
});

console.log('\nDone! revalidatePath now only exists in mutation/write actions.');

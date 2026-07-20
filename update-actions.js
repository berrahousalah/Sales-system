const fs = require('fs');

const files = [
  'src/app/customers/actions.js',
  'src/app/financials/actions.js',
  'src/app/import-invoices/actions.js',
  'src/app/inventory-adjustments/actions.js',
  'src/app/products/actions.js',
  'src/app/quick-sales/actions.js',
  'src/app/sales-invoices/actions.js',
  'src/app/supplier-returns/actions.js',
  'src/app/suppliers/actions.js'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('revalidatePath')) {
    content = content.replace(/"use server";\s*/, '"use server";\n\nimport { revalidatePath } from "next/cache";\n');
  }

  // Remove existing revalidatePath additions if any to avoid duplicates
  content = content.replace(/revalidatePath\("\/",\s*"layout"\);\s*return\s*\{\s*success:\s*true/g, 'return { success: true');

  // Insert revalidatePath before return { success: true
  content = content.replace(/return\s*\{\s*success:\s*true/g, 'revalidatePath("/", "layout");\n    return { success: true');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated ' + file);
});

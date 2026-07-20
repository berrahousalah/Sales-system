const fs = require('fs');

const pages = [
  'src/app/customers/page.js',
  'src/app/financials/page.js',
  'src/app/import-invoices/page.js',
  'src/app/inventory-adjustments/page.js',
  'src/app/products/page.js',
  'src/app/quick-sales/page.js',
  'src/app/sales-invoices/page.js',
  'src/app/supplier-returns/page.js',
  'src/app/suppliers/page.js'
];

pages.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('import Link from "next/link"')) {
    content = content.replace(/import /, 'import Link from "next/link";\nimport ');
  }
  if (!content.includes('ArrowLeft')) {
    content = content.replace(/from "lucide-react";/, ', ArrowLeft } from "lucide-react";');
    content = content.replace(/\{ /, '{ ArrowLeft, ');
  }

  const linkStr = `
            <Link href="/" className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors" title="Back to Dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>`;
            
  if (!content.includes('Back to Dashboard')) {
    content = content.replace(/(<div className="w-12 h-12 bg-[a-z0-9-]+ rounded-xl flex items-center justify-center)/, linkStr + '\n            $1');
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated ' + file);
});

import { getImportInvoiceById, getProducts } from "../actions";
import InvoiceDetail from "./InvoiceDetail";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }) {
  const p = await params;
  return { title: `Invoice ${p.id} | ERP System` };
}

export default async function ImportInvoicePage({ params }) {
  const p = await params;
  const [invoiceResult, productsResult] = await Promise.all([
    getImportInvoiceById(p.id),
    getProducts(),
  ]);

  if (!invoiceResult.success) notFound();

  return (
    <InvoiceDetail
      invoice={invoiceResult.invoice}
      products={productsResult.success ? productsResult.products : []}
    />
  );
}

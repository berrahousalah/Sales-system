import { getImportInvoiceById, getProducts } from "../actions";
import InvoiceDetail from "./InvoiceDetail";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }) {
  return { title: `Invoice ${params.id} | ERP System` };
}

export default async function ImportInvoicePage({ params }) {
  const [invoiceResult, productsResult] = await Promise.all([
    getImportInvoiceById(params.id),
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

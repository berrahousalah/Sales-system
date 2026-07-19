import { getSalesInvoiceById, getProducts } from "../actions";
import SalesInvoiceDetail from "./SalesInvoiceDetail";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }) {
  return { title: `Sales Invoice ${params.id} | ERP System` };
}

export default async function SalesInvoicePage({ params }) {
  const [invoiceResult, productsResult] = await Promise.all([
    getSalesInvoiceById(params.id),
    getProducts(),
  ]);

  if (!invoiceResult.success) notFound();

  return (
    <SalesInvoiceDetail
      invoice={invoiceResult.invoice}
      products={productsResult.success ? productsResult.products : []}
    />
  );
}

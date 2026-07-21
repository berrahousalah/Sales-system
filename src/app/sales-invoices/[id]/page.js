import { getSalesInvoiceById, getProducts } from "../actions";
import SalesInvoiceDetail from "./SalesInvoiceDetail";
import { notFound } from "next/navigation";

export async function generateMetadata(props) {
  const params = await props.params;
  return { title: `Sales Invoice ${params.id} | ERP System` };
}

export default async function SalesInvoicePage(props) {
  const params = await props.params;
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

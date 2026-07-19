import { getCustomers } from "../actions";
import NewSalesInvoiceForm from "./NewSalesInvoiceForm";

export const metadata = {
  title: "New Sales Invoice | ERP System",
};

export default async function NewSalesInvoicePage() {
  const result = await getCustomers();
  const customers = result.success ? result.customers : [];

  return <NewSalesInvoiceForm customers={customers} />;
}

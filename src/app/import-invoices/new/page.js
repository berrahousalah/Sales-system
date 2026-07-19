import { getSuppliers } from "../actions";
import NewInvoiceForm from "./NewInvoiceForm";

export const metadata = {
  title: "New Import Invoice | ERP System",
};

export default async function NewImportInvoicePage() {
  const result = await getSuppliers();
  const suppliers = result.success ? result.suppliers : [];

  return <NewInvoiceForm suppliers={suppliers} />;
}

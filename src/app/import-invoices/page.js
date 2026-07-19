import Link from "next/link";
import { getImportInvoices } from "./actions";
import InvoicesListClient from "./InvoicesListClient";
import { FileText, Plus } from "lucide-react";

export const metadata = {
  title: "Import Invoices | ERP System",
  description: "Manage supplier import invoices and procurement records.",
};

export default async function ImportInvoicesPage() {
  const result = await getImportInvoices();
  const invoices = result.success ? result.invoices : [];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Import Invoices</h1>
              <p className="text-sm text-gray-500 mt-1">
                Procurement records, batch inventory, and supplier debt management
              </p>
            </div>
          </div>
          <Link
            href="/import-invoices/new"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors shrink-0"
          >
            <Plus className="w-5 h-5" />
            New Invoice
          </Link>
        </div>

        {!result.success && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            <span className="font-semibold">Error:</span> {result.message}
          </div>
        )}

        <InvoicesListClient invoices={invoices} />
      </div>
    </div>
  );
}

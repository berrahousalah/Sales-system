import Link from "next/link";
import { getSalesInvoices } from "./actions";
import SalesInvoicesListClient from "./SalesInvoicesListClient";
import { FileText, Plus } from "lucide-react";

export const metadata = {
  title: "Sales Invoices | ERP System",
  description: "Manage customer sales invoices and debt tracking.",
};

export default async function SalesInvoicesPage() {
  const result = await getSalesInvoices();
  const invoices = result.success ? result.invoices : [];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sales Invoices</h1>
              <p className="text-sm text-gray-500 mt-1">
                Formal sales orders, pay-on-delivery tracking, and customer debt ledger
              </p>
            </div>
          </div>
          <Link
            href="/sales-invoices/new"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shrink-0"
          >
            <Plus className="w-5 h-5" />
            New Sales Invoice
          </Link>
        </div>

        {!result.success && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            <span className="font-semibold">Error:</span> {result.message}
          </div>
        )}

        <SalesInvoicesListClient invoices={invoices} />
      </div>
    </div>
  );
}

import Link from "next/link";
import { getImportInvoices } from "./actions";
import InvoicesListClient from "./InvoicesListClient";
import { FileText, Plus, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Factures d'Importation | ERP TechnoLink",
  description: "Gérer les factures fournisseurs et les enregistrements d'achats.",
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
            
            <Link href="/" className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors" title="Back to Dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Factures d'Importation</h1>
              <p className="text-sm text-gray-700 font-medium mt-1">
                Achats fournisseurs, gestion des lots et des dettes
              </p>
            </div>
          </div>
          <Link
            href="/import-invoices/new"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors shrink-0"
          >
            <Plus className="w-5 h-5" />
            Nouvelle Facture
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

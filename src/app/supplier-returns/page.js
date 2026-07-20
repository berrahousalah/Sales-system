import Link from "next/link";
import { getAvailableStockByBatch } from "./actions";
import SupplierReturnsClient from "./SupplierReturnsClient";
import { RotateCcw, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Supplier Returns | ERP System",
  description: "Return stock to suppliers by batch with automatic invoice and debt reconciliation.",
};

export default async function SupplierReturnsPage() {
  const result = await getAvailableStockByBatch();
  const batches = result.success ? result.batches : [];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            
            <Link href="/" className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors" title="Back to Dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-white">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Supplier Returns</h1>
              <p className="text-sm text-gray-500 mt-1">
                Return stock to suppliers by batch — automatically reconciles invoice totals and supplier debt
              </p>
            </div>
          </div>
        </div>

        {!result.success && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            <span className="font-semibold">Error:</span> {result.message}
          </div>
        )}

        <SupplierReturnsClient batches={batches} />
      </div>
    </div>
  );
}

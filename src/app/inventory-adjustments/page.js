import Link from "next/link";
import { getInventoryAdjustments, getProducts } from "./actions";
import InventoryAdjustmentsClient from "./InventoryAdjustmentsClient";
import { SlidersHorizontal, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Inventory Adjustments | ERP System",
  description: "Write off inventory discrepancies and log operating losses.",
};

export default async function InventoryAdjustmentsPage() {
  const [historyResult, productsResult] = await Promise.all([
    getInventoryAdjustments(),
    getProducts(),
  ]);

  const history = historyResult.success ? historyResult.adjustments : [];
  const products = productsResult.success ? productsResult.products : [];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            
            <Link href="/" className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors" title="Back to Dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center text-white">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Inventory Adjustments</h1>
              <p className="text-sm text-gray-500 mt-1">
                Reconcile physical stock discrepancies and log operational losses.
              </p>
            </div>
          </div>
        </div>

        {(!historyResult.success || !productsResult.success) && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            <span className="font-semibold">Error loading data.</span> Please try refreshing.
          </div>
        )}

        <InventoryAdjustmentsClient history={history} products={products} />
      </div>
    </div>
  );
}

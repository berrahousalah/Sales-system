import { getQuickSalesHistory, getProducts } from "./actions";
import QuickSalesClient from "./QuickSalesClient";
import { Zap } from "lucide-react";

export const metadata = {
  title: "Quick Sales POS | ERP System",
  description: "Direct over-the-counter sales with no customer tracking.",
};

export default async function QuickSalesPage() {
  const [historyResult, productsResult] = await Promise.all([
    getQuickSalesHistory(),
    getProducts(),
  ]);

  const history = historyResult.success ? historyResult.sales : [];
  const products = productsResult.success ? productsResult.products : [];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-pink-500 rounded-xl flex items-center justify-center text-white">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Quick Sales POS</h1>
              <p className="text-sm text-gray-500 mt-1">
                Over-the-counter direct cash sales. No customer profiles, no debt.
              </p>
            </div>
          </div>
        </div>

        {(!historyResult.success || !productsResult.success) && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            <span className="font-semibold">Error loading data.</span> Please try refreshing.
          </div>
        )}

        <QuickSalesClient history={history} products={products} />
      </div>
    </div>
  );
}

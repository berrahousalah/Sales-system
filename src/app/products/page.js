import Link from "next/link";
import { getProducts } from "./actions";
import ProductsTable from "./components/ProductsTable";
import ProductForm from "./components/ProductForm";
import CsvImportModal from "./components/CsvImportModal";
import { Package, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Gestion des Produits | ERP TechnoLink",
  description: "Gérer les définitions des produits et le stock.",
};

export default async function ProductsPage() {
  // Fetch active products on the server side
  const result = await getProducts();
  const initialProducts = result.success ? result.products : [];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            
            <Link href="/" className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors" title="Back to Dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-inner text-white">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestion des Produits</h1>
              <p className="text-sm text-gray-700 font-medium mt-1">Source unique de vérité pour tout le stock</p>
            </div>
          </div>
          
          <div className="shrink-0 flex items-center gap-2">
            <CsvImportModal />
            <ProductForm />
          </div>
        </div>

        {/* Global Error Banner if DB fetch failed */}
        {!result.success && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <span className="font-semibold text-sm">Erreur lors du chargement des produits :</span> 
            <span className="text-sm font-medium">{result.message}</span>
          </div>
        )}

        {/* Data Table */}
        <ProductsTable initialProducts={initialProducts} />

      </div>
    </div>
  );
}

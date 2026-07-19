import { getSuppliers } from "./actions";
import SuppliersTable from "./components/SuppliersTable";
import SupplierForm from "./components/SupplierForm";
import { Users } from "lucide-react";

export const metadata = {
  title: "Suppliers Management | ERP System",
  description: "Manage supplier profiles and outstanding debts.",
};

export default async function SuppliersPage() {
  // Fetch suppliers on the server side
  const result = await getSuppliers();
  const initialSuppliers = result.success ? result.suppliers : [];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-inner text-white">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Suppliers Management</h1>
              <p className="text-sm text-gray-500 mt-1">Manage supplier profiles and track aggregate debts</p>
            </div>
          </div>
          
          <div className="shrink-0">
            <SupplierForm />
          </div>
        </div>

        {/* Global Error Banner if DB fetch failed */}
        {!result.success && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <span className="font-semibold text-sm">Failed to load suppliers:</span> 
            <span className="text-sm">{result.message}</span>
          </div>
        )}

        {/* Data Table */}
        <SuppliersTable initialSuppliers={initialSuppliers} />

      </div>
    </div>
  );
}

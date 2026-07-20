import Link from "next/link";
import { getCustomers } from "./actions";
import CustomersTable from "./components/CustomersTable";
import CustomerForm from "./components/CustomerForm";
import { Users, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Customers Management | ERP System",
  description: "Manage customer profiles and track accounts receivable.",
};

export default async function CustomersPage() {
  const result = await getCustomers();
  const initialCustomers = result.success ? result.customers : [];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            
            <Link href="/" className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors" title="Back to Dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-inner text-white">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Customers Management
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage customer profiles and track accounts receivable
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <CustomerForm />
          </div>
        </div>

        {/* Error banner */}
        {!result.success && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <span className="font-semibold text-sm">Failed to load customers:</span>
            <span className="text-sm">{result.message}</span>
          </div>
        )}

        {/* Data table */}
        <CustomersTable initialCustomers={initialCustomers} />

      </div>
    </div>
  );
}

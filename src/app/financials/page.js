import Link from "next/link";
import { getArchivedMonths } from "./actions";
import FinancialsClient from "./FinancialsClient";
import { Landmark, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Finances & Rapports | ERP TechnoLink",
  description: "Rapports en temps réel et clôtures comptables mensuelles.",
};

export default async function FinancialsPage() {
  const archiveResult = await getArchivedMonths();
  const archives = archiveResult.success ? archiveResult.reports : [];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            
            <Link href="/" className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors" title="Back to Dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Finances & Rapports</h1>
              <p className="text-sm text-gray-700 font-medium mt-1">
                Agrégats en temps réel et clôtures de fin de mois immuables.
              </p>
            </div>
          </div>
        </div>

        {!archiveResult.success && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            <span className="font-semibold">Erreur de chargement des archives financières.</span> Veuillez actualiser.
          </div>
        )}

        <FinancialsClient archives={archives} />
      </div>
    </div>
  );
}

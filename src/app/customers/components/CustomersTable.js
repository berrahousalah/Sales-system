"use client";

import { useState } from "react";
import { Users, HandCoins, Trash2, SlidersHorizontal, Loader2, AlertCircle } from "lucide-react";
import CollectDebtModal from "./CollectDebtModal";
import AdjustDebtModal from "./AdjustDebtModal";
import { deleteCustomer } from "../actions";
import { useRouter } from "next/navigation";

export default function CustomersTable({ initialCustomers }) {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedCustomerForAdjust, setSelectedCustomerForAdjust] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const router = useRouter();

  const handleDelete = async (customer) => {
    const totalDebt = parseFloat(customer.totalDebt);
    if (totalDebt > 0) return;

    if (!confirm(`Supprimer le client "${customer.name}" ? Cette action est irréversible.`)) return;

    setDeletingId(customer.id);
    setDeleteError("");
    const result = await deleteCustomer(customer.id);
    if (result.success) {
      router.refresh();
    } else {
      setDeleteError(result.message);
    }
    setDeletingId(null);
  };

  if (initialCustomers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-indigo-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">Aucun client trouvé</h3>
        <p className="text-gray-700 font-medium text-center max-w-sm">
          Commencez par créer votre premier client. Les clients doivent être enregistrés avant de créer des factures de vente.
        </p>
      </div>
    );
  }

  return (
    <>
      {deleteError && (
        <div className="flex items-start gap-2 mt-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {deleteError}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Nom du Client</th>
                <th className="px-6 py-4 font-semibold text-right">Dette Restante</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {initialCustomers.map((customer) => {
                const totalDebt = parseFloat(customer.totalDebt);
                const hasDebt = totalDebt > 0;
                const isDeleting = deletingId === customer.id;

                return (
                  <tr key={customer.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold shrink-0">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        {customer.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          hasDebt
                            ? "bg-amber-50 text-amber-700 border border-amber-100"
                            : "bg-green-50 text-green-700 border border-green-100"
                        }`}
                      >
                        {totalDebt.toFixed(2)} DZD
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Adjust Debt */}
                        <button
                          onClick={() => setSelectedCustomerForAdjust(customer)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md transition-colors font-medium text-xs"
                          title="Ajuster manuellement la dette"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          Ajuster la Dette
                        </button>

                        {/* Collect Debt */}
                        <button
                          onClick={() => setSelectedCustomer(customer)}
                          disabled={!hasDebt}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md transition-colors font-medium text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                          title={hasDebt ? "Encaisser la dette (FIFO)" : "Aucune dette en cours"}
                        >
                          <HandCoins className="w-3.5 h-3.5" />
                          Encaisser
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(customer)}
                          disabled={hasDebt || isDeleting}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-md transition-colors font-medium text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                          title={hasDebt ? "Impossible de supprimer : dette existante" : "Supprimer le client"}
                        >
                          {isDeleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCustomer && (
        <CollectDebtModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      {selectedCustomerForAdjust && (
        <AdjustDebtModal
          customer={selectedCustomerForAdjust}
          onClose={() => setSelectedCustomerForAdjust(null)}
        />
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { Users, Banknote, Trash2, SlidersHorizontal, Loader2, AlertCircle } from "lucide-react";
import PayDebtModal from "./PayDebtModal";
import AdjustDebtModal from "./AdjustDebtModal";
import { deleteSupplier } from "../actions";
import { useRouter } from "next/navigation";

export default function SuppliersTable({ initialSuppliers }) {
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState(null);
  const [selectedSupplierForAdjust, setSelectedSupplierForAdjust] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const router = useRouter();

  const handleDelete = async (supplier) => {
    const totalDebt = parseFloat(supplier.totalDebt);
    if (totalDebt > 0) return; // button is disabled, but guard anyway

    if (!confirm(`Delete supplier "${supplier.name}"? This action cannot be undone.`)) return;

    setDeletingId(supplier.id);
    setDeleteError("");
    const result = await deleteSupplier(supplier.id);
    if (result.success) {
      router.refresh();
    } else {
      setDeleteError(result.message);
    }
    setDeletingId(null);
  };

  if (initialSuppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-blue-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No suppliers found</h3>
        <p className="text-gray-500 text-center max-w-sm">
          Get started by creating your first supplier. Suppliers must be registered before creating import invoices.
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
                <th className="px-6 py-4 font-semibold">Supplier Name</th>
                <th className="px-6 py-4 font-semibold text-right">Outstanding Debt</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {initialSuppliers.map((supplier) => {
                const totalDebt = parseFloat(supplier.totalDebt);
                const hasDebt = totalDebt > 0;
                const isDeleting = deletingId === supplier.id;

                return (
                  <tr key={supplier.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold shrink-0">
                          {supplier.name.charAt(0).toUpperCase()}
                        </div>
                        {supplier.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        hasDebt ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'
                      }`}>
                        ${totalDebt.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Adjust Debt */}
                        <button
                          onClick={() => setSelectedSupplierForAdjust(supplier)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md transition-colors font-medium text-xs"
                          title="Manually adjust debt balance"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          Adjust Debt
                        </button>

                        {/* Pay Debt */}
                        <button
                          onClick={() => setSelectedSupplierForPayment(supplier)}
                          disabled={!hasDebt}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md transition-colors font-medium text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                          title={hasDebt ? "Pay Debt (FIFO)" : "No outstanding debt"}
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          Pay Debt
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(supplier)}
                          disabled={hasDebt || isDeleting}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-md transition-colors font-medium text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                          title={hasDebt ? "Cannot delete: outstanding debt exists" : "Delete supplier"}
                        >
                          {isDeleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Delete
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

      {selectedSupplierForPayment && (
        <PayDebtModal
          supplier={selectedSupplierForPayment}
          onClose={() => setSelectedSupplierForPayment(null)}
        />
      )}

      {selectedSupplierForAdjust && (
        <AdjustDebtModal
          supplier={selectedSupplierForAdjust}
          onClose={() => setSelectedSupplierForAdjust(null)}
        />
      )}
    </>
  );
}

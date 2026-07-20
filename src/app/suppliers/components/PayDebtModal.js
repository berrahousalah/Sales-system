"use client";

import { useState } from "react";
import { X, Loader2, DollarSign } from "lucide-react";
import { paySupplierDebt } from "../actions";
import { useRouter } from "next/navigation";

export default function PayDebtModal({ supplier, onClose }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const router = useRouter();

  const totalDebt = parseFloat(supplier.totalDebt);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const paymentAmount = parseFloat(amount);

    // Frontend overpayment prevention guardrail
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    if (paymentAmount > totalDebt) {
      setError(`Payment amount ($${paymentAmount.toFixed(2)}) cannot exceed total outstanding debt ($${totalDebt.toFixed(2)}).`);
      return;
    }

    setIsPending(true);
    const result = await paySupplierDebt(supplier.id, paymentAmount.toString());

    if (result.success) {
      alert(result.message);
      onClose();
      router.refresh();
    } else {
      setError(result.message);
    }
    setIsPending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Pay Supplier Debt</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 font-medium">{supplier.name}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-blue-600">Total Outstanding Debt:</span>
              <span className="text-xl font-bold text-blue-700">
                ${totalDebt.toFixed(2)}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
              Payment Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="w-4 h-4 text-gray-400" />
              </div>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={totalDebt}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Payments are automatically allocated using the FIFO rule (oldest invoices first).
            </p>
          </div>

          <div className="flex justify-end pt-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !amount || parseFloat(amount) > totalDebt}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Confirm Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

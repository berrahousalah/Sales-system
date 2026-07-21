"use client";

import { useState } from "react";
import { X, Loader2, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { adjustSupplierDebt } from "../actions";
import { useRouter } from "next/navigation";

export default function AdjustDebtModal({ supplier, onClose }) {
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("add"); // "add" | "reduce"
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }

    setIsPending(true);
    const delta = direction === "add" ? parsed : -parsed;
    const result = await adjustSupplierDebt(supplier.id, delta.toString());

    if (result.success) {
      setSuccess(result.message);
      router.refresh();
      setTimeout(onClose, 1500);
    } else {
      setError(result.message);
    }
    setIsPending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Adjust Debt Balance</h2>
            <p className="text-sm text-gray-500 mt-0.5">{supplier.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current balance */}
        <div className="px-5 pt-4">
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 text-sm flex justify-between">
            <span className="text-gray-500">Current Outstanding Debt</span>
            <span className={`font-semibold ${parseFloat(supplier.totalDebt) > 0 ? "text-red-600" : "text-green-600"}`}>
              ${parseFloat(supplier.totalDebt).toFixed(2)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-100 text-green-700 rounded-lg text-sm">
              {success}
            </div>
          )}

          {/* Direction toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Adjustment Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection("add")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  direction === "add"
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Add Debt
              </button>
              <button
                type="button"
                onClick={() => setDirection("reduce")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  direction === "reduce"
                    ? "bg-green-50 border-green-300 text-green-700"
                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                Reduce Debt
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">
              This is a manual adjustment and does not allocate against specific invoices.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Apply Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

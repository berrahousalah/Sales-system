"use client";

import { useState, useEffect } from "react";
import { X, Loader2, RotateCcw, ScanLine } from "lucide-react";
import { processReturn } from "../actions";
import { useRouter } from "next/navigation";

export default function ReturnModal({ batch, onClose }) {
  const [quantityReturned, setQuantityReturned] = useState(1);
  const [returnedSerials, setReturnedSerials] = useState([""]);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const isSerialised = batch.importInvoiceLine.isSerialised;
  const availableSerials = batch.importInvoiceLine.serialNumbers.map((s) => s.serial);
  const maxQty = batch.quantityRemaining;
  const purchasePrice = parseFloat(batch.purchasePrice);
  const costPreview = purchasePrice * quantityReturned;

  // Keep returnedSerials array in sync with quantityReturned
  useEffect(() => {
    if (!isSerialised) return;
    setReturnedSerials((prev) =>
      Array.from({ length: quantityReturned }, (_, i) => prev[i] ?? "")
    );
  }, [quantityReturned, isSerialised]);

  const handleSerialChange = (index, value) => {
    setReturnedSerials((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (isSerialised) {
      const trimmed = returnedSerials.map((s) => s.trim());
      if (trimmed.some((s) => !s)) {
        setError("All serial number fields must be filled.");
        return;
      }
      // Validate against available serials
      for (const sn of trimmed) {
        if (!availableSerials.includes(sn)) {
          setError(`Serial "${sn}" is not in this batch or has already been sold/returned.`);
          return;
        }
      }
    }

    setIsPending(true);
    const result = await processReturn({
      importInvoiceLineId: batch.importInvoiceLine.id,
      quantityReturned: Number(quantityReturned),
      returnedSerials: isSerialised ? returnedSerials.map((s) => s.trim()) : [],
    });

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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-900">Process Supplier Return</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Batch Info */}
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Product:</span>
              <span className="font-medium text-gray-900">{batch.product.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Supplier:</span>
              <span className="font-medium">{batch.supplier.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice:</span>
              <span className="font-mono font-medium text-emerald-700">
                {batch.importInvoiceLine.importInvoice.invoiceNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Available Qty:</span>
              <span className="font-semibold text-gray-900">{maxQty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Purchase Price:</span>
              <span className="font-medium">${purchasePrice.toFixed(2)} / unit</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity to Return
            </label>
            <input
              type="number"
              min={1}
              max={maxQty}
              value={quantityReturned}
              onChange={(e) =>
                setQuantityReturned(
                  Math.min(maxQty, Math.max(1, parseInt(e.target.value) || 1))
                )
              }
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            />
          </div>

          {/* Cost preview */}
          <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
            <span className="text-gray-500">Cost to deduct from invoice & supplier debt:</span>
            <span className="font-bold text-orange-600">-${costPreview.toFixed(2)}</span>
          </div>

          {/* Serialised returns */}
          {isSerialised && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-orange-700">
                <ScanLine className="w-4 h-4" />
                Enter Serial Numbers to Return
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {returnedSerials.map((sn, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right shrink-0">{index + 1}.</span>
                    <select
                      value={sn}
                      onChange={(e) => handleSerialChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">— Select serial —</option>
                      {availableSerials
                        .filter(
                          (s) =>
                            !returnedSerials.includes(s) || s === sn
                        )
                        .map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
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
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Return
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

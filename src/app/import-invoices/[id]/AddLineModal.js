"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Loader2, ScanLine, Plus } from "lucide-react";
import { addLineToInvoice } from "../actions";

import { Combobox } from "@/components/ui/Combobox";

export default function AddLineModal({ invoiceId, products, onClose, onLineAdded }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [isSerialised, setIsSerialised] = useState(false);
  const [serials, setSerials] = useState([""]);

  const serialRefs = useRef([]);

  // Synchronise serials array length to quantity when serialised mode is on
  useEffect(() => {
    if (!isSerialised) return;
    setSerials((prev) => {
      const next = Array.from({ length: quantity }, (_, i) => prev[i] ?? "");
      return next;
    });
  }, [quantity, isSerialised]);

  // Auto-focus first empty serial input after toggling on
  useEffect(() => {
    if (isSerialised) {
      setTimeout(() => serialRefs.current[0]?.focus(), 50);
    }
  }, [isSerialised]);

  /**
   * POS auto-focus: when the user finishes scanning a serial (presses Enter or
   * the field value is non-empty), cursor jumps to the next empty input row.
   */
  const handleSerialKeyDown = useCallback(
    (e, index) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Move to next empty input row
        const nextEmpty = serials.findIndex((s, i) => i > index && s.trim() === "");
        const nextIndex = nextEmpty !== -1 ? nextEmpty : index + 1;
        if (nextIndex < serials.length) {
          serialRefs.current[nextIndex]?.focus();
        }
      }
    },
    [serials]
  );

  const handleSerialChange = (index, value) => {
    setSerials((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleToggleSerialised = (checked) => {
    setIsSerialised(checked);
    if (!checked) setSerials([""]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!productId) {
      setError("Please select a product.");
      return;
    }

    if (isSerialised) {
      const trimmed = serials.map((s) => s.trim());
      if (trimmed.some((s) => !s)) {
        setError("All serial number fields must be filled in.");
        return;
      }
    }

    setIsPending(true);

    const payload = {
      invoiceId,
      productId,
      quantity: Number(quantity),
      purchasePrice: parseFloat(purchasePrice),
      retailPrice: parseFloat(retailPrice),
      isSerialised,
      serials: isSerialised ? serials.map((s) => s.trim()) : [],
    };

    const result = await addLineToInvoice(payload);

    if (result.success) {
      onLineAdded();
      onClose();
    } else {
      setError(result.message);
    }

    setIsPending(false);
  };

  const filledCount = isSerialised ? serials.filter((s) => s.trim()).length : 0;
  
  const productOptions = products.map(p => ({ value: p.id, label: p.name }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mt-10 mb-10">
        {/* Modal header */}
        <div className="flex justify-between items-center p-5 border-b">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">Add Product to Invoice</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product <span className="text-red-500">*</span>
            </label>
            <Combobox
              options={productOptions}
              value={productId}
              onChange={setProductId}
              placeholder="— Select Product —"
              searchPlaceholder="Search products..."
              className="w-full"
            />
          </div>

          {/* Quantity, Purchase Price, Retail Price */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                required
                placeholder="0.00"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retail Price</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={retailPrice}
                onChange={(e) => setRetailPrice(e.target.value)}
                required
                placeholder="0.00"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
          </div>

          {/* Serialised Toggle */}
          <div className="flex items-center gap-3 py-3 border-t border-gray-100">
            <input
              id="serialised"
              type="checkbox"
              checked={isSerialised}
              onChange={(e) => handleToggleSerialised(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="serialised" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
              Individual Registration (Serial Numbers)
            </label>
          </div>

          {/* POS Serial Number Inputs */}
          {isSerialised && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                  <ScanLine className="w-4 h-4" />
                  Scan / Enter Serial Numbers
                </div>
                <span className="text-xs text-gray-400">
                  {filledCount}/{quantity} entered
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {serials.map((serial, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-6 text-right shrink-0">
                      {index + 1}.
                    </span>
                    <input
                      ref={(el) => (serialRefs.current[index] = el)}
                      type="text"
                      value={serial}
                      onChange={(e) => handleSerialChange(index, e.target.value)}
                      onKeyDown={(e) => handleSerialKeyDown(e, index)}
                      placeholder={`Serial #${index + 1}`}
                      className={`flex-1 px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors ${
                        serial.trim()
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-gray-300 bg-white"
                      }`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> after each scan to jump to the next field automatically.
              </p>
            </div>
          )}

          {/* Submit */}
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
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Add to Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Loader2, ScanLine, Plus, Package } from "lucide-react";
import { addLineToSalesInvoice, getAvailableBatchesForProduct, getAvailableSerialsForBatch } from "../actions";

export default function AddSalesLineModal({ invoiceId, products, onClose, onLineAdded }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  
  // Selections
  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  
  // Data loaded based on selections
  const [availableBatches, setAvailableBatches] = useState([]);
  const [availableSerials, setAvailableSerials] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingSerials, setLoadingSerials] = useState(false);

  // Form inputs
  const [quantity, setQuantity] = useState(1);
  const [sellingPrice, setSellingPrice] = useState("");
  const [serials, setSerials] = useState([""]);

  const serialRefs = useRef([]);

  const selectedBatch = availableBatches.find(b => b.id === batchId);
  const isSerialised = selectedBatch?.importInvoiceLine?.isSerialised || false;
  const maxQty = selectedBatch?.quantityRemaining || 1;

  // 1. Fetch batches when product changes
  useEffect(() => {
    if (!productId) {
      setAvailableBatches([]);
      setBatchId("");
      return;
    }
    
    setLoadingBatches(true);
    setBatchId("");
    getAvailableBatchesForProduct(productId).then(res => {
      if (res.success) {
        setAvailableBatches(res.batches);
      } else {
        setError(res.message);
      }
      setLoadingBatches(false);
    });
  }, [productId]);

  // 2. Fetch serials (if serialised) when batch changes
  useEffect(() => {
    if (!batchId) {
      setAvailableSerials([]);
      return;
    }

    const batch = availableBatches.find(b => b.id === batchId);
    setSellingPrice(batch ? parseFloat(batch.retailPrice).toFixed(2) : "");
    
    if (batch?.importInvoiceLine?.isSerialised) {
      setLoadingSerials(true);
      getAvailableSerialsForBatch(batchId).then(res => {
        if (res.success) {
          setAvailableSerials(res.serials);
        } else {
          setError(res.message);
        }
        setLoadingSerials(false);
      });
    } else {
      setAvailableSerials([]);
    }
  }, [batchId, availableBatches]);

  // 3. Synchronise serials array length to quantity when serialised
  useEffect(() => {
    if (!isSerialised) return;
    setSerials((prev) => {
      const next = Array.from({ length: quantity }, (_, i) => prev[i] ?? "");
      return next;
    });
  }, [quantity, isSerialised]);

  // 4. Auto-focus first empty serial input after toggling on
  useEffect(() => {
    if (isSerialised && serials.length > 0) {
      setTimeout(() => serialRefs.current[0]?.focus(), 50);
    }
  }, [isSerialised]);

  /**
   * POS auto-focus: when user presses Enter, check if serial is valid.
   * If valid, jump to next empty row.
   */
  const handleSerialKeyDown = useCallback(
    (e, index) => {
      if (e.key === "Enter") {
        e.preventDefault();
        
        const val = serials[index].trim();
        if (val && !availableSerials.includes(val)) {
          setError(`Serial "${val}" is not available in this batch.`);
          return;
        }
        setError("");

        // Move to next empty input row
        const nextEmpty = serials.findIndex((s, i) => i > index && s.trim() === "");
        const nextIndex = nextEmpty !== -1 ? nextEmpty : index + 1;
        if (nextIndex < serials.length) {
          serialRefs.current[nextIndex]?.focus();
        }
      }
    },
    [serials, availableSerials]
  );

  const handleSerialChange = (index, value) => {
    setSerials((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!productId || !batchId) {
      setError("Please select a product and a batch.");
      return;
    }

    if (quantity > maxQty) {
      setError(`Quantity cannot exceed available stock (${maxQty}).`);
      return;
    }

    if (isSerialised) {
      const trimmed = serials.map((s) => s.trim());
      if (trimmed.some((s) => !s)) {
        setError("All serial number fields must be filled in.");
        return;
      }
      
      // Verify against available serials
      for (const sn of trimmed) {
        if (!availableSerials.includes(sn)) {
          setError(`Serial "${sn}" is not available in this batch.`);
          return;
        }
      }
      
      // Check for duplicates in the current input list
      const unique = new Set(trimmed);
      if (unique.size !== trimmed.length) {
        setError("Duplicate serial numbers detected in your input.");
        return;
      }
    }

    setIsPending(true);

    const payload = {
      salesInvoiceId: invoiceId,
      batchId,
      quantity: Number(quantity),
      sellingPrice: parseFloat(sellingPrice),
      soldSerials: isSerialised ? serials.map((s) => s.trim()) : [],
    };

    const result = await addLineToSalesInvoice(payload);

    if (result.success) {
      onLineAdded();
      onClose();
    } else {
      setError(result.message);
    }

    setIsPending(false);
  };

  const filledCount = isSerialised ? serials.filter((s) => s.trim()).length : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mt-10 mb-10">
        {/* Modal header */}
        <div className="flex justify-between items-center p-5 border-b">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" />
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
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
            >
              <option value="">— Select Product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Selection (The Profit Engine) - Strictly hiding purchase price */}
          {productId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch <span className="text-red-500">*</span>
              </label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                required
                disabled={loadingBatches}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
              >
                <option value="">
                  {loadingBatches ? "Loading batches..." : "— Select Available Batch —"}
                </option>
                {availableBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Batch from {b.supplier.name} | Rem: {b.quantityRemaining} | Ret: ${parseFloat(b.retailPrice).toFixed(2)}
                  </option>
                ))}
              </select>
              {availableBatches.length === 0 && !loadingBatches && (
                <p className="mt-1 text-xs text-amber-600 font-medium flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" /> No available batches for this product.
                </p>
              )}
            </div>
          )}

          {/* Quantity, Selling Price */}
          {batchId && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity (Max: {maxQty})
                </label>
                <input
                  type="number"
                  min={1}
                  max={maxQty}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(maxQty, Math.max(1, parseInt(e.target.value) || 1)))}
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selling Price <span className="text-gray-400 text-xs font-normal">(Adjustable)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-indigo-700"
                />
              </div>
            </div>
          )}

          {/* POS Serial Number Inputs */}
          {batchId && isSerialised && (
            <div className="space-y-2 mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-indigo-700 font-medium">
                  <ScanLine className="w-4 h-4" />
                  Scan / Enter Serial Numbers
                  {loadingSerials && <Loader2 className="w-3 h-3 animate-spin inline ml-1" />}
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
                      className={`flex-1 px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                        serial.trim()
                          ? availableSerials.includes(serial.trim())
                            ? "border-green-300 bg-green-50 text-green-800"
                            : "border-red-300 bg-red-50 text-red-800" // Invalid serial indicator
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
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 mt-6">
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
              disabled={isPending || !batchId || (isSerialised && loadingSerials)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
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

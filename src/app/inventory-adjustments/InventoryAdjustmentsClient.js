"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Package, Search, SlidersHorizontal, AlertTriangle, Loader2, ScanLine, FileWarning
} from "lucide-react";
import {
  executeInventoryAdjustment,
  getAvailableBatchesForProduct,
  getAvailableSerialsForBatch
} from "./actions";
import { Combobox } from "@/components/ui/Combobox";

const REASONS = [
  { value: "DAMAGED", label: "Damaged / Broken / Expired" },
  { value: "LOST", label: "Lost / Theft / Shrinkage" },
  { value: "INTERNAL_USE", label: "Personal / Internal Use" },
  { value: "AUDIT_CORRECTION", label: "Audit Miscount Correction" }
];

export default function InventoryAdjustmentsClient({ history: initialHistory, products }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Ledger History
  const [history, setHistory] = useState(initialHistory);
  const [searchQuery, setSearchQuery] = useState("");

  // Form State
  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [serials, setSerials] = useState([""]);
  
  // Dynamic Data
  const [availableBatches, setAvailableBatches] = useState([]);
  const [availableSerials, setAvailableSerials] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingSerials, setLoadingSerials] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const serialRefs = useRef([]);

  const selectedBatch = availableBatches.find((b) => b.id === batchId);
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
    getAvailableBatchesForProduct(productId).then((res) => {
      if (res.success) setAvailableBatches(res.batches);
      setLoadingBatches(false);
    });
  }, [productId]);

  // 2. Fetch serials when batch changes
  useEffect(() => {
    if (!batchId) {
      setAvailableSerials([]);
      return;
    }
    const batch = availableBatches.find((b) => b.id === batchId);
    if (batch?.importInvoiceLine?.isSerialised) {
      setLoadingSerials(true);
      getAvailableSerialsForBatch(batchId).then((res) => {
        if (res.success) setAvailableSerials(res.serials);
        setLoadingSerials(false);
      });
    } else {
      setAvailableSerials([]);
    }
  }, [batchId, availableBatches]);

  // 3. Keep serial array length synced
  useEffect(() => {
    if (!isSerialised) return;
    setSerials((prev) => Array.from({ length: quantity }, (_, i) => prev[i] ?? ""));
  }, [quantity, isSerialised]);

  // POS Scanner Array Focus
  const handleSerialKeyDown = useCallback(
    (e, index) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const nextEmpty = serials.findIndex((s, i) => i > index && s.trim() === "");
        const nextIndex = nextEmpty !== -1 ? nextEmpty : index + 1;
        if (nextIndex < serials.length) serialRefs.current[nextIndex]?.focus();
      }
    },
    [serials]
  );

  const showMsg = (msg, isErr = false) => {
    if (isErr) { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
    setTimeout(() => { setError(""); setSuccess(""); }, 5000);
  };

  const handleExecuteAdjustment = async (e) => {
    e.preventDefault();
    if (!batchId) return showMsg("Veuillez sélectionner un lot.", true);
    if (!reason) return showMsg("Veuillez sélectionner un motif d'ajustement.", true);
    if (quantity > maxQty) return showMsg(`La quantité dépasse le stock (Max: ${maxQty}).`, true);
    
    if (isSerialised) {
      const trimmed = serials.map((s) => s.trim());
      if (trimmed.some((s) => !s)) return showMsg("Tous les champs de N/S doivent être remplis.", true);
      for (const sn of trimmed) {
        if (!availableSerials.includes(sn)) return showMsg(`Le N/S "${sn}" n'est pas disponible dans ce lot.`, true);
      }
      const unique = new Set(trimmed);
      if (unique.size !== trimmed.length) return showMsg("Numéros de série en double détectés.", true);
    }

    startTransition(async () => {
      try {
        const payload = {
          batchId,
          quantity: Number(quantity),
          reason,
          adjustedSerials: isSerialised ? serials.map((s) => s.trim()) : [],
        };
        
        const result = await executeInventoryAdjustment(payload);
        if (result.success) {
          showMsg(result.message || "Ajustement enregistré avec succès.");
          setProductId("");
          setBatchId("");
          setQuantity(1);
          setReason("");
          setSerials([""]);
          router.refresh();
        } else {
          showMsg(result.message || "L'ajustement a échoué.", true);
        }
      } catch (err) {
        console.error("Adjustment submit error:", err);
        showMsg("Une erreur inattendue s'est produite.", true);
      }
    });
  };

  // Basic client-side filtering for ledger
  const filteredHistory = history.filter((adj) => {
    const term = searchQuery.toLowerCase();
    return (
      adj.batch.product.name.toLowerCase().includes(term) ||
      adj.reason.toLowerCase().includes(term) ||
      adj.adjustedSerials.some((sn) => sn.toLowerCase().includes(term))
    );
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      
      {/* ── LEFT: ADJUSTMENT FORM ── */}
      <div className="xl:col-span-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-5">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-rose-50">
            <FileWarning className="w-5 h-5 text-rose-500" />
            <h2 className="font-bold text-gray-900">Nouvel Ajustement de Stock</h2>
          </div>

          <form onSubmit={handleExecuteAdjustment} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
            {success && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium">{success}</div>}

            {/* Product */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product <span className="text-red-500">*</span></label>
              <Combobox
                options={products.map((p) => ({ value: p.id, label: p.name }))}
                value={productId}
                onChange={setProductId}
                placeholder="— Select Product —"
                searchPlaceholder="Search products..."
                className="w-full"
              />
            </div>

            {/* Batch (Cost basis locator) */}
            {productId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Batch <span className="text-red-500">*</span></label>
                <Combobox
                  options={availableBatches.map((b) => ({
                    value: b.id,
                    label: `Rem: ${b.quantityRemaining} | Date: ${new Date(b.entryDate).toLocaleDateString()} (${b.supplier.name})`
                  }))}
                  value={batchId}
                  onChange={setBatchId}
                  placeholder={loadingBatches ? "Loading batches..." : "— Select Batch to Deduct —"}
                  searchPlaceholder="Search batches..."
                  disabled={loadingBatches || availableBatches.length === 0}
                  className="w-full"
                />
                {!loadingBatches && availableBatches.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">No stock available to adjust for this product.</p>
                )}
              </div>
            )}

            {batchId && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Qté (Max: {maxQty})</label>
                    <input
                      type="number"
                      min={1}
                      max={maxQty}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.min(maxQty, Math.max(1, parseInt(e.target.value)||1)))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                    />
                  </div>

                  {/* Reason Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Motif <span className="text-red-500">*</span></label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white"
                    >
                      <option value="">— Sélectionner —</option>
                      {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Serials */}
                {isSerialised && (
                  <div className="space-y-2 mt-2 p-3 bg-rose-50 rounded-lg border border-rose-100">
                    <div className="flex items-center text-sm font-medium text-rose-800 gap-1.5 mb-2">
                      <ScanLine className="w-4 h-4" /> Scanner les N/S à Invalider
                    </div>
                    <p className="text-xs text-rose-700 font-medium mb-2 leading-snug">
                      Ces N/S seront définitivement invalidés et marqués comme {reason || "ajustés"}.
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                      {serials.map((serial, index) => (
                        <input
                          key={index}
                          ref={(el) => (serialRefs.current[index] = el)}
                          type="text"
                          value={serial}
                          onChange={(e) => {
                            const next = [...serials];
                            next[index] = e.target.value;
                            setSerials(next);
                          }}
                          onKeyDown={(e) => handleSerialKeyDown(e, index)}
                          placeholder={`N/S #${index + 1}`}
                          className={`w-full px-3 py-1.5 border rounded-md text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                            serial.trim()
                              ? availableSerials.includes(serial.trim())
                                ? "border-green-300 bg-green-50 text-green-800"
                                : "border-red-300 bg-red-50 text-red-800"
                              : "border-gray-300 bg-white"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={isPending || !batchId || (isSerialised && loadingSerials)}
              className="w-full py-2.5 mt-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Exécuter l'Ajustement & Comptabiliser la Perte
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT: AUDIT LEDGER ── */}
      <div className="xl:col-span-8 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 h-full min-h-[500px]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b border-gray-100 pb-4">
            <div>
              <h2 className="font-bold text-gray-900">Journal des Ajustements</h2>
              <p className="text-xs text-gray-600 font-medium mt-0.5">Registre immuable de tous les ajustements de stock.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer produits, motifs..."
                className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-500 py-20">
              <SlidersHorizontal className="w-10 h-10 mb-2 text-gray-300" />
              <p className="text-sm font-medium">Aucun ajustement trouvé.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Produit</th>
                    <th className="px-4 py-3 font-semibold">Motif</th>
                    <th className="px-4 py-3 font-semibold text-right">Qté</th>
                    <th className="px-4 py-3 font-semibold text-right">Perte Financière</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredHistory.map((adj) => {
                    const reasonObj = REASONS.find(r => r.value === adj.reason);
                    
                    return (
                      <tr key={adj.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-4 text-gray-700 text-xs font-medium">
                          {new Date(adj.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-gray-900">{adj.batch.product.name}</div>
                          {adj.adjustedSerials.length > 0 && (
                            <div className="text-[10px] text-rose-600 font-mono mt-1 font-semibold bg-rose-50 inline-block px-1.5 py-0.5 rounded">
                              Invalidés: {adj.adjustedSerials.join(", ")}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                            {reasonObj ? reasonObj.label : adj.reason}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-medium">{adj.quantity}</td>
                        <td className="px-4 py-4 text-right font-bold text-rose-600">
                          {parseFloat(adj.financialLoss).toFixed(2)} DZD
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

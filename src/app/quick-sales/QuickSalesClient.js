"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Package, Search, Zap, RotateCcw, AlertTriangle, Loader2, ScanLine, DollarSign
} from "lucide-react";
import {
  executeQuickSale,
  returnQuickSale,
  searchQuickSales,
  getAvailableBatchesForProduct,
  getAvailableSerialsForBatch,
  editQuickSale
} from "./actions";
import { Combobox } from "@/components/ui/Combobox";
import ScanSerialRemoval from "@/components/ui/ScanSerialRemoval";
import { Edit2, X } from "lucide-react";

export default function QuickSalesClient({ history: initialHistory, products }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // History State
  const [history, setHistory] = useState(initialHistory);
  const [searchQuery, setSearchQuery] = useState("");
  const [returningId, setReturningId] = useState(null);

  // Edit State
  const [editingSale, setEditingSale] = useState(null);
  const [editQty, setEditQty] = useState(1);
  const [editPrice, setEditPrice] = useState("");
  const [editSerialsToRemove, setEditSerialsToRemove] = useState([]);

  // New Sale State
  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [sellingPrice, setSellingPrice] = useState("");
  const [serials, setSerials] = useState([""]);
  
  // Dependent loaded data
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
    setSellingPrice(batch ? parseFloat(batch.retailPrice).toFixed(2) : "");
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

  // POS Serial Keydown loop
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
    setTimeout(() => { setError(""); setSuccess(""); }, 4000);
  };

  // ── Execute Sale ────────────────────────────────────────────────────────
  const handleExecuteSale = async (e) => {
    e.preventDefault();
    if (!batchId) return showMsg("Veuillez sélectionner un lot.", true);
    if (quantity > maxQty) return showMsg("La quantité dépasse le stock disponible.", true);
    
    if (isSerialised) {
      const trimmed = serials.map((s) => s.trim());
      if (trimmed.some((s) => !s)) return showMsg("Tous les champs de N/S doivent être remplis.", true);
      for (const sn of trimmed) {
        if (!availableSerials.includes(sn)) return showMsg(`Le N/S "${sn}" n'est pas disponible.`, true);
      }
    }

    startTransition(async () => {
      const payload = {
        batchId,
        quantity: Number(quantity),
        sellingPrice: parseFloat(sellingPrice),
        soldSerials: isSerialised ? serials.map((s) => s.trim()) : [],
      };
      
      const result = await executeQuickSale(payload);
      if (result.success) {
        showMsg("Vente enregistrée avec succès !");
        setProductId("");
        setBatchId("");
        setQuantity(1);
        // Refresh history
        searchQuickSales(searchQuery).then(r => r.success && setHistory(r.sales));
        router.refresh();
      } else {
        showMsg(result.message, true);
      }
    });
  };

  // ── Return Sale ────────────────────────────────────────────────────────
  const handleReturn = async (saleId) => {
    if (!confirm("Retourner cet article ? Le stock sera immédiatement restauré.")) return;
    setReturningId(saleId);
    const result = await returnQuickSale(saleId);
    if (result.success) {
      showMsg("Retour traité avec succès.");
      setHistory(h => h.filter(s => s.id !== saleId));
      router.refresh();
      // If we are currently selecting the returned product's batch, reload batches
      if (productId) {
        getAvailableBatchesForProduct(productId).then(res => res.success && setAvailableBatches(res.batches));
      }
    } else {
      showMsg(result.message, true);
    }
    setReturningId(null);
  };

  // ── Edit Sale ──────────────────────────────────────────────────────────
  const openEditModal = (sale) => {
    setEditingSale(sale);
    setEditQty(sale.quantity);
    setEditPrice(parseFloat(sale.sellingPrice).toFixed(2));
    setEditSerialsToRemove([]);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (editQty <= 0) return showMsg("La quantité doit être supérieure à zéro.", true);
    
    const delta = editQty - editingSale.quantity;
    if (delta > 0) return showMsg("Impossible d'augmenter la quantité. Veuillez créer une nouvelle vente.", true);

    if (editingSale.batch.importInvoiceLine?.isSerialised && delta < 0) {
      if (editSerialsToRemove.length !== Math.abs(delta)) {
        return showMsg(`Veuillez sélectionner exactement ${Math.abs(delta)} N/S à retirer.`, true);
      }
    }

    startTransition(async () => {
      // old serials minus the ones we remove
      const remainingSerials = (editingSale.soldSerials || []).filter(s => !editSerialsToRemove.includes(s));
      const payload = {
        saleId: editingSale.id,
        quantity: editQty,
        sellingPrice: parseFloat(editPrice),
        soldSerials: remainingSerials,
      };

      const result = await editQuickSale(payload);
      if (result.success) {
        showMsg("Vente modifiée avec succès.");
        setEditingSale(null);
        searchQuickSales(searchQuery).then(r => r.success && setHistory(r.sales));
        router.refresh();
      } else {
        showMsg(result.message, true);
      }
    });
  };

  // ── Search History ──────────────────────────────────────────────────────
  const handleSearch = (e) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await searchQuickSales(searchQuery);
      if (result.success) setHistory(result.sales);
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* ── LEFT: NEW SALE POS ── */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-pink-200 p-5">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-pink-100">
            <Zap className="w-5 h-5 text-pink-500" />
            <h2 className="font-bold text-gray-900">Nouvelle Vente Directe</h2>
          </div>

          <form onSubmit={handleExecuteSale} className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium">{error}</div>}
            {success && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium">{success}</div>}

            {/* Product */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Produit</label>
              <Combobox
                options={products.map((p) => ({ value: p.id, label: p.name }))}
                value={productId}
                onChange={setProductId}
                placeholder="— Sélectionner un produit —"
                searchPlaceholder="Rechercher un produit..."
                className="w-full"
              />
            </div>

            {/* Batch (No purchase price) */}
            {productId && (
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Lot</label>
                <Combobox
                  options={availableBatches.map((b) => ({
                    value: b.id,
                    label: `Reste: ${b.quantityRemaining} | Prix: ${parseFloat(b.retailPrice).toFixed(2)} DZD (${b.supplier.name})`
                  }))}
                  value={batchId}
                  onChange={setBatchId}
                  placeholder={loadingBatches ? "Chargement..." : "— Sélectionner un lot —"}
                  searchPlaceholder="Rechercher un lot..."
                  disabled={loadingBatches || availableBatches.length === 0}
                  className="w-full"
                />
                {availableBatches.length === 0 && !loadingBatches && (
                  <p className="mt-1 text-xs text-amber-700 font-medium">Aucun stock disponible pour ce produit.</p>
                )}
              </div>
            )}

            {/* Qty & Price */}
            {batchId && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Qté (Max: {maxQty})</label>
                  <input
                    type="number"
                    min={1}
                    max={maxQty}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(maxQty, Math.max(1, parseInt(e.target.value)||1)))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium focus:ring-2 focus:ring-pink-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Prix de Vente (DZD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium focus:ring-2 focus:ring-pink-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Serials */}
            {batchId && isSerialised && (
              <div className="space-y-2 mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center text-sm font-medium text-gray-800 gap-1.5 mb-2">
                  <ScanLine className="w-4 h-4 text-pink-500" /> Scanner les N/S
                </div>
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
                      className={`w-full px-3 py-1.5 border rounded-md text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                        serial.trim()
                          ? availableSerials.includes(serial.trim())
                            ? "border-green-300 bg-green-50 text-green-800"
                            : "border-red-300 bg-red-50 text-red-800"
                          : "border-gray-300 bg-white text-gray-900"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Total Math */}
            {batchId && (
              <div className="p-3 bg-pink-50 text-pink-900 rounded-lg text-sm font-medium flex justify-between items-center">
                <span>Total à encaisser:</span>
                <span className="text-lg font-bold">
                  {(parseFloat(sellingPrice || 0) * quantity).toFixed(2)} DZD
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || !batchId || (isSerialised && loadingSerials)}
              className="w-full py-2.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Valider la Vente (Espèces)
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT: HISTORY LEDGER ── */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 h-full min-h-[500px]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b border-gray-100 pb-4">
            <h2 className="font-bold text-gray-900">Historique & Retours (12 mois)</h2>
            <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Produit ou N/S..."
                className="w-full sm:w-64 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-pink-500 outline-none"
              />
              <button
                type="submit"
                disabled={isPending}
                className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 text-sm font-medium"
              >
                Rechercher
              </button>
            </form>
          </div>

          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-500 py-20">
              <Package className="w-10 h-10 mb-2 text-gray-300" />
              <p className="text-sm font-medium">Aucune vente directe trouvée.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Produit</th>
                    <th className="px-4 py-3 font-semibold text-right">Qté</th>
                    <th className="px-4 py-3 font-semibold text-right">Montant</th>
                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-gray-700 text-xs font-medium">
                        {new Date(sale.saleDate).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{sale.batch.product.name}</div>
                        {sale.soldSerials.length > 0 && (
                          <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                            N/S: {sale.soldSerials.join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{sale.quantity}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {parseFloat(sale.totalAmount).toFixed(2)} DZD
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(sale)}
                            disabled={returningId === sale.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Modifier
                          </button>
                          <button
                            onClick={() => handleReturn(sale.id)}
                            disabled={returningId === sale.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {returningId === sale.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            Retourner
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* ── EDIT MODAL ── */}
      {editingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" /> Modifier la Vente
              </h3>
              <button onClick={() => setEditingSale(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Produit</label>
                <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-100">
                  {editingSale.batch.product.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Qté (Max: {editingSale.quantity})</label>
                  <input
                    type="number"
                    min={1}
                    max={editingSale.quantity}
                    value={editQty}
                    onChange={(e) => setEditQty(Math.min(editingSale.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Prix de Vente</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Serial Reduction Handling */}
              {editingSale.batch.importInvoiceLine?.isSerialised && editingSale.quantity - editQty > 0 && (
                <ScanSerialRemoval
                  originalSerials={editingSale.soldSerials}
                  selectedToRemove={editSerialsToRemove}
                  targetRemovalCount={editingSale.quantity - editQty}
                  onToggleRemove={(sn, isAdd) => setEditSerialsToRemove(prev => isAdd ? [...prev, sn] : prev.filter(s => s !== sn))}
                />
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending || (editingSale.batch.importInvoiceLine?.isSerialised && editingSale.quantity - editQty > 0 && editSerialsToRemove.length !== (editingSale.quantity - editQty))}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

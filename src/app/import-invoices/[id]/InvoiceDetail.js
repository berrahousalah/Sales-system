"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Lock, Unlock, Trash2, Save, Loader2, ChevronLeft, X, Edit,
  Package, AlertTriangle, CheckCircle, DollarSign, ArrowLeft, ScanLine
} from "lucide-react";
import Link from "next/link";
import AddLineModal from "./AddLineModal";
import ScanSerialRemoval from "@/components/ui/ScanSerialRemoval";
import {
  lockInvoiceHeader,
  updateInvoiceLine,
  deleteInvoiceLine,
  updateInvoiceFooter,
} from "../actions";

const STATUS_STYLES = {
  PAID: "bg-green-100 text-green-700 border-green-200",
  PARTIAL: "bg-amber-100 text-amber-700 border-amber-200",
  UNPAID: "bg-red-100 text-red-700 border-red-200",
};

export default function InvoiceDetail({ invoice, products }) {
  const [showAddLine, setShowAddLine] = useState(false);
  const [savingFooter, setSavingFooter] = useState(false);
  const [lockingHeader, setLockingHeader] = useState(false);
  const [editingLineId, setEditingLineId] = useState(null);
  const [lineEdits, setLineEdits] = useState({});
  // serialMode: 'add' | 'remove' | null — only relevant for serialised lines with qty delta
  const [serialMode, setSerialMode] = useState(null);
  const [serialInputs, setSerialInputs] = useState([]); // new serials to add
  const [removeSerials, setRemoveSerials] = useState([]); // serials selected for removal
  const [savingLineId, setSavingLineId] = useState(null);
  const [deletingLineId, setDeletingLineId] = useState(null);
  const [footerValues, setFooterValues] = useState({
    transportationCost: parseFloat(invoice.transportationCost),
    amountPaid: parseFloat(invoice.amountPaid),
  });
  const [globalError, setGlobalError] = useState("");
  const [globalSuccess, setGlobalSuccess] = useState("");
  const router = useRouter();

  const showFeedback = (msg, isError = false) => {
    if (isError) {
      setGlobalError(msg);
      setGlobalSuccess("");
    } else {
      setGlobalSuccess(msg);
      setGlobalError("");
    }
    setTimeout(() => { setGlobalError(""); setGlobalSuccess(""); }, 4000);
  };

  // ── Lock Header ──────────────────────────────────────────────────────────
  const handleLockHeader = async () => {
    if (!confirm("Lock invoice header? The supplier and date will become permanently immutable.")) return;
    setLockingHeader(true);
    const result = await lockInvoiceHeader(invoice.id);
    if (result.success) {
      showFeedback("Invoice header locked. Inventory updated.");
      router.refresh();
    } else {
      showFeedback(result.message, true);
    }
    setLockingHeader(false);
  };

  // ── Start editing a line ──────────────────────────────────────────────────
  const startEditLine = (line) => {
    setEditingLineId(line.id);
    setSerialMode(null);
    setSerialInputs([]);
    setRemoveSerials([]);
    setLineEdits({
      quantity: line.quantity,
      purchasePrice: parseFloat(line.purchasePrice),
      retailPrice: parseFloat(line.retailPrice),
    });
  };

  // ── Compute serial state when qty changes ─────────────────────────────────
  const handleQtyChange = (line, rawValue) => {
    const newQty = parseInt(rawValue) || 1;
    const delta = newQty - line.quantity;
    setLineEdits((p) => ({ ...p, quantity: newQty }));

    if (line.isSerialised) {
      if (delta > 0) {
        setSerialMode("add");
        setSerialInputs(Array.from({ length: delta }, () => ""));
        setRemoveSerials([]);
      } else if (delta < 0) {
        setSerialMode("remove");
        setRemoveSerials([]);
        setSerialInputs([]);
      } else {
        setSerialMode(null);
        setSerialInputs([]);
        setRemoveSerials([]);
      }
    }
  };

  // ── Save line edits ───────────────────────────────────────────────────────
  const handleSaveLine = async (line) => {
    const newQty = Number(lineEdits.quantity);
    const delta = newQty - line.quantity;
    const hasSales = (line.quantitySold ?? 0) > 0;

    // Client-side serial validation
    if (line.isSerialised && delta > 0) {
      if (serialInputs.some((s) => !s.trim())) {
        showFeedback(`Please enter all ${delta} new serial number(s) before saving.`, true);
        return;
      }
    }
    if (line.isSerialised && delta < 0) {
      const removeCount = Math.abs(delta);
      if (removeSerials.length !== removeCount) {
        showFeedback(`Please select exactly ${removeCount} serial number(s) to remove.`, true);
        return;
      }
    }

    setSavingLineId(line.id);
    const result = await updateInvoiceLine({
      lineId: line.id,
      quantity: newQty,
      purchasePrice: parseFloat(lineEdits.purchasePrice),
      retailPrice: parseFloat(lineEdits.retailPrice),
      newSerials: line.isSerialised && delta > 0 ? serialInputs.map((s) => s.trim()) : [],
      removedSerials: line.isSerialised && delta < 0 ? removeSerials : [],
    });

    if (result.success) {
      showFeedback("Line updated. Totals recalculated.");
      router.refresh();
      setEditingLineId(null);
      setSerialMode(null);
    } else {
      showFeedback(result.message, true);
    }
    setSavingLineId(null);
  };

  // ── Delete line ───────────────────────────────────────────────────────────
  const handleDeleteLine = async (line) => {
    let msg = "Supprimer cette ligne ? Elle sera retirée du stock si la facture est verrouillée.";
    if (line.isSerialised && line.serialNumbers?.length > 0) {
      msg += `\n\nATTENTION : Cela supprimera TOUS les ${line.serialNumbers.length} numéro(s) de série associés !\nN/S : ${line.serialNumbers.map(s => s.serial).join(', ')}`;
    }
    if (!confirm(msg)) return;
    setDeletingLineId(line.id);
    const result = await deleteInvoiceLine(line.id);
    if (result.success) {
      showFeedback("Ligne supprimée.");
      router.refresh();
    } else {
      showFeedback(result.message, true);
    }
    setDeletingLineId(null);
  };

  // ── Save footer (transportation cost + amount paid) ───────────────────────
  const handleSaveFooter = async () => {
    setSavingFooter(true);
    const result = await updateInvoiceFooter({
      invoiceId: invoice.id,
      transportationCost: parseFloat(footerValues.transportationCost) || 0,
      amountPaid: parseFloat(footerValues.amountPaid) || 0,
    });
    if (result.success) {
      showFeedback("Données de facture enregistrées. Dette fournisseur mise à jour.");
      router.refresh();
    } else {
      showFeedback(result.message, true);
      setFooterValues({
        transportationCost: parseFloat(invoice.transportationCost),
        amountPaid: parseFloat(invoice.amountPaid),
      });
    }
    setSavingFooter(false);
  };

  const linesTotal = invoice.lines.reduce(
    (sum, l) => sum + parseFloat(l.purchasePrice) * l.quantity, 0
  );
  const computedTotal = linesTotal + parseFloat(footerValues.transportationCost || 0);
  const computedDebt = Math.max(0, computedTotal - parseFloat(footerValues.amountPaid || 0));

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header / Back */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/import-invoices"
              className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                Facture d'Achat <span className="text-emerald-700">{invoice.invoiceNumber}</span>
              </h1>
              <p className="text-sm text-gray-700 font-medium mt-1">
                Gérer les produits, N/S et les coûts fournisseur
              </p>
            </div>
          </div>
        </div>

        {/* Global feedback */}
        {globalError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {globalError}
          </div>
        )}
        {globalSuccess && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" /> {globalSuccess}
          </div>
        )}

        {/* ── INVOICE HEADER ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Facture N°</span>
                <span className="font-mono text-lg font-bold text-gray-900">{invoice.invoiceNumber}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[invoice.status] || "bg-gray-100 text-gray-600"
                    }`}
                >
                  {invoice.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <div>
                  <span className="text-gray-600 font-medium">Fournisseur : </span>
                  <span className="font-semibold text-gray-900">{invoice.supplier.name}</span>
                </div>
                <div>
                  <span className="text-gray-600 font-medium">Date : </span>
                  <span className="font-semibold text-gray-900">
                    {new Date(invoice.invoiceDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── INVOICE LINES ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Produits Achetés</h2>
            <button
              onClick={() => setShowAddLine(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Ajouter un Produit
            </button>
          </div>

          {invoice.lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-gray-400">
              <Package className="w-10 h-10 mb-2 text-gray-200" />
              <p className="text-sm">Aucun produit ajouté.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-100 text-left">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Produit</th>
                    <th className="px-4 py-3 font-semibold text-right">Qté</th>
                    <th className="px-4 py-3 font-semibold text-right">P. Achat (DZD)</th>
                    <th className="px-4 py-3 font-semibold text-right">P. Vente (DZD)</th>
                    <th className="px-4 py-3 font-semibold text-right">Sous-total</th>
                    <th className="px-4 py-3 font-semibold text-center">Statut</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.lines.map((line) => {
                    const isEditing = editingLineId === line.id;
                    const subtotal = parseFloat(line.purchasePrice) * line.quantity;
                    const hasSales = (line.quantitySold ?? 0) > 0;
                    const isFullyLocked = line.isLocked;

                    return (
                      <tr
                        key={line.id}
                        className={`transition-colors ${
                          isFullyLocked
                            ? "bg-amber-50/40"
                            : hasSales
                            ? "bg-blue-50/20"
                            : "hover:bg-gray-50/50"
                        }`}
                      >
                        <td className="px-5 py-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            {isFullyLocked && (
                              <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Row locked — units have been sold" />
                            )}
                            {line.product.name}
                            {line.isSerialised && (
                              <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">SN</span>
                            )}
                          </div>
                          {hasSales && (
                            <p className="text-xs text-blue-700 font-medium mt-0.5">{line.quantitySold} unité(s) vendue(s)</p>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              min={line.quantitySold || 1}
                              max={line.quantity}
                              value={lineEdits.quantity}
                              onChange={(e) => handleQtyChange(line, e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                            />
                          ) : (
                            <span>{line.quantity}</span>
                          )}
                        </td>

                        {/* Purchase Price — read-only if any units sold */}
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            hasSales ? (
                              <div className="flex items-center gap-1 justify-end text-gray-600 font-medium">
                                <span>{parseFloat(line.purchasePrice).toFixed(2)} DZD</span>
                                <Lock className="w-3 h-3 text-blue-400" title="Verrouillé : unités vendues" />
                              </div>
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={lineEdits.purchasePrice}
                                onChange={(e) => setLineEdits((p) => ({ ...p, purchasePrice: e.target.value }))}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                              />
                            )
                          ) : (
                            <span>{parseFloat(line.purchasePrice).toFixed(2)} DZD
                              {hasSales && (
                                <Lock className="inline w-3 h-3 ml-1 text-blue-400" title="Verrouillé : unités vendues" />
                              )}
                            </span>
                          )}
                        </td>

                        {/* Retail Price — always editable */}
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={lineEdits.retailPrice}
                              onChange={(e) => setLineEdits((p) => ({ ...p, retailPrice: e.target.value }))}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                            />
                          ) : (
                            <span>{parseFloat(line.retailPrice).toFixed(2)} DZD</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-medium">
                          {(parseFloat(line.purchasePrice) * line.quantity).toFixed(2)} DZD
                        </td>

                        {/* Lock status badge */}
                        <td className="px-4 py-3 text-center">
                          {isFullyLocked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                              <Lock className="w-3 h-3" /> Verrouillé
                            </span>
                          ) : hasSales ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs font-medium">
                              <Lock className="w-3 h-3" /> Partiel
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
                              <Unlock className="w-3 h-3" /> Ouvert
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveLine(line)}
                                  disabled={savingLineId === line.id}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50"
                                  title="Enregistrer"
                                >
                                  {savingLineId === line.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Save className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => { setEditingLineId(null); setSerialMode(null); }}
                                  className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                                  title="Annuler"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditLine(line)}
                                  className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors text-xs font-medium flex items-center gap-1"
                                  title="Modifier"
                                >
                                  <Edit className="w-3.5 h-3.5" /> Modifier
                                </button>
                                <button
                                  onClick={() => handleDeleteLine(line)}
                                  disabled={isFullyLocked || deletingLineId === line.id}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-30"
                                  title={isFullyLocked ? "Impossible de supprimer une ligne verrouillée" : "Supprimer"}
                                >
                                  {deletingLineId === line.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── SERIAL EDITING PANEL (shown when editing a serialised line with qty delta) ── */}
        {editingLineId && serialMode && (() => {
          const line = invoice.lines.find((l) => l.id === editingLineId);
          if (!line || !line.isSerialised) return null;
          const delta = Number(lineEdits.quantity) - line.quantity;

          if (serialMode === "add" && delta > 0) {
            return (
              <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-5 space-y-3">
                <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
                  <ScanLine className="w-4 h-4" />
                  Entrez {delta} nouveau(x) N/S
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {serialInputs.map((val, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const next = [...serialInputs];
                          next[i] = e.target.value;
                          setSerialInputs(next);
                        }}
                        placeholder={`N/S #${i + 1}`}
                        className={`flex-1 px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          val.trim() ? "border-blue-300 bg-blue-50" : "border-gray-300"
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (serialMode === "remove" && delta < 0) {
            const removeCount = Math.abs(delta);
            const unsoldSerials = (line.serialNumbers || []).filter((sn) => !sn.isSold && !sn.isReturned).map(s => s.serial);

            return (
              <ScanSerialRemoval 
                originalSerials={unsoldSerials}
                selectedToRemove={removeSerials}
                onToggleRemove={(sn, remove) => {
                  setRemoveSerials(prev => remove 
                    ? [...prev, sn] 
                    : prev.filter(s => s !== sn)
                  );
                }}
                targetRemovalCount={removeCount}
              />
            );
          }

          return null;
        })()}

        {/* ── FOOTER / AMOUNTS ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Montants &amp; Coûts</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frais de transport / Chargement
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={footerValues.transportationCost}
                  onChange={(e) =>
                    setFooterValues((p) => ({ ...p, transportationCost: e.target.value }))
                  }
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant Payé (Espèces au fournisseur)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  max={computedTotal}
                  step="0.01"
                  value={footerValues.amountPaid}
                  onChange={(e) =>
                    setFooterValues((p) => ({ ...p, amountPaid: e.target.value }))
                  }
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Computed summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm border border-gray-100 mb-4">
            <div className="flex justify-between text-gray-700 font-medium">
              <span>Sous-total lignes :</span>
              <span className="font-semibold">{linesTotal.toFixed(2)} DZD</span>
            </div>
            <div className="flex justify-between text-gray-700 font-medium">
              <span>Frais de transport :</span>
              <span className="font-semibold">
                + {parseFloat(footerValues.transportationCost || 0).toFixed(2)} DZD
              </span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total Facture :</span>
              <span>{computedTotal.toFixed(2)} DZD</span>
            </div>
            <div className="flex justify-between text-gray-700 font-medium">
              <span>Montant Payé :</span>
              <span className="text-green-700 font-semibold">
                - {parseFloat(footerValues.amountPaid || 0).toFixed(2)} DZD
              </span>
            </div>
            <div className="flex justify-between font-bold text-red-600 border-t border-gray-200 pt-2">
              <span>Reste Dû (Fournisseur) :</span>
              <span>{computedDebt.toFixed(2)} DZD</span>
            </div>
          </div>

          <button
            onClick={handleSaveFooter}
            disabled={savingFooter}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {savingFooter ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer &amp; Synchroniser la Dette Fournisseur
          </button>
        </div>
      </div>

      {/* Add Line Modal */}
      {showAddLine && (
        <AddLineModal
          invoiceId={invoice.id}
          products={products}
          onClose={() => setShowAddLine(false)}
          onLineAdded={() => { router.refresh(); setShowAddLine(false); }}
        />
      )}
    </div>
  );
}

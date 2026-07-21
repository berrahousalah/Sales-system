"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Lock, Unlock, Trash2, Save, Loader2, ChevronLeft, ArrowLeft,
  Package, AlertTriangle, CheckCircle, DollarSign, CornerDownLeft, X
} from "lucide-react";
import Link from "next/link";
import AddSalesLineModal from "./AddSalesLineModal";
import ScanSerialRemoval from "@/components/ui/ScanSerialRemoval";
import {
  lockSalesInvoiceHeader,
  updateSalesInvoiceLine,
  deleteSalesInvoiceLine,
  updateSalesInvoiceFooter,
} from "../actions";

const STATUS_STYLES = {
  PAID: "bg-green-100 text-green-700 border-green-200",
  PARTIAL: "bg-amber-100 text-amber-700 border-amber-200",
  UNPAID: "bg-red-100 text-red-700 border-red-200",
};

export default function SalesInvoiceDetail({ invoice, products }) {
  const [showAddLine, setShowAddLine] = useState(false);
  const [savingFooter, setSavingFooter] = useState(false);
  const [lockingHeader, setLockingHeader] = useState(false);
  const [editingLineId, setEditingLineId] = useState(null);
  const [lineEdits, setLineEdits] = useState({});
  const [savingLineId, setSavingLineId] = useState(null);
  const [deletingLineId, setDeletingLineId] = useState(null);

  const [footerValues, setFooterValues] = useState({
    deliveryCost: parseFloat(invoice.deliveryCost),
    amountPaid: parseFloat(invoice.amountPaid),
  });

  useEffect(() => {
    setFooterValues({
      deliveryCost: parseFloat(invoice.deliveryCost),
      amountPaid: parseFloat(invoice.amountPaid),
    });
  }, [invoice.deliveryCost, invoice.amountPaid]);

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
    if (!confirm("Lock invoice header? Customer and date will become permanently immutable.")) return;
    setLockingHeader(true);
    const result = await lockSalesInvoiceHeader(invoice.id);
    if (result.success) {
      showFeedback("Invoice header locked.");
      router.refresh();
    } else {
      showFeedback(result.message, true);
    }
    setLockingHeader(false);
  };

  // ── Start editing a line ──────────────────────────────────────────────────
  const startEditLine = (line) => {
    setEditingLineId(line.id);
    setLineEdits({
      quantity: line.quantity,
      sellingPrice: parseFloat(line.sellingPrice),
      soldSerials: [...line.soldSerials],
    });
  };

  // ── Save line edits ───────────────────────────────────────────────────────
  const handleSaveLine = async (line) => {
    setSavingLineId(line.id);

    // Validations
    if (line.batch.importInvoiceLine?.isSerialised) {
      const delta = Number(lineEdits.quantity) - line.quantity;
      if (delta > 0) {
        showFeedback("Cannot increase quantity of serialised items directly. Add a new row instead.", true);
        setSavingLineId(null);
        return;
      }
      if (lineEdits.soldSerials.length !== lineEdits.quantity) {
        showFeedback("Serial numbers list doesn't match quantity.", true);
        setSavingLineId(null);
        return;
      }
    }

    const result = await updateSalesInvoiceLine({
      lineId: line.id,
      quantity: Number(lineEdits.quantity),
      sellingPrice: parseFloat(lineEdits.sellingPrice),
      soldSerials: lineEdits.soldSerials,
    });

    if (result.success) {
      showFeedback("Line updated. Totals recalculated.");
      setEditingLineId(null);
      router.refresh();
    } else {
      showFeedback(result.message, true);
      setLineEdits({
        quantity: line.quantity,
        sellingPrice: parseFloat(line.sellingPrice),
        soldSerials: [...line.soldSerials],
      });
    }
    setSavingLineId(null);
  };

  // ── Delete line (Full Return) ──────────────────────────────────────────────
  const handleDeleteLine = async (line) => {
    let msg = "Delete this row completely? This will immediately return the stock to warehouse and reverse customer debt/profit.";
    if (line.batch.importInvoiceLine?.isSerialised && line.soldSerials?.length > 0) {
      msg += `\n\nWARNING: This will return ALL ${line.soldSerials.length} associated serial number(s) to inventory!\nSerials: ${line.soldSerials.join(', ')}`;
    }
    if (!confirm(msg)) return;
    setDeletingLineId(line.id);
    const result = await deleteSalesInvoiceLine(line.id);
    if (result.success) {
      showFeedback("Line deleted. Stock returned and financials reversed.");
      router.refresh();
    } else {
      showFeedback(result.message, true);
    }
    setDeletingLineId(null);
  };

  // ── Save footer (delivery cost + amount paid - COD workflow) ──────────────
  const handleSaveFooter = async () => {
    setSavingFooter(true);
    const result = await updateSalesInvoiceFooter({
      invoiceId: invoice.id,
      deliveryCost: parseFloat(footerValues.deliveryCost) || 0,
      amountPaid: parseFloat(footerValues.amountPaid) || 0,
    });
    if (result.success) {
      showFeedback("Invoice financials saved. Customer debt profile updated.");
      router.refresh();
    } else {
      showFeedback(result.message, true);
      setFooterValues({
        deliveryCost: parseFloat(invoice.deliveryCost),
        amountPaid: parseFloat(invoice.amountPaid),
      });
    }
    setSavingFooter(false);
  };

  const linesTotal = invoice.lines.reduce(
    (sum, l) => sum + parseFloat(l.sellingPrice) * l.quantity, 0
  );
  const computedTotal = linesTotal + parseFloat(footerValues.deliveryCost || 0);
  const computedDebt = Math.max(0, computedTotal - parseFloat(footerValues.amountPaid || 0));

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header / Back */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/sales-invoices"
              className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                Facture de Vente <span className="text-indigo-700">{invoice.invoiceNumber}</span>
              </h1>
              <p className="text-sm text-gray-700 font-medium mt-1">
                Gérer les articles, N/S, et la dette client
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
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Facture #</span>
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
                  <span className="text-gray-600 font-medium">Client : </span>
                  <span className="font-semibold text-gray-900">{invoice.customer.name}</span>
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

        {/* ── PRODUCTS SOLD ────────────────────────────────────────── */}

        {/* ── INVOICE LINES ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900">Produits Vendus</h2>
              <p className="text-xs text-gray-600 font-medium mt-0.5">Réduire la quantité pour effectuer un retour partiel.</p>
            </div>
            <button
              onClick={() => setShowAddLine(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Ajouter un Produit
            </button>
          </div>

          {invoice.lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-gray-400">
              <Package className="w-10 h-10 mb-2 text-gray-200" />
              <p className="text-sm">No products added yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-100 text-left">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Produit</th>
                    <th className="px-5 py-3 font-semibold">Lot</th>
                    <th className="px-4 py-3 font-semibold text-right">Qté</th>
                    <th className="px-4 py-3 font-semibold text-right">Prix de Vente</th>
                    <th className="px-4 py-3 font-semibold text-right">Sous-total</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.lines.map((line) => {
                    const isEditing = editingLineId === line.id;
                    const subtotal = parseFloat(line.sellingPrice) * line.quantity;
                    const isSerialised = line.batch.importInvoiceLine?.isSerialised;

                    return (
                      <tr key={line.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 font-medium text-gray-900">
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-2">
                              {line.batch.product.name}
                              {isSerialised && (
                                <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">SN</span>
                              )}
                            </span>
                            {isSerialised && (
                              <div className="text-xs text-slate-600 font-medium font-mono flex gap-1">
                                {line.soldSerials.join(", ")}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-gray-700 font-medium">
                          <div className="text-xs">De : {line.batch.supplier.name}</div>
                        </td>

                        {/* Quantity */}
                        <td className="px-4 py-4 text-right">
                          {isEditing ? (
                            isSerialised ? (
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-xs text-gray-400">Edit quantity & select SNs to retain</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={line.quantity}
                                  value={lineEdits.quantity}
                                  onChange={(e) => {
                                    const newQ = parseInt(e.target.value) || 1;
                                    setLineEdits(p => ({
                                      ...p,
                                      quantity: Math.min(newQ, line.quantity),
                                      // Do not slice automatically; user must uncheck manually if they reduce quantity
                                    }));
                                  }}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                                />
                                {lineEdits.quantity < line.quantity ? (
                                  <ScanSerialRemoval 
                                    originalSerials={line.soldSerials}
                                    selectedToRemove={line.soldSerials.filter(sn => !lineEdits.soldSerials.includes(sn))}
                                    onToggleRemove={(sn, remove) => {
                                      setLineEdits(p => ({
                                        ...p,
                                        soldSerials: remove 
                                          ? p.soldSerials.filter(s => s !== sn)
                                          : [...p.soldSerials, sn]
                                      }));
                                    }}
                                    targetRemovalCount={line.quantity - lineEdits.quantity}
                                  />
                                ) : (
                                  <div className="text-[10px] text-slate-500 max-w-[150px] whitespace-normal font-medium">
                                    Aucun N/S à retirer.
                                  </div>
                                )}
                              </div>
                            ) : (
                              <input
                                type="number"
                                min={1}
                                max={line.quantity}
                                value={lineEdits.quantity}
                                onChange={(e) => {
                                  const newQ = parseInt(e.target.value) || 1;
                                  setLineEdits((p) => ({ ...p, quantity: Math.min(newQ, line.quantity) }));
                                }}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                              />
                            )
                          ) : (
                            <span className="font-medium text-gray-900">{line.quantity}</span>
                          )}
                        </td>

                        {/* Selling Price */}
                        <td className="px-4 py-4 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={lineEdits.sellingPrice}
                              onChange={(e) => setLineEdits((p) => ({ ...p, sellingPrice: e.target.value }))}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                            />
                          ) : (
                          <span>{parseFloat(line.sellingPrice).toFixed(2)} DZD</span>
                          )}
                        </td>

                        <td className="px-4 py-4 text-right font-semibold text-gray-900">
                          {subtotal.toFixed(2)} DZD
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveLine(line)}
                                  disabled={savingLineId === line.id}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
                                  title="Enregistrer"
                                >
                                  {savingLineId === line.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Save className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => setEditingLineId(null)}
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
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
                                  title="Retour / Modifier"
                                >
                                  <CornerDownLeft className="w-3.5 h-3.5" /> Retour / Modifier
                                </button>
                                <button
                                  onClick={() => handleDeleteLine(line)}
                                  disabled={deletingLineId === line.id}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-30"
                                  title="Supprimer la ligne"
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

        {/* ── FOOTER / AMOUNTS ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Totaux & Paiement</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Frais de Livraison (DZD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={footerValues.deliveryCost}
                onChange={(e) =>
                  setFooterValues((p) => ({ ...p, deliveryCost: e.target.value }))
                }
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900 font-medium"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Montant Payé (Espèces Reçues) (DZD)
              </label>
              <input
                type="number"
                min="0"
                max={computedTotal}
                step="0.01"
                value={footerValues.amountPaid}
                onChange={(e) =>
                  setFooterValues((p) => ({ ...p, amountPaid: e.target.value }))
                }
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold text-green-700"
                placeholder="0.00"
              />
              <p className="text-[10px] text-gray-600 font-medium mt-1">
                Mettre à jour après la livraison pour synchroniser la dette client automatiquement.
              </p>
            </div>
          </div>

          {/* Computed summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm border border-gray-100 mb-4">
            <div className="flex justify-between text-gray-700 font-medium">
              <span>Sous-total lignes :</span>
              <span className="font-semibold">{linesTotal.toFixed(2)} DZD</span>
            </div>
            <div className="flex justify-between text-gray-700 font-medium">
              <span>Frais de livraison :</span>
              <span className="font-semibold">
                + {parseFloat(footerValues.deliveryCost || 0).toFixed(2)} DZD
              </span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total Général :</span>
              <span>{computedTotal.toFixed(2)} DZD</span>
            </div>
            <div className="flex justify-between text-gray-700 font-medium">
              <span>Montant Payé :</span>
              <span className="text-green-700 font-semibold">
                - {parseFloat(footerValues.amountPaid || 0).toFixed(2)} DZD
              </span>
            </div>
            <div className="flex justify-between font-bold text-red-600 border-t border-gray-200 pt-2">
              <span>Reste Dû (Client) :</span>
              <span>{computedDebt.toFixed(2)} DZD</span>
            </div>
          </div>

          <button
            onClick={handleSaveFooter}
            disabled={savingFooter}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {savingFooter ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer & Synchroniser la Dette Client
          </button>
        </div>
      </div>

      {/* Add Line Modal */}
      {showAddLine && (
        <AddSalesLineModal
          invoiceId={invoice.id}
          products={products}
          onClose={() => setShowAddLine(false)}
          onLineAdded={() => { setShowAddLine(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

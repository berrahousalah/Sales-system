"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, FileText, ChevronRight, Loader2 } from "lucide-react";
import { searchSalesBySerial, searchSalesInvoices } from "./actions";

const STATUS_STYLES = {
  PAID: "bg-green-100 text-green-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  UNPAID: "bg-red-100 text-red-700",
};

export default function SalesInvoicesListClient({ invoices: initialInvoices }) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [searchQuery, setSearchQuery] = useState("");
  const [serialResult, setSerialResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setInvoices(initialInvoices);
      setSerialResult(null);
      setSearchError("");
      return;
    }

    setSearchError("");
    setSerialResult(null);

    startTransition(async () => {
      // First try serial number lookup
      const serialRes = await searchSalesBySerial(searchQuery.trim());
      if (serialRes.success) {
        setSerialResult(serialRes);
        setInvoices([]);
        return;
      }

      // Then try customer name / invoice number
      const invoiceRes = await searchSalesInvoices(searchQuery.trim());
      if (invoiceRes.success) {
        setInvoices(invoiceRes.invoices);
        if (invoiceRes.invoices.length === 0) {
          setSearchError(`No results found for "${searchQuery}"`);
        }
      } else {
        setSearchError(invoiceRes.message);
      }
    });
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSerialResult(null);
    setSearchError("");
    setInvoices(initialInvoices);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par N/S, N° facture ou client..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm text-gray-900"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Rechercher
        </button>
        {searchQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            Effacer
          </button>
        )}
      </form>

      {/* Serial Search Result */}
      {serialResult && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-indigo-800 mb-3">
            N/S Trouvé : <span className="font-mono">{serialResult.serial}</span>
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-700 font-medium">Produit :</span>{" "}
              <span className="font-semibold">{serialResult.product?.name}</span>
            </div>
            <div>
              <span className="text-gray-700 font-medium">Fournisseur :</span>{" "}
              <span className="font-semibold">{serialResult.supplier?.name}</span>
            </div>
            <div>
              <span className="text-gray-700 font-medium">Client :</span>{" "}
              <span className="font-semibold">{serialResult.invoice.customer.name}</span>
            </div>
            <div>
              <span className="text-gray-700 font-medium">Facture :</span>{" "}
              <Link
                href={`/sales-invoices/${serialResult.invoice.id}`}
                className="text-indigo-600 hover:underline font-mono font-medium"
              >
                {serialResult.invoice.invoiceNumber}
              </Link>
            </div>
            <div>
              <span className="text-gray-700 font-medium">Date :</span>{" "}
              <span className="font-semibold">{new Date(serialResult.invoice.invoiceDate).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-gray-700 font-medium">Statut :</span>{" "}
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  serialResult.isReturned
                    ? "bg-gray-200 text-gray-700"
                    : "bg-indigo-200 text-indigo-800"
                }`}
              >
                {serialResult.isReturned ? "Retourné" : "Vendu"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {searchError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
          {searchError}
        </div>
      )}

      {/* Invoices Table */}
      {invoices.length === 0 && !serialResult && !searchError ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-gray-100">
          <FileText className="w-12 h-12 text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Aucune facture de vente</p>
          <p className="text-sm text-gray-500 mt-1">Créez votre première facture pour enregistrer une vente.</p>
        </div>
      ) : (
        invoices.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Facture N°</th>
                    <th className="px-6 py-4 font-semibold">Client</th>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold text-right">Total</th>
                    <th className="px-6 py-4 font-semibold text-right">Payé</th>
                    <th className="px-6 py-4 font-semibold text-right">Dette</th>
                    <th className="px-6 py-4 font-semibold text-center">Statut</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-indigo-700">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-medium">{inv.customer.name}</td>
                      <td className="px-6 py-4 text-gray-700 font-medium">
                        {new Date(inv.invoiceDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        {parseFloat(inv.totalAmount).toFixed(2)} DZD
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700 font-medium">
                        {parseFloat(inv.amountPaid).toFixed(2)} DZD
                      </td>
                      <td className="px-6 py-4 text-right text-red-600 font-semibold">
                        {parseFloat(inv.debtBalance).toFixed(2)} DZD
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            STATUS_STYLES[inv.status] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/sales-invoices/${inv.id}`}
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                        >
                          Ouvrir <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}

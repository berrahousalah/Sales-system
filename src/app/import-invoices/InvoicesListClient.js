"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, FileText, ChevronRight, Loader2 } from "lucide-react";
import { searchBySerial, searchInvoices } from "./actions";

const STATUS_STYLES = {
  PAID: "bg-green-100 text-green-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  UNPAID: "bg-red-100 text-red-700",
};

export default function InvoicesListClient({ invoices: initialInvoices }) {
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
      const serialRes = await searchBySerial(searchQuery.trim());
      if (serialRes.success) {
        setSerialResult(serialRes.result);
        setInvoices([]);
        return;
      }

      // Then try supplier name / invoice number
      const invoiceRes = await searchInvoices(searchQuery.trim());
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
            placeholder="Search by serial number, invoice number, or supplier name..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
        {searchQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            Clear
          </button>
        )}
      </form>

      {/* Serial Search Result */}
      {serialResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-emerald-800 mb-3">
            Serial Number Found: <span className="font-mono">{serialResult.serial}</span>
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Product:</span>{" "}
              <span className="font-medium">{serialResult.importInvoiceLine.product.name}</span>
            </div>
            <div>
              <span className="text-gray-500">Supplier:</span>{" "}
              <span className="font-medium">
                {serialResult.importInvoiceLine.importInvoice.supplier.name}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Invoice:</span>{" "}
              <Link
                href={`/import-invoices/${serialResult.importInvoiceLine.importInvoice.id}`}
                className="text-emerald-600 hover:underline font-mono font-medium"
              >
                {serialResult.importInvoiceLine.importInvoice.invoiceNumber}
              </Link>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>{" "}
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  serialResult.isSold
                    ? "bg-red-100 text-red-700"
                    : serialResult.isReturned
                    ? "bg-gray-100 text-gray-600"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {serialResult.isSold ? "Sold" : serialResult.isReturned ? "Returned" : "In Stock"}
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
          <p className="font-medium text-gray-700">No import invoices yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first invoice to start procuring inventory.</p>
        </div>
      ) : (
        invoices.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Invoice #</th>
                    <th className="px-6 py-4 font-semibold">Supplier</th>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold text-right">Total</th>
                    <th className="px-6 py-4 font-semibold text-right">Paid</th>
                    <th className="px-6 py-4 font-semibold text-right">Debt</th>
                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-emerald-700">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{inv.supplier.name}</td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(inv.invoiceDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right font-medium">
                        ${parseFloat(inv.totalAmount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        ${parseFloat(inv.amountPaid).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right text-red-600 font-medium">
                        ${parseFloat(inv.debtBalance).toFixed(2)}
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
                          href={`/import-invoices/${inv.id}`}
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 text-xs font-medium"
                        >
                          Open <ChevronRight className="w-3.5 h-3.5" />
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

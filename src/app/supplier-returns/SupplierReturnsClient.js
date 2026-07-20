"use client";

import { useState } from "react";
import { Package, RotateCcw, Search } from "lucide-react";
import ReturnModal from "./components/ReturnModal";
import CsvImportModal from "./components/CsvImportModal";
import { UploadCloud } from "lucide-react";

export default function SupplierReturnsClient({ batches }) {
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [filterSupplier, setFilterSupplier] = useState("");
  const [showCsvModal, setShowCsvModal] = useState(false);

  // Build unique supplier list for filter dropdown
  const suppliers = [...new Map(batches.map((b) => [b.supplier.id, b.supplier])).values()];

  const filteredBatches = filterSupplier
    ? batches.filter((b) => b.supplier.id === filterSupplier)
    : batches;

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-gray-100">
        <Package className="w-12 h-12 text-gray-200 mb-3" />
        <p className="font-medium text-gray-700">No stock available for return</p>
        <p className="text-sm text-gray-400 mt-1">
          All inventory batches are either empty or not yet received.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Supplier Filter & Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="pl-9 pr-8 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none"
            >
              <option value="">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-sm text-gray-400">{filteredBatches.length} batch(es) in stock</span>
        </div>

        <button
          onClick={() => setShowCsvModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium shadow-sm"
        >
          <UploadCloud className="w-4 h-4" />
          استيراد مخزون سابق (CSV)
        </button>
      </div>


      {/* Batch Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap text-left">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-5 py-4 font-semibold">Product</th>
                <th className="px-5 py-4 font-semibold">Supplier</th>
                <th className="px-5 py-4 font-semibold">Source Invoice</th>
                <th className="px-5 py-4 font-semibold">Entry Date</th>
                <th className="px-5 py-4 font-semibold text-right">Remaining</th>
                <th className="px-5 py-4 font-semibold text-right">Purchase $</th>
                <th className="px-5 py-4 font-semibold text-center">Type</th>
                <th className="px-5 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBatches.map((batch) => {
                const line = batch.importInvoiceLine;
                const invoice = line.importInvoice;

                return (
                  <tr key={batch.id} className="hover:bg-orange-50/30 transition-colors group">
                    <td className="px-5 py-4 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-orange-100 rounded flex items-center justify-center text-orange-700 text-xs font-bold shrink-0">
                          {batch.product.name.charAt(0).toUpperCase()}
                        </div>
                        {batch.product.name}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{batch.supplier.name}</td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs text-emerald-700 font-semibold">
                        {invoice.invoiceNumber}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {new Date(batch.entryDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          batch.quantityRemaining > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {batch.quantityRemaining}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-medium">
                      ${parseFloat(batch.purchasePrice).toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {line.isSerialised ? (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                          Serialised
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          Bulk
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelectedBatch(batch)}
                        className="flex items-center gap-1.5 ml-auto px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs font-medium transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Return
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {selectedBatch && (
        <ReturnModal
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
        />
      )}
      
      {showCsvModal && (
        <CsvImportModal onClose={() => setShowCsvModal(false)} />
      )}
    </>
  );
}

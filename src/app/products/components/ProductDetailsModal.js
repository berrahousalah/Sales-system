"use client";

import { useEffect, useState } from "react";
import { X, Loader2, PackageOpen } from "lucide-react";
import { getProductBatches } from "../actions";

export default function ProductDetailsModal({ product, onClose }) {
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchBatches() {
      setIsLoading(true);
      const result = await getProductBatches(product.id);
      if (result.success) {
        setBatches(result.batches);
      } else {
        setError(result.message);
      }
      setIsLoading(false);
    }
    
    if (product?.id) {
      fetchBatches();
    }
  }, [product]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{product.name}</h2>
            <p className="text-sm text-gray-500">
              Total Stock: <span className="font-medium text-gray-900">{product.stockBalance}</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wider">
            Independent Batches Breakdown
          </h3>

          {error && (
            <div className="p-3 mb-4 bg-red-50 text-red-600 rounded-md text-sm">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p>Loading batches...</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <PackageOpen className="w-12 h-12 mb-3 text-gray-300" />
              <p className="font-medium text-gray-700">No batches found</p>
              <p className="text-sm text-gray-400 mt-1">This product has not been imported yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-medium">Supplier Name</th>
                    <th className="px-4 py-3 font-medium">Entry Date</th>
                    <th className="px-4 py-3 font-medium text-right">Remaining Qty</th>
                    <th className="px-4 py-3 font-medium text-right">Purchase Price</th>
                    <th className="px-4 py-3 font-medium text-right">Suggested Retail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {batch.supplierName}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(batch.entryDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          batch.quantityRemaining > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {batch.quantityRemaining}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        ${Number(batch.purchasePrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        ${Number(batch.retailPrice).toFixed(2)}
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
  );
}

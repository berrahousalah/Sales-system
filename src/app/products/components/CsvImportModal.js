"use client";

import { useState } from "react";
import { Upload, X, Loader2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { importProductsFromCsv } from "../actions";

export default function CsvImportModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.type !== "text/csv" && !selected.name.endsWith(".csv")) {
        setError("Please select a valid CSV file.");
        setFile(null);
      } else {
        setError("");
        setFile(selected);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const text = await file.text();
      // Basic CSV parsing (comma separated, handling simple lines)
      // Assumes first row is header or at least data starts
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
      
      const rows = [];
      // Skip header if it exists
      for (let i = 1; i < lines.length; i++) {
        const [name, quantity, purchasePrice, retailPrice] = lines[i].split(",");
        
        if (name) {
          rows.push({
            name: name.trim(),
            quantity: quantity?.trim() || "0",
            purchasePrice: purchasePrice?.trim() || "0",
            retailPrice: retailPrice?.trim() || "0"
          });
        }
      }

      if (rows.length === 0) {
        setError("No valid data found in CSV. Make sure it has 4 columns: Name, Qty, Purchase, Retail.");
        setIsLoading(false);
        return;
      }

      const res = await importProductsFromCsv(rows);
      if (res.success) {
        setSuccess(res.message);
        setFile(null);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess("");
        }, 2000);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError("Failed to parse or upload CSV.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors text-sm font-medium shadow-sm"
      >
        <FileSpreadsheet className="w-4 h-4" />
        Import CSV
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-slate-600" />
                Import Products (CSV)
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="mb-4 text-sm text-gray-600">
                <p className="mb-2">Upload a CSV file with the following 4 columns in order:</p>
                <ol className="list-decimal pl-5 space-y-1 font-mono text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <li>Product Name (اسم المنتج)</li>
                  <li>Available Quantity (الكمية المتوفرة)</li>
                  <li>Purchase Price (سعر الشراء)</li>
                  <li>Suggested Retail Price (سعر البيع المقترح)</li>
                </ol>
                <p className="mt-2 text-xs text-amber-600 flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3 h-3" /> The first row (headers) will be skipped automatically.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <label className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700">
                    {file ? file.name : "Click to select CSV file"}
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isLoading || !file}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

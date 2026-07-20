"use client";

import { useState } from "react";
import { X, Loader2, UploadCloud } from "lucide-react";
import { bulkImportInitialStock } from "../actions";
import { useRouter } from "next/navigation";

export default function CsvImportModal({ onClose }) {
  const [file, setFile] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type !== "text/csv" && !selected.name.endsWith('.csv')) {
      setError("Please select a valid CSV file.");
      setFile(null);
      return;
    }
    setError("");
    setFile(selected);
  };

  const parseCSV = (text) => {
    // Basic CSV parser to handle quotes
    const rows = [];
    let row = [];
    let curr = "";
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"' && text[i+1] === '"') {
        curr += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(curr.trim());
        curr = "";
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && text[i+1] === '\n') i++; // Windows newline
        row.push(curr.trim());
        if (row.some(val => val !== "")) rows.push(row);
        row = [];
        curr = "";
      } else {
        curr += char;
      }
    }
    if (curr !== "" || row.length > 0) {
      row.push(curr.trim());
      rows.push(row);
    }
    return rows;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to import.");
      return;
    }

    setIsPending(true);
    setError("");

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length < 2) {
        setError("The CSV file is empty or missing data rows.");
        setIsPending(false);
        return;
      }

      // Expected format: Product Name, Available Quantity, Purchase Price, Suggested Selling Price
      const parsedData = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 4) continue; // Skip incomplete rows
        
        parsedData.push({
          productName: row[0],
          availableQuantity: parseInt(row[1], 10),
          purchasePrice: parseFloat(row[2]),
          suggestedSellingPrice: parseFloat(row[3]),
        });
      }

      const result = await bulkImportInitialStock(parsedData);
      
      if (result.success) {
        alert(result.message);
        router.refresh();
        onClose();
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to parse CSV file.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">استيراد مخزون سابق (CSV)</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-orange-800 mb-2">CSV Format Required:</h3>
            <ol className="text-xs text-orange-700 list-decimal pl-4 space-y-1">
              <li>Product Name (اسم المنتج)</li>
              <li>Available Quantity (الكمية المتوفرة)</li>
              <li>Purchase Price (سعر الشراء)</li>
              <li>Suggested Selling Price (سعر البيع المقترح)</li>
            </ol>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <div className="flex items-center justify-center w-full">
              <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 font-medium">
                    {file ? file.name : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">.CSV files only</p>
                </div>
                <input id="dropzone-file" type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-3 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !file}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Import Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

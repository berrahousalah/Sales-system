"use client";

import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { createSupplier } from "../actions";
import { useRouter } from "next/navigation";

export default function SupplierForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsPending(true);
    
    const formData = new FormData(e.currentTarget);
    const result = await createSupplier(formData);
    
    if (result.success) {
      setIsOpen(false);
      router.refresh();
    } else {
      setError(result.message);
    }
    
    setIsPending(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-5 h-5" />
        New Supplier
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Create New Supplier</h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter supplier name..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  Initial total debt will automatically be set to $0.00.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors w-full sm:w-auto"
                >
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

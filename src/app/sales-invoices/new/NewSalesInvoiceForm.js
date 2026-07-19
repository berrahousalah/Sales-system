"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, FileText } from "lucide-react";
import Link from "next/link";
import { createSalesInvoice } from "../actions";

export default function NewSalesInvoiceForm({ customers }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createSalesInvoice(formData);
      if (result.success) {
        router.push(`/sales-invoices/${result.invoice.id}`);
      } else {
        setError(result.message);
      }
    });
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8 lg:p-12">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/sales-invoices"
            className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">New Sales Invoice</h1>
            <p className="text-sm text-gray-500">Create invoice header — products are added after saving</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-700" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Invoice Header</p>
              <p className="text-xs text-amber-600 font-medium mt-0.5">
                ⚠ Once saved, Customer and Date become permanently immutable
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="customerId" className="block text-sm font-medium text-gray-700 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                id="customerId"
                name="customerId"
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
              >
                <option value="">— Select Customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {customers.length === 0 && (
                <p className="mt-1 text-xs text-red-500">
                  No customers found.{" "}
                  <Link href="/customers" className="underline">
                    Create a customer first.
                  </Link>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="invoiceDate" className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <input
                id="invoiceDate"
                name="invoiceDate"
                type="date"
                defaultValue={today}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending || customers.length === 0}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isPending && <Loader2 className="w-5 h-5 animate-spin" />}
                Create Invoice & Add Products
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

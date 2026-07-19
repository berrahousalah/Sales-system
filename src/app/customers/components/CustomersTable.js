"use client";

import { useState } from "react";
import { Users, HandCoins } from "lucide-react";
import CollectDebtModal from "./CollectDebtModal";

export default function CustomersTable({ initialCustomers }) {
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  if (initialCustomers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-indigo-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No customers found</h3>
        <p className="text-gray-500 text-center max-w-sm">
          Get started by creating your first customer. Customers must be registered before creating
          Sales Invoices.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Customer Name</th>
                <th className="px-6 py-4 font-semibold text-right">Outstanding Debt</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {initialCustomers.map((customer) => {
                const totalDebt = parseFloat(customer.totalDebt);
                const hasDebt = totalDebt > 0;

                return (
                  <tr key={customer.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold shrink-0">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        {customer.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          hasDebt
                            ? "bg-amber-50 text-amber-700 border border-amber-100"
                            : "bg-green-50 text-green-700 border border-green-100"
                        }`}
                      >
                        ${totalDebt.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedCustomer(customer)}
                          disabled={!hasDebt}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md transition-colors font-medium text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                          title={hasDebt ? "Collect Debt (FIFO)" : "No outstanding debt"}
                        >
                          <HandCoins className="w-3.5 h-3.5" />
                          Collect Debt
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCustomer && (
        <CollectDebtModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </>
  );
}

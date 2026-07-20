"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar, FileLock2, RefreshCcw, TrendingUp, TrendingDown,
  DollarSign, Activity, AlertTriangle, ShieldCheck, CheckCircle
} from "lucide-react";
import { getFinancialMetrics, executeMonthEndClose } from "./actions";

export default function FinancialsClient({ archives }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dynamic Query State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [metrics, setMetrics] = useState(null);
  
  // Closing State
  const [closingMonthId, setClosingMonthId] = useState("");
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Initialize with current month
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    
    // First day of current month
    const firstDay = new Date(y, now.getMonth(), 1);
    // Last day of current month
    const lastDay = new Date(y, now.getMonth() + 1, 0);

    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(lastDay.toISOString().split("T")[0]);
    setClosingMonthId(`${y}-${m}`); // default suggestion
  }, []);

  const showMsg = (msg, isErr = false) => {
    if (isErr) { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
    setTimeout(() => { setError(""); setSuccess(""); }, 6000);
  };

  // ── Run Dynamic Query ───────────────────────────────────────────────────
  const handleQuery = async (e) => {
    if (e) e.preventDefault();
    if (!startDate || !endDate) return;

    startTransition(async () => {
      const result = await getFinancialMetrics({ startDate, endDate });
      if (result.success) {
        setMetrics(result.data);
        setError("");
      } else {
        showMsg(result.message, true);
        setMetrics(null);
      }
    });
  };

  // Run automatically when dates are initialized
  useEffect(() => {
    if (startDate && endDate && !metrics) handleQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // ── Month-End Close ─────────────────────────────────────────────────────
  const handleCloseMonth = async (e) => {
    e.preventDefault();
    if (!closingMonthId.match(/^\d{4}-\d{2}$/)) {
      return showMsg("Closing month must be in YYYY-MM format.", true);
    }
    
    if (!confirm(`Are you absolutely sure you want to CLOSE month ${closingMonthId}? This action is mathematically irreversible. The snapshot will be permanently frozen.`)) {
      return;
    }

    startTransition(async () => {
      const result = await executeMonthEndClose({ closingMonthId });
      if (result.success) {
        showMsg(result.message);
        router.refresh();
      } else {
        showMsg(result.message, true);
      }
    });
  };

  const renderMetricCard = (title, value, icon, isNegative = false) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <div className={`p-2 rounded-lg ${isNegative ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-gray-900">${parseFloat(value).toLocaleString("en-US", {minimumFractionDigits: 2})}</span>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
      
      {/* ── LEFT COLUMN: DYNAMIC REPORTS & CLOSE ROUTINE ── */}
      <div className="xl:col-span-8 space-y-6">
        
        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 p-4 bg-green-50 text-green-700 rounded-xl text-sm border border-green-200">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="font-medium">{success}</p>
          </div>
        )}

        {/* Dynamic Query Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b border-gray-50 pb-4">
            <div>
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" /> Dynamic Financial Metrics
              </h2>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-lg">
                These numbers aggregate live data. If a transaction from a closed month is retroactively returned today, the Transaction Ledger organically absorbs the negative delta here to balance global equity.
              </p>
            </div>
          </div>
          
          <form onSubmit={handleQuery} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {isPending ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              Recalculate Real-Time
            </button>
          </form>

          {/* Metrics Dashboard */}
          {metrics ? (
            <div className="mt-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {renderMetricCard("Gross Revenue", metrics.totalRevenue, <DollarSign className="w-5 h-5" />)}
                {renderMetricCard("Cost of Goods Sold (COGS)", metrics.totalCOGS, <TrendingDown className="w-5 h-5" />, true)}
                {renderMetricCard("Gross Profit", metrics.grossProfit, <TrendingUp className="w-5 h-5" />)}
              </div>
              
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Operating Expenses (OPEX)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
                    <span className="text-gray-500 text-sm">Logistics / Shipping</span>
                    <span className="font-semibold text-red-600">-${parseFloat(metrics.totalLogisticsExpenses).toLocaleString("en-US", {minimumFractionDigits:2})}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
                    <span className="text-gray-500 text-sm">Inventory Write-offs (Loss)</span>
                    <span className="font-semibold text-red-600">-${parseFloat(metrics.totalAdjustmentLosses).toLocaleString("en-US", {minimumFractionDigits:2})}</span>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-600 text-white rounded-xl p-6 shadow-md flex justify-between items-center">
                <div>
                  <h3 className="text-emerald-100 font-medium mb-1">Calculated Net Profit</h3>
                  <p className="text-xs text-emerald-200">Gross Profit minus OPEX</p>
                </div>
                <div className="text-3xl font-extrabold tracking-tight">
                  ${parseFloat(metrics.finalNetProfit).toLocaleString("en-US", {minimumFractionDigits: 2})}
                </div>
              </div>

              {metrics.ledgerCount > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5" />
                  <p className="text-xs text-blue-800 leading-relaxed">
                    <strong>Integrity Notice:</strong> {metrics.ledgerCount} retroactive adjustment(s) (returns on historic closed months) were algorithmically absorbed into this period's dynamic calculations to protect archival integrity.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-8 text-center py-10 bg-gray-50 rounded-xl border border-gray-100 border-dashed text-gray-400">
              Select a date range and click Recalculate to generate metrics.
            </div>
          )}
        </div>

        {/* Month-End Close Trigger */}
        <div className="bg-slate-900 rounded-2xl shadow-sm p-6 text-slate-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl"></div>
          
          <div className="flex items-center gap-3 mb-4">
            <FileLock2 className="w-6 h-6 text-rose-400" />
            <h2 className="text-lg font-bold text-white">Execute Month-End Close</h2>
          </div>
          <p className="text-sm leading-relaxed mb-6 text-slate-400 max-w-2xl">
            This operational routine captures a permanent, read-only snapshot of the exact financial state for a specific calendar month. 
            Once executed, these numbers become <strong>immutable</strong>. Any subsequent returns for invoices billed in a closed month will be diverted via the Transaction Ledger to debit the current active month instead.
          </p>

          <form onSubmit={handleCloseMonth} className="flex flex-col sm:flex-row gap-4 items-end max-w-lg relative z-10">
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Closing Target (YYYY-MM)</label>
              <input
                type="text"
                placeholder="2026-06"
                value={closingMonthId}
                onChange={(e) => setClosingMonthId(e.target.value)}
                required
                pattern="\d{4}-\d{2}"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-rose-500 outline-none font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto px-6 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-rose-900/50"
            >
              {isPending && <RefreshCcw className="w-4 h-4 animate-spin" />}
              Freeze & Archive
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT COLUMN: IMMUTABLE ARCHIVES ── */}
      <div className="xl:col-span-4 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 h-full min-h-[600px]">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
            <Calendar className="w-5 h-5 text-gray-700" />
            <h2 className="font-bold text-gray-900">Immutable Archives</h2>
          </div>

          {archives.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-400 py-16">
              <FileLock2 className="w-10 h-10 mb-3 opacity-30 text-gray-400" />
              <p className="text-sm font-medium text-gray-500">No closed months yet.</p>
              <p className="text-xs text-center mt-2 max-w-[200px] leading-relaxed">
                Run the Month-End Close routine to permanently lock a period.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {archives.map((report) => (
                <div key={report.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:border-emerald-300 transition-colors group">
                  <div className="flex justify-between items-center mb-3">
                    <div className="font-bold text-gray-900 text-lg">{report.closingMonthId}</div>
                    <div className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-emerald-100 text-emerald-800 rounded">
                      Locked
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Gross Revenue</span>
                      <span className="font-semibold text-gray-900">${parseFloat(report.totalRevenue).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>COGS</span>
                      <span className="font-semibold text-gray-900">-${parseFloat(report.totalCOGS).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 border-t border-gray-200 pt-1.5 mt-1.5">
                      <span>OPEX Total</span>
                      <span className="font-semibold text-red-600">
                        -${(parseFloat(report.totalLogisticsExpenses) + parseFloat(report.totalAdjustmentLosses)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500 uppercase">Net Profit</span>
                    <span className="text-sm font-extrabold text-emerald-700">
                      ${parseFloat(report.finalNetProfit).toLocaleString("en-US", {minimumFractionDigits: 2})}
                    </span>
                  </div>
                  <div className="mt-3 text-[9px] text-gray-400 font-mono text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    Archived: {new Date(report.closedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

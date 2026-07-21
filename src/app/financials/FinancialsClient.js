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
      return showMsg("Le mois de clôture doit être au format AAAA-MM.", true);
    }
    
    if (!confirm(`Confirmez-vous la CLÔTURE du mois ${closingMonthId} ? Cette action est irréversible. L'instantané sera gelé définitivement.`)) {
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
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <div className={`p-2 rounded-lg ${isNegative ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-gray-900">{parseFloat(value).toLocaleString("fr-DZ", {minimumFractionDigits: 2})} DZD</span>
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
                <Activity className="w-5 h-5 text-emerald-600" /> Métriques Financières Dynamiques
              </h2>
              <p className="text-xs text-gray-600 font-medium mt-1 leading-relaxed max-w-lg">
                Ces données sont calculées en temps réel. Les retours sur des mois clôturés sont automatiquement intégrés dans les calculs courants.
              </p>
            </div>
          </div>
          
          <form onSubmit={handleQuery} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Du</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Au</label>
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
              Recalculer en Temps Réel
            </button>
          </form>

          {/* Metrics Dashboard */}
          {metrics ? (
            <div className="mt-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {renderMetricCard("Chiffre d'Affaires Brut", metrics.totalRevenue, <DollarSign className="w-5 h-5" />)}
                {renderMetricCard("Coût des Marchandises (CMV)", metrics.totalCOGS, <TrendingDown className="w-5 h-5" />, true)}
                {renderMetricCard("Bénéfice Brut", metrics.grossProfit, <TrendingUp className="w-5 h-5" />)}
              </div>
              
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Dépenses Opérationnelles (OPEX)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
                    <span className="text-gray-700 font-medium text-sm">Logistique / Transport</span>
                    <span className="font-semibold text-red-600">-{parseFloat(metrics.totalLogisticsExpenses).toLocaleString("fr-DZ", {minimumFractionDigits:2})} DZD</span>
                  </div>
                  <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
                    <span className="text-gray-700 font-medium text-sm">Pertes Inventaire (Ajustements)</span>
                    <span className="font-semibold text-red-600">-{parseFloat(metrics.totalAdjustmentLosses).toLocaleString("fr-DZ", {minimumFractionDigits:2})} DZD</span>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-600 text-white rounded-xl p-6 shadow-md flex justify-between items-center">
                <div>
                  <h3 className="text-emerald-100 font-medium mb-1">Bénéfice Net Calculé</h3>
                  <p className="text-xs text-emerald-200">Bénéfice Brut moins OPEX</p>
                </div>
                <div className="text-3xl font-extrabold tracking-tight">
                  {parseFloat(metrics.finalNetProfit).toLocaleString("fr-DZ", {minimumFractionDigits: 2})} DZD
                </div>
              </div>

              {metrics.ledgerCount > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5" />
                  <p className="text-xs text-blue-800 font-medium leading-relaxed">
                    <strong>Avis d'intégrité :</strong> {metrics.ledgerCount} ajustement(s) rétroactif(s) sur des mois clôturés ont été intégrés dans les calculs courants.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-8 text-center py-10 bg-gray-50 rounded-xl border border-gray-100 border-dashed text-gray-500 font-medium">
              Sélectionnez une période et cliquez sur Recalculer pour générer les métriques.
            </div>
          )}
        </div>

        {/* Month-End Close Trigger */}
        <div className="bg-slate-900 rounded-2xl shadow-sm p-6 text-slate-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl"></div>
          
          <div className="flex items-center gap-3 mb-4">
            <FileLock2 className="w-6 h-6 text-rose-400" />
            <h2 className="text-lg font-bold text-white">Exécuter la Clôture Mensuelle</h2>
          </div>
          <p className="text-sm leading-relaxed mb-6 text-slate-400 max-w-2xl font-medium">
            Cette routine opérationnelle capture un instantané permanent et en lecture seule de l'état financier pour un mois donné. 
            Une fois exécutés, ces chiffres deviennent <strong>immuables</strong>. Tout retour ultérieur concernant des factures d'un mois clôturé sera redirigé via le journal des transactions pour débiter le mois actif en cours.
          </p>

          <form onSubmit={handleCloseMonth} className="flex flex-col sm:flex-row gap-4 items-end max-w-lg relative z-10">
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Mois Cible (AAAA-MM)</label>
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
              Figer &amp; Archiver
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT COLUMN: IMMUTABLE ARCHIVES ── */}
      <div className="xl:col-span-4 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 h-full min-h-[600px]">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
            <Calendar className="w-5 h-5 text-gray-700" />
            <h2 className="font-bold text-gray-900">Archives Immuables</h2>
          </div>

          {archives.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-500 py-16">
              <FileLock2 className="w-10 h-10 mb-3 opacity-30 text-gray-400" />
              <p className="text-sm font-semibold text-gray-600">Aucun mois clôturé.</p>
              <p className="text-xs text-center font-medium mt-2 max-w-[200px] leading-relaxed">
                Exécutez la clôture mensuelle pour verrouiller définitivement une période.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {archives.map((report) => (
                <div key={report.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:border-emerald-300 transition-colors group">
                  <div className="flex justify-between items-center mb-3">
                    <div className="font-bold text-gray-900 text-lg">{report.closingMonthId}</div>
                    <div className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-emerald-100 text-emerald-800 rounded">
                      Verrouillé
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-600 font-medium">
                      <span>CA Brut</span>
                      <span className="font-semibold text-gray-900">{parseFloat(report.totalRevenue).toLocaleString("fr-DZ")} DZD</span>
                    </div>
                    <div className="flex justify-between text-gray-600 font-medium">
                      <span>CMV</span>
                      <span className="font-semibold text-gray-900">-{parseFloat(report.totalCOGS).toLocaleString("fr-DZ")} DZD</span>
                    </div>
                    <div className="flex justify-between text-gray-600 font-medium border-t border-gray-200 pt-1.5 mt-1.5">
                      <span>Total OPEX</span>
                      <span className="font-semibold text-red-600">
                        -{(parseFloat(report.totalLogisticsExpenses) + parseFloat(report.totalAdjustmentLosses)).toLocaleString("fr-DZ")} DZD
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-600 uppercase">Bénéfice Net</span>
                    <span className="text-sm font-extrabold text-emerald-700">
                      {parseFloat(report.finalNetProfit).toLocaleString("fr-DZ", {minimumFractionDigits: 2})} DZD
                    </span>
                  </div>
                  <div className="mt-3 text-[9px] text-gray-400 font-mono text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    Archivé : {new Date(report.closedAt).toLocaleString()}
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

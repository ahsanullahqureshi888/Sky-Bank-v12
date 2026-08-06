import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Building,
  Calendar,
  RefreshCw,
  Clock,
  Plus,
  Scale,
  TrendingDown,
  TrendingUp,
  Database,
  UploadCloud,
  Users,
} from 'lucide-react';
import { backupAPI, bankAPI, dashboardAPI } from '../api/client';
import GlassCard from '../components/GlassCard';
import StatCard from '../components/StatCard';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useTranslation } from 'react-i18next';

const currencies = ['USD', 'Toman', 'Dirham', 'Afghani'];

const getCurrencyCardGradient = (curr) => {
  switch (curr) {
    case 'USD': return 'from-[#1e293b] via-[#334155] to-[#0f172a] text-white';
    case 'Toman': return 'from-[#b45309] via-[#d97706] to-[#78350f] text-white';
    case 'Dirham': return 'from-[#0f766e] via-[#0d9488] to-[#115e59] text-white';
    case 'Afghani': return 'from-[#4338ca] via-[#4f46e5] to-[#312e81] text-white';
    default: return 'from-[#0369a1] via-[#0284c7] to-[#075985] text-white';
  }
};

export default function Dashboard() {
  const { t } = useTranslation();
  const LABELS = t('dashboard', { returnObjects: true });
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [banks, setBanks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('sky_banking_user') || '{}');
  } catch {
    user = {};
  }

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError('');

    const results = await Promise.allSettled([
      dashboardAPI.getSummary(),
      dashboardAPI.getRecentTransactions(7),
      dashboardAPI.getMonthlyChart(),
      bankAPI.list(),
      backupAPI.auditLogs(),
    ]);

    const [sumRes, recRes, chartRes, bankRes, logsRes] = results;
    const coreResults = [sumRes, recRes, chartRes, bankRes];
    const coreFailures = coreResults.filter((result) => result.status === 'rejected');

    if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data);
    if (recRes.status === 'fulfilled') setRecent(Array.isArray(recRes.value.data) ? recRes.value.data : []);
    if (chartRes.status === 'fulfilled') setChartData(Array.isArray(chartRes.value.data) ? chartRes.value.data : []);
    if (bankRes.status === 'fulfilled') setBanks(Array.isArray(bankRes.value.data) ? bankRes.value.data : []);
    if (logsRes.status === 'fulfilled') setLogs(Array.isArray(logsRes.value.data) ? logsRes.value.data.slice(0, 6) : []);
    else setLogs([]);

    if (coreFailures.length === coreResults.length) {
      setLoadError('Dashboard data could not be loaded. Check the connection and try again.');
    } else if (coreFailures.length > 0) {
      setLoadError('Some core dashboard data is temporarily unavailable.');
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) { 
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
          <p className="text-sm font-bold text-sky-600">{LABELS.loading}</p>
        </div>
      </div>
    );
  }

  const maxChartVal = chartData.reduce(
    (max, item) => Math.max(max, item.received || 0, item.paid || 0),
    1000
  );

  return (
    <div className="mx-auto w-full max-w-[1640px] space-y-6">
      
      {/* iOS Greeting & Wallet Card on Mobile */}
      <div className="md:hidden space-y-4 ios-card-fade-up">
        <div>
          <h2 className="text-[9px] font-black uppercase tracking-[0.16em] text-sky-500">{LABELS.welcomeBack}</h2>
          <h1 className="text-2xl font-black text-slate-900 mt-0.5">
            {LABELS.hi}{user.name || 'User'} 👋
          </h1>
          <p className="text-xs font-semibold text-slate-400">{LABELS.financialStatus}</p>
        </div>

        {/* Stacked iOS Wallet Cards Visual Container */}
        <div className="relative pt-4 pb-2">
          {/* Back stacked card decoration */}
          <div className="absolute top-0 inset-x-4 h-24 rounded-[24px] bg-slate-800/40 border border-white/5 shadow-sm translate-y-1 scale-[0.94] pointer-events-none transform origin-bottom z-0" />
          <div className="absolute top-0 inset-x-2 h-24 rounded-[24px] bg-sky-950/60 border border-white/5 shadow-md translate-y-2 scale-[0.97] pointer-events-none transform origin-bottom z-10" />

          {/* Main Apple Wallet Style Card */}
          <div className="relative z-20 ios-wallet-card text-white p-5 shadow-xl shadow-sky-950/20">
            <div className="ios-glossy-shine" />
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/50">{LABELS.skyAriana}</span>
                <div className="ios-card-chip my-2.5">
                  <div className="ios-card-chip-lines" />
                </div>
                <h2 className="text-3xl font-black mt-1 leading-none tracking-tight">
                  {formatCurrency(summary?.total_balance || 0, 'USD')}
                </h2>
                <span className="text-[9px] text-emerald-400 font-extrabold mt-1 block uppercase tracking-wider">{LABELS.netAccountBalance}</span>
              </div>
              <div className="h-10 w-10 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-md">
                <Scale size={20} className="text-sky-300" />
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/10 flex justify-between text-xs font-bold text-white/70">
              <div>
                <span className="block text-[8px] uppercase tracking-wider text-white/40">{LABELS.todaysTx}</span>
                <span>{summary?.todays_transactions || 0} Records</span>
              </div>
              <div className="text-right">
                <span className="block text-[8px] uppercase tracking-wider text-white/40">{LABELS.thisMonth}</span>
                <span>{summary?.monthly_transactions || 0} Records</span>
              </div>
            </div>
          </div>
        </div>

        {/* Small stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white border border-sky-100/70 rounded-2xl flex items-center gap-3 shadow-sm shadow-sky-950/[0.02] active:bg-sky-50 transition-colors">
            <div className="h-9 w-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/10">
              <TrendingUp size={16} />
            </div>
            <div className="min-w-0">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">{LABELS.received}</span>
              <span className="text-xs font-black text-slate-800 truncate block">
                {formatCurrency(summary?.total_received || 0, 'USD')}
              </span>
            </div>
          </div>

          <div className="p-3 bg-white border border-sky-100/70 rounded-2xl flex items-center gap-3 shadow-sm shadow-sky-950/[0.02] active:bg-sky-50 transition-colors">
            <div className="h-9 w-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-500/10">
              <TrendingDown size={16} />
            </div>
            <div className="min-w-0">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">{LABELS.paid}</span>
              <span className="text-xs font-black text-slate-800 truncate block">
                {formatCurrency(summary?.total_paid || 0, 'USD')}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="space-y-2.5 pt-2">
          <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 pl-1">{LABELS.quickActions}</h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            <Link to="/add-transaction" className="flex flex-col items-center justify-center gap-2 p-2 bg-white border border-sky-100/70 rounded-2xl active:scale-95 transition-all shadow-sm min-h-[52px]">
              <div className="h-11 w-11 bg-sky-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/15">
                <Plus size={20} />
              </div>
              <span className="text-[9px] font-black text-slate-700">{LABELS.newTx}</span>
            </Link>

            <Link to="/customer-ledger" className="flex flex-col items-center justify-center gap-2 p-2 bg-white border border-sky-100/70 rounded-2xl active:scale-95 transition-all shadow-sm min-h-[52px]">
              <div className="h-11 w-11 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/15">
                <Users size={20} />
              </div>
              <span className="text-[9px] font-black text-slate-700">{LABELS.ledgers}</span>
            </Link>

            <Link to="/backup" className="flex flex-col items-center justify-center gap-2 p-2 bg-white border border-sky-100/70 rounded-2xl active:scale-95 transition-all shadow-sm min-h-[52px]">
              <div className="h-11 w-11 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/15">
                <Database size={20} />
              </div>
              <span className="text-[9px] font-black text-slate-700">{LABELS.backup}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Desktop Header and Stats Cards */}
      <div className="hidden md:flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black leading-tight text-slate-900 md:text-3xl">
            {LABELS.dashboardTitle}
          </h1>
          <p className="mt-1 text-sm font-semibold text-sky-600">
            {LABELS.dashboardSubtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-sky-100 bg-white/70 px-4 text-sm font-extrabold text-sky-700 shadow-sm transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Refresh dashboard"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            to="/add-transaction"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 text-sm font-extrabold text-white shadow-xl shadow-sky-500/20 transition-all hover:-translate-y-0.5 hover:shadow-sky-500/30"
          >
            <Plus size={17} />
            <span>{LABELS.newTransactionBtn}</span>
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 sm:flex-row sm:items-center sm:justify-between" role="status">
          <span>{loadError}</span>
          <button type="button" onClick={() => loadData(true)} className="w-fit rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-900 transition hover:bg-amber-200">
            Try again
          </button>
        </div>
      )}

      <div className="hidden md:grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Received"
          value={formatCurrency(summary?.total_received || 0, 'USD')}
          icon={TrendingUp}
          colorClass="text-emerald-600"
          bgClass="bg-gradient-to-br from-emerald-50/80 to-emerald-100/30"
        />
        <StatCard
          title="Total Paid"
          value={formatCurrency(summary?.total_paid || 0, 'USD')}
          icon={TrendingDown}
          colorClass="text-rose-600"
          bgClass="bg-gradient-to-br from-rose-50/80 to-rose-100/30"
        />
        <StatCard
          title="Net Balance"
          value={formatCurrency(summary?.total_balance || 0, 'USD')}
          icon={Scale}
          colorClass="text-sky-600"
          bgClass="bg-gradient-to-br from-sky-50/80 to-sky-100/30"
        />
        <StatCard
          title="Today Transactions"
          value={summary?.todays_transactions || 0}
          icon={Calendar}
          colorClass="text-indigo-600"
          bgClass="bg-gradient-to-br from-indigo-50/80 to-indigo-100/30"
        />
        <StatCard
          title="This Month"
          value={summary?.monthly_transactions || 0}
          icon={Clock}
          colorClass="text-amber-600"
          bgClass="bg-gradient-to-br from-amber-50/80 to-amber-100/30"
        />
      </div>

      <GlassCard className="p-5">
        <div className="mb-5 flex flex-col gap-3 border-b border-sky-100/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-slate-900">{LABELS.currencyBreakdown}</h2>
          <span className="w-fit rounded-lg bg-sky-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-500">
            {LABELS.equivalentCash}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {currencies.map((curr) => {
            const amount = (summary?.currency_totals && typeof curr === 'string' && !['__proto__', 'constructor', 'prototype'].includes(curr))
              ? (Reflect.get(summary.currency_totals, curr) || 0)
              : 0;
            const percentage = maxChartVal > 0 ? (Math.abs(amount) / maxChartVal) * 100 : 0;
            const cardGrad = getCurrencyCardGradient(curr);

            return (
              <div
                key={curr}
                className={`relative flex min-h-[130px] flex-col justify-between overflow-hidden rounded-[24px] p-5 shadow-lg border border-white/10 bg-gradient-to-br ${cardGrad} group transition-transform duration-300 hover:-translate-y-1`}
              >
                <div className="absolute top-0 right-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-white/10 blur-2xl pointer-events-none group-hover:bg-white/20 transition-colors duration-500" />
                <div className="ios-glossy-shine" />
                
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] opacity-80">
                      {curr}
                    </span>
                    <span
                      className="mt-2 block text-lg xl:text-xl font-black leading-tight tracking-tight text-white whitespace-nowrap overflow-hidden text-ellipsis"
                      title={formatCurrency(amount, curr)}
                    >
                      {formatCurrency(amount, curr)}
                    </span>
                  </div>
                  <div className="ios-card-chip shrink-0 scale-90 opacity-90">
                    <div className="ios-card-chip-lines" />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider opacity-75 mb-1.5">
                    <span>Cash Level</span>
                    <span>{Math.round(percentage)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/20">
                    <div
                      style={{ width: `${Math.min(100, percentage || 12)}%` }}
                      className="h-full rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <GlassCard className="p-5">
            <div className="mb-4 flex items-center justify-between border-b border-sky-100/80 pb-4">
              <h2 className="text-lg font-black text-slate-900">{LABELS.latestRecords}</h2>
              <Link to="/transactions" className="text-xs font-bold text-sky-600 hover:text-sky-700">
                {LABELS.viewAll}
              </Link>
            </div>

            {/* Mobile Cards View (Visible on mobile, hidden on desktop) */}
            <div className="block md:hidden space-y-3">
              {recent.map((tx) => (
                <div key={tx.id} className="p-4.5 bg-white border border-sky-100/70 rounded-2xl flex items-center justify-between gap-3 shadow-sm active:bg-sky-50/40 active:scale-[0.98] transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center font-black text-[10px] ${
                      tx.type === 'Received' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {tx.type === 'Received' ? 'IN' : 'OUT'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-slate-900 text-sm truncate">{tx.receipt_no}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide ${
                          tx.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : tx.status === 'Pending' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">{tx.customer_name}</p>
                      <span className="text-[10px] text-sky-600 font-bold block mt-0.5">{tx.date}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-black ${tx.type === 'Received' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.type === 'Received' ? '+' : '-'}
                      {formatCurrency(tx.amount, tx.currency)}
                    </span>
                    <span className="block text-[9px] font-bold text-slate-400 mt-0.5">{tx.payment_method}</span>
                  </div>
                </div>
              ))}
              {recent.length === 0 && (
                <div className="py-8 text-center text-sm font-semibold text-sky-400">
                  {LABELS.noTransactionsYet}
                </div>
              )}
            </div>

  {/* Desktop Table View (Hidden on mobile, visible on desktop) */}
  <div className="hidden md:block app-scrollbar overflow-x-auto">
    <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-sky-100/70 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    <th className="py-4 pr-3">{LABELS.receiptNo}</th>
                    <th className="px-3 py-4">{LABELS.date}</th>
                    <th className="px-3 py-4">{LABELS.customer}</th>
                    <th className="px-3 py-4 text-right">{LABELS.amount}</th>
                    <th className="px-3 py-4">{LABELS.method}</th>
                    <th className="py-4 pl-3">{LABELS.status}</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-semibold text-slate-600">
                  {recent.map((tx) => (
                    <tr key={tx.id} className="transition-all hover:bg-slate-50/80 border-b border-sky-100/40 last:border-0 group">
                      <td className="py-4 pr-3 font-black text-slate-800 group-hover:text-sky-600 transition-colors">{tx.receipt_no}</td>
                      <td className="px-3 py-4 text-slate-500 font-bold">{tx.date}</td>
                      <td className="px-3 py-4">
                        <span className="block max-w-[180px] truncate text-slate-700 font-bold">{tx.customer_name}</span>
                      </td>
                      <td
                        className={`px-3 py-4 text-right font-black ${
                          tx.type === 'Received' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {tx.type === 'Received' ? '+' : '-'}
                        {formatCurrency(tx.amount, tx.currency)}
                      </td>
                      <td className="px-3 py-4 font-semibold text-slate-400">{tx.payment_method}</td>
                      <td className="py-4 pl-3">
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-widest ${
                            tx.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-600'
                              : tx.status === 'Pending'
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {recent.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-sm font-bold text-slate-400">
                        {LABELS.noTransactionsYet}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="mb-5 flex items-center justify-between border-b border-sky-100/80 pb-4">
              <h2 className="text-lg font-black text-slate-900">{LABELS.cashFlowHistory}</h2>
              <div className="flex items-center gap-4 text-[10px] font-extrabold uppercase tracking-[0.12em] text-sky-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {LABELS.received}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  {LABELS.paid}
                </span>
              </div>
            </div>

            {chartData.length > 0 ? (
              <div className="relative flex h-64 flex-col justify-between pt-4">
                <div className="pointer-events-none absolute inset-x-0 bottom-8 top-4 flex flex-col justify-between">
                  {[0, 25, 50, 75, 100].map((perc) => (
                    <div key={perc} className="flex w-full justify-end border-t border-sky-100/50">
                      <span className="-mt-2 pr-1 text-[8px] font-bold text-sky-300">
                        {formatCurrency((maxChartVal * perc) / 100, 'USD')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="z-10 flex flex-1 items-end justify-around pb-2">
                  {chartData.map((item) => {
                    const recH = (item.received / maxChartVal) * 100;
                    const paidH = (item.paid / maxChartVal) * 100;

                    return (
                      <div key={item.month} className="group flex w-12 flex-col items-center gap-2 text-center">
                        <div className="flex h-44 w-full items-end justify-center gap-1.5">
                          <div
                            style={{ height: `${Math.max(4, recH)}%` }}
                            className="w-3.5 rounded-t-sm bg-emerald-500 shadow-md transition-all duration-300 group-hover:brightness-105"
                            title={`Received: ${formatCurrency(item.received, 'USD')}`}
                          />
                          <div
                            style={{ height: `${Math.max(4, paidH)}%` }}
                            className="w-3.5 rounded-t-sm bg-rose-500 shadow-md transition-all duration-300 group-hover:brightness-105"
                            title={`Paid: ${formatCurrency(item.paid, 'USD')}`}
                          />
                        </div>
                        <span className="text-[10px] font-bold tracking-wider text-sky-500/70">
                          {item.month.split('-')[1]}/{item.month.split('-')[0].substring(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm font-semibold text-sky-400">
                {LABELS.notEnoughData}
              </div>
            )}
          </GlassCard>
        </div>

        <div className="min-w-0 space-y-6">
          <GlassCard className="p-5">
            <div className="mb-5 flex items-center justify-between border-b border-sky-100/80 pb-4">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <Building size={18} className="text-sky-500" />
                <span>{LABELS.bankAccounts}</span>
              </h2>
              <Link to="/bank-ledger" className="text-xs font-bold text-sky-600 hover:text-sky-700">
                {LABELS.manage}
              </Link>
            </div>

            <div className="space-y-3.5">
              {banks.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-white/60 p-4"
                >
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-black text-slate-900">{acc.account_name}</h4>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-sky-500">
                      {acc.bank_name} • {acc.account_number}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-black text-slate-900">
                    {formatCurrency(acc.current_balance, acc.currency)}
                  </span>
                </div>
              ))}
              {banks.length === 0 && (
                <p className="py-4 text-center text-xs font-semibold text-sky-400">{LABELS.noAccountsYet}</p>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="mb-5 flex items-center justify-between border-b border-sky-100/80 pb-4">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <Activity size={18} className="text-sky-500" />
                <span>{LABELS.activityLog}</span>
              </h2>
              <Link to="/backup" className="text-xs font-bold text-sky-600 hover:text-sky-700">
                {LABELS.fullLog}
              </Link>
            </div>

            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-xs font-semibold text-slate-700">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                  <div className="min-w-0">
                    <p className="leading-snug">{log.description}</p>
                    <span className="mt-1 block text-[9px] font-medium text-sky-400">
                      {formatDate(log.created_at)} • User {log.user_id || 'System'}
                    </span>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="py-4 text-center text-xs font-semibold text-sky-400">{LABELS.noAuditLogs}</p>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

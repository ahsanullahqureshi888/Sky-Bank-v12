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
  Users,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Coins,
  ChevronRight,
} from 'lucide-react';
import { backupAPI, bankAPI, dashboardAPI } from '../api/client';
import GlassCard from '../components/GlassCard';
import StatCard from '../components/StatCard';
import { formatCurrency, formatDate, safeGetStoredItem, safeGetStoredUser } from '../utils/formatters';
import { useTranslation } from 'react-i18next';

const currencies = ['USD', 'Toman', 'Dirham', 'Afghani'];
const INFLOW_TYPES = new Set(['Received', 'Import']);
const isInflow = (type) => INFLOW_TYPES.has(type);

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
  const LABELS = t('dashboard', { returnObjects: true }) || {};
  const [summary, setSummary] = useState(() => safeGetStoredItem('sky_dashboard_summary', null));
  const [recent, setRecent] = useState(() => safeGetStoredItem('sky_dashboard_recent', []));
  const [chartData, setChartData] = useState([]);
  const [banks, setBanks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(() => !safeGetStoredItem('sky_dashboard_summary', null));
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const user = safeGetStoredUser();

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!summary) setLoading(true);
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

    if (sumRes.status === 'fulfilled') {
      setSummary(sumRes.value.data);
      try { localStorage.setItem('sky_dashboard_summary', JSON.stringify(sumRes.value.data)); } catch (_) {}
    }
    if (recRes.status === 'fulfilled') {
      const recList = Array.isArray(recRes.value.data) ? recRes.value.data : [];
      setRecent(recList);
      try { localStorage.setItem('sky_dashboard_recent', JSON.stringify(recList)); } catch (_) {}
    }
    if (chartRes.status === 'fulfilled') setChartData(Array.isArray(chartRes.value.data) ? chartRes.value.data : []);
    if (bankRes.status === 'fulfilled') setBanks(Array.isArray(bankRes.value.data) ? bankRes.value.data : []);
    if (logsRes.status === 'fulfilled') setLogs(Array.isArray(logsRes.value.data) ? logsRes.value.data.slice(0, 6) : []);
    else setLogs([]);

    if (coreFailures.length === coreResults.length && !summary) {
      setLoadError('Dashboard data could not be loaded. Check the connection and try again.');
    } else if (coreFailures.length > 0 && !summary) {
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg shadow-sky-500/10 border border-sky-100">
          <Loader2 size={24} className="animate-spin text-sky-600" />
        </div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-600">
          {LABELS?.loading || 'Loading dashboard summary...'}
        </p>
      </div>
    );
  }

  const maxChartVal = chartData.reduce(
    (max, item) => Math.max(max, item.received || 0, item.paid || 0),
    1000
  );

  return (
    <div className="mx-auto w-full max-w-[1640px] space-y-6">
      
      {/* Mobile Header & iOS Wallet Card */}
      <div className="md:hidden space-y-4 ios-card-fade-up">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[9px] font-black uppercase tracking-[0.18em] text-sky-600">
              {LABELS?.welcomeBack || 'Welcome Back'}
            </h2>
            <h1 className="text-xl font-black text-slate-900 mt-0.5">
              {LABELS?.hi || 'Hi, '}{user.name || 'User'} 👋
            </h1>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-sky-100 text-sky-600 shadow-xs active:scale-95 transition-all"
            aria-label="Refresh"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Apple Wallet Style Wealth Card */}
        <div className="relative pt-2 pb-1">
          <div className="relative z-10 ios-wallet-card text-white p-5 shadow-xl shadow-sky-950/20 border border-amber-400/20">
            <div className="ios-glossy-shine" />
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">
                  {LABELS?.skyAriana || 'SKY ARIANA GROUP'}
                </span>
                <h2 className="text-3xl font-black mt-2 leading-none tracking-tight">
                  {formatCurrency(summary?.total_balance || 0, 'USD')}
                </h2>
                <span className="text-[9px] text-emerald-400 font-extrabold mt-1.5 inline-flex items-center gap-1 uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {LABELS?.netAccountBalance || 'Net Consolidated Balance'}
                </span>
              </div>
              <div className="h-11 w-11 bg-white/10 rounded-2xl flex items-center justify-center border border-white/15 backdrop-blur-md">
                <Scale size={22} className="text-amber-300" />
              </div>
            </div>

            <div className="mt-6 pt-3.5 border-t border-white/10 flex justify-between text-xs font-bold text-white/80">
              <div>
                <span className="block text-[8px] uppercase tracking-wider text-white/50">
                  {LABELS?.todaysTx || "Today's Tx"}
                </span>
                <span className="font-extrabold">{summary?.todays_transactions || 0} Records</span>
              </div>
              <div className="text-right">
                <span className="block text-[8px] uppercase tracking-wider text-white/50">
                  {LABELS?.thisMonth || 'This Month'}
                </span>
                <span className="font-extrabold">{summary?.monthly_transactions || 0} Records</span>
              </div>
            </div>
          </div>
        </div>

        {/* Small stats row */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 bg-white border border-emerald-100 rounded-2xl flex items-center gap-2.5 shadow-xs">
            <div className="h-8 w-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <TrendingUp size={15} />
            </div>
            <div className="min-w-0">
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">
                {LABELS?.received || 'Received'}
              </span>
              <span className="text-xs font-black text-emerald-700 truncate block">
                {formatCurrency(summary?.total_received || 0, 'USD')}
              </span>
            </div>
          </div>

          <div className="p-3 bg-white border border-rose-100 rounded-2xl flex items-center gap-2.5 shadow-xs">
            <div className="h-8 w-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <TrendingDown size={15} />
            </div>
            <div className="min-w-0">
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">
                {LABELS?.paid || 'Paid'}
              </span>
              <span className="text-xs font-black text-rose-700 truncate block">
                {formatCurrency(summary?.total_paid || 0, 'USD')}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="space-y-2 pt-1">
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 pl-1">
            {LABELS?.quickActions || 'Quick Actions'}
          </h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            <Link to="/add-transaction" className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border border-sky-100 rounded-2xl active:scale-95 transition-all shadow-xs">
              <div className="h-10 w-10 bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-sky-500/20">
                <Plus size={18} />
              </div>
              <span className="text-[9px] font-extrabold text-slate-700">{LABELS?.newTx || 'New Tx'}</span>
            </Link>

            <Link to="/customer-ledger" className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border border-emerald-100 rounded-2xl active:scale-95 transition-all shadow-xs">
              <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20">
                <Users size={18} />
              </div>
              <span className="text-[9px] font-extrabold text-slate-700">{LABELS?.ledgers || 'Ledgers'}</span>
            </Link>

            <Link to="/sarafi-ledger" className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border border-amber-100 rounded-2xl active:scale-95 transition-all shadow-xs">
              <div className="h-10 w-10 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-amber-500/20">
                <Scale size={18} />
              </div>
              <span className="text-[9px] font-extrabold text-slate-700">Sarafi</span>
            </Link>

            <Link to="/bank-ledger" className="flex flex-col items-center justify-center gap-1.5 p-2 bg-white border border-indigo-100 rounded-2xl active:scale-95 transition-all shadow-xs">
              <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Building size={18} />
              </div>
              <span className="text-[9px] font-extrabold text-slate-700">{LABELS?.manage || 'Banks'}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Desktop Executive Header */}
      <div className="hidden md:flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black leading-tight text-slate-900 md:text-3xl tracking-tight">
              {LABELS?.dashboardTitle || 'Financial Command Center'}
            </h1>
            {user?.role && (
              <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-sky-700 border border-sky-200/80 shadow-2xs">
                {user.role}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {LABELS?.dashboardSubtitle || 'Real-time Hawala, Sarafi, and money transaction management overview.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto print:hidden">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sky-100 bg-white/90 px-4 text-xs font-black uppercase tracking-wider text-sky-700 shadow-xs transition hover:bg-sky-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 print:hidden"
            aria-label="Refresh dashboard"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <Link
            to="/add-transaction"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-sky-500/20 transition-all hover:from-sky-700 hover:to-blue-700 active:scale-95 print:hidden"
          >
            <Plus size={15} />
            <span>{LABELS?.newTransactionBtn || '+ New Transaction'}</span>
          </Link>
        </div>
      </div>

      {/* Error Alert Banner */}
      {loadError && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm font-semibold text-amber-900 shadow-2xs sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="inline-flex items-center gap-1.5 w-fit rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-900 transition hover:bg-amber-200 print:hidden"
          >
            <RefreshCw size={13} />
            <span>Try again</span>
          </button>
        </div>
      )}

      {/* Desktop StatCards Grid */}
      <div className="hidden md:grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title={LABELS?.received || 'Total Received'}
          value={formatCurrency(summary?.total_received || 0, 'USD')}
          icon={TrendingUp}
          colorClass="text-emerald-600"
          bgClass="bg-gradient-to-br from-emerald-50/90 via-white to-emerald-100/40"
        />
        <StatCard
          title={LABELS?.paid || 'Total Paid'}
          value={formatCurrency(summary?.total_paid || 0, 'USD')}
          icon={TrendingDown}
          colorClass="text-rose-600"
          bgClass="bg-gradient-to-br from-rose-50/90 via-white to-rose-100/40"
        />
        <StatCard
          title={LABELS?.netAccountBalance || 'Net Balance'}
          value={formatCurrency(summary?.total_balance || 0, 'USD')}
          icon={Scale}
          colorClass="text-sky-600"
          bgClass="bg-gradient-to-br from-sky-50/90 via-white to-sky-100/40"
        />
        <StatCard
          title={LABELS?.todaysTx || 'Today Transactions'}
          value={summary?.todays_transactions || 0}
          icon={Calendar}
          colorClass="text-indigo-600"
          bgClass="bg-gradient-to-br from-indigo-50/90 via-white to-indigo-100/40"
        />
        <StatCard
          title={LABELS?.thisMonth || 'This Month'}
          value={summary?.monthly_transactions || 0}
          icon={Clock}
          colorClass="text-amber-600"
          bgClass="bg-gradient-to-br from-amber-50/90 via-white to-amber-100/40"
        />
      </div>

      {/* Multi-Currency Liquidity Vaults */}
      <GlassCard className="p-5 sm:p-6 shadow-xl shadow-sky-950/[0.04]">
        <div className="mb-5 flex flex-col gap-3 border-b border-sky-100/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-xs">
              <Coins size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">
                {LABELS?.currencyBreakdown || 'Multi-Currency Liquidity Vaults'}
              </h2>
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Real-time cash balances by trading currency</p>
            </div>
          </div>
          <span className="w-fit rounded-lg bg-sky-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700 border border-sky-100">
            {LABELS?.equivalentCash || 'Live Valuation'}
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
                className={`relative flex min-h-[135px] flex-col justify-between overflow-hidden rounded-[24px] p-5 shadow-lg border border-white/15 bg-gradient-to-br ${cardGrad} group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
              >
                <div className="absolute top-0 right-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-white/10 blur-2xl pointer-events-none group-hover:bg-white/20 transition-colors duration-500" />
                <div className="ios-glossy-shine" />
                
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-black uppercase tracking-[0.18em] opacity-80">
                      {curr}
                    </span>
                    <span
                      className="mt-2 block text-xl xl:text-2xl font-black leading-tight tracking-tight text-white whitespace-nowrap overflow-hidden text-ellipsis"
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
                  <div className="flex justify-between text-[9px] font-extrabold uppercase tracking-wider opacity-80 mb-1.5">
                    <span>Vault Capacity</span>
                    <span>{Math.round(percentage)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/20">
                    <div
                      style={{ width: `${Math.min(100, Math.max(12, percentage))}%` }}
                      className="h-full rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)] transition-all duration-500"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left Column: Recent Transactions & Cash Flow Chart */}
        <div className="min-w-0 space-y-6 xl:col-span-2">
          
          {/* Latest Transactions */}
          <GlassCard className="p-5 sm:p-6 shadow-xl shadow-sky-950/[0.04]">
            <div className="mb-4 flex items-center justify-between border-b border-sky-100/80 pb-4">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-sky-600" />
                <h2 className="text-base font-black text-slate-900">
                  {LABELS?.latestRecords || 'Recent Transactions Feed'}
                </h2>
              </div>
              <Link
                to="/transactions"
                className="inline-flex items-center gap-1 text-xs font-black text-sky-600 hover:text-sky-700 transition-colors"
              >
                <span>{LABELS?.viewAll || 'View All Archive'}</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden space-y-3">
              {recent.map((tx) => (
                <div key={tx.id} className="p-4 bg-white border border-sky-100/80 rounded-2xl flex items-center justify-between gap-3 shadow-2xs active:bg-sky-50/40 active:scale-[0.98] transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center font-black text-[10px] ${
                      isInflow(tx.type) ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
                    }`}>
                      {isInflow(tx.type) ? 'IN' : 'OUT'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-slate-900 text-sm truncate">{tx.receipt_no}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide ${
                          tx.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60' : tx.status === 'Pending' ? 'bg-amber-50 text-amber-600 border border-amber-200/60' : 'bg-rose-50 text-rose-600 border border-rose-200/60'
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">{tx.customer_name}</p>
                      <span className="text-[10px] text-sky-600 font-bold block mt-0.5">{tx.date}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-black ${isInflow(tx.type) ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isInflow(tx.type) ? '+' : '-'}
                      {formatCurrency(tx.amount, tx.currency)}
                    </span>
                    <span className="block text-[9px] font-bold text-slate-400 mt-0.5">{tx.payment_method}</span>
                  </div>
                </div>
              ))}
              {recent.length === 0 && (
                <div className="py-8 text-center text-xs font-bold text-sky-400 flex flex-col items-center gap-2">
                  <Activity size={24} className="text-sky-200" />
                  <span>{LABELS?.noTransactionsYet || 'No transactions recorded yet.'}</span>
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block app-scrollbar overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-sky-100/70 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    <th className="py-3.5 pr-3">{LABELS?.receiptNo || 'Receipt No'}</th>
                    <th className="px-3 py-3.5">{LABELS?.date || 'Date'}</th>
                    <th className="px-3 py-3.5">{LABELS?.customer || 'Customer'}</th>
                    <th className="px-3 py-3.5 text-right">{LABELS?.amount || 'Amount'}</th>
                    <th className="px-3 py-3.5">{LABELS?.method || 'Method'}</th>
                    <th className="py-3.5 pl-3">{LABELS?.status || 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-semibold text-slate-600">
                  {recent.map((tx) => (
                    <tr key={tx.id} className="transition-all hover:bg-sky-50/50 border-b border-sky-100/50 last:border-0 group">
                      <td className="py-3.5 pr-3 font-black text-slate-800 group-hover:text-sky-600 transition-colors">{tx.receipt_no}</td>
                      <td className="px-3 py-3.5 text-slate-500 font-bold text-xs">{tx.date}</td>
                      <td className="px-3 py-3.5">
                        <span className="block max-w-[180px] truncate text-slate-800 font-bold">{tx.customer_name}</span>
                      </td>
                      <td
                        className={`px-3 py-3.5 text-right font-black ${
                          isInflow(tx.type) ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {isInflow(tx.type) ? '+' : '-'}
                        {formatCurrency(tx.amount, tx.currency)}
                      </td>
                      <td className="px-3 py-3.5 font-semibold text-slate-500 text-xs">{tx.payment_method}</td>
                      <td className="py-3.5 pl-3">
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${
                            tx.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                              : tx.status === 'Pending'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {recent.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-xs font-bold text-slate-400">
                        {LABELS?.noTransactionsYet || 'No transactions recorded yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Cash Flow History Chart */}
          <GlassCard className="p-5 sm:p-6 shadow-xl shadow-sky-950/[0.04]">
            <div className="mb-5 flex items-center justify-between border-b border-sky-100/80 pb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-sky-600" />
                <h2 className="text-base font-black text-slate-900">
                  {LABELS?.cashFlowHistory || 'Cash Flow Performance Chart'}
                </h2>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-2xs shadow-emerald-500/50" />
                  {LABELS?.received || 'Received'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-2xs shadow-rose-500/50" />
                  {LABELS?.paid || 'Paid'}
                </span>
              </div>
            </div>

            {chartData.length > 0 ? (
              <div className="relative flex h-64 flex-col justify-between pt-4">
                {/* Y-axis gridlines */}
                <div className="pointer-events-none absolute inset-x-0 bottom-8 top-4 flex flex-col justify-between">
                  {[100, 75, 50, 25, 0].map((perc) => (
                    <div key={perc} className="flex w-full justify-end border-t border-sky-100/60">
                      <span className="-mt-2 pr-1 text-[8px] font-black text-sky-400">
                        {formatCurrency((maxChartVal * perc) / 100, 'USD')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bars display */}
                <div className="z-10 flex flex-1 items-end justify-around pb-2 pl-8">
                  {chartData.map((item) => {
                    const recH = (item.received / maxChartVal) * 100;
                    const paidH = (item.paid / maxChartVal) * 100;

                    return (
                      <div key={item.month} className="group flex w-12 flex-col items-center gap-2 text-center">
                        <div className="flex h-44 w-full items-end justify-center gap-1.5">
                          <div
                            style={{ height: `${Math.max(4, recH)}%` }}
                            className="w-3.5 rounded-t-md bg-emerald-500 shadow-md shadow-emerald-500/20 transition-all duration-300 group-hover:brightness-110 group-hover:scale-x-110"
                            title={`Received: ${formatCurrency(item.received, 'USD')}`}
                          />
                          <div
                            style={{ height: `${Math.max(4, paidH)}%` }}
                            className="w-3.5 rounded-t-md bg-rose-500 shadow-md shadow-rose-500/20 transition-all duration-300 group-hover:brightness-110 group-hover:scale-x-110"
                            title={`Paid: ${formatCurrency(item.paid, 'USD')}`}
                          />
                        </div>
                        <span className="text-[10px] font-extrabold tracking-wider text-slate-500">
                          {item.month.split('-')[1]}/{item.month.split('-')[0].substring(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-xs font-bold text-sky-400">
                <TrendingUp size={24} className="text-sky-200" />
                <span>{LABELS?.notEnoughData || 'Not enough transaction data to plot.'}</span>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right Column: Bank Accounts & Audit Log */}
        <div className="min-w-0 space-y-6">
          {/* Bank Accounts Widget */}
          <GlassCard className="p-5 sm:p-6 shadow-xl shadow-sky-950/[0.04]">
            <div className="mb-5 flex items-center justify-between border-b border-sky-100/80 pb-4">
              <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
                <Building size={18} className="text-sky-600" />
                <span>{LABELS?.bankAccounts || 'Bank Vaults'}</span>
              </h2>
              <Link
                to="/bank-ledger"
                className="inline-flex items-center gap-1 text-xs font-black text-sky-600 hover:text-sky-700 transition-colors"
              >
                <span>{LABELS?.manage || 'Manage'}</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="space-y-3">
              {banks.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-sky-100/80 bg-white/80 p-3.5 shadow-2xs hover:bg-sky-50/50 hover:border-sky-200 transition-all"
                >
                  <div className="min-w-0">
                    <h4 className="truncate text-xs font-black text-slate-900">{acc.account_name}</h4>
                    <p className="mt-0.5 truncate text-[10px] font-bold text-slate-500">
                      {acc.bank_name} • {acc.account_number}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-black text-slate-900">
                    {formatCurrency(acc.current_balance, acc.currency)}
                  </span>
                </div>
              ))}
              {banks.length === 0 && (
                <p className="py-6 text-center text-xs font-bold text-sky-400">
                  {LABELS?.noAccountsYet || 'No accounts added yet.'}
                </p>
              )}
            </div>
          </GlassCard>

          {/* Activity Log Widget */}
          <GlassCard className="p-5 sm:p-6 shadow-xl shadow-sky-950/[0.04]">
            <div className="mb-5 flex items-center justify-between border-b border-sky-100/80 pb-4">
              <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
                <ShieldCheck size={18} className="text-sky-600" />
                <span>{LABELS?.activityLog || 'Security & Audit Stream'}</span>
              </h2>
              <Link
                to="/backup"
                className="inline-flex items-center gap-1 text-xs font-black text-sky-600 hover:text-sky-700 transition-colors"
              >
                <span>{LABELS?.fullLog || 'Full Log'}</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="space-y-3.5">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-xs font-semibold text-slate-700 group">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500 ring-4 ring-sky-100 transition-all group-hover:scale-125" />
                  <div className="min-w-0">
                    <p className="leading-snug text-slate-800 font-bold text-xs">{log.description}</p>
                    <span className="mt-1 block text-[9px] font-bold text-slate-400">
                      {formatDate(log.created_at)} • User {log.user_id || 'System'}
                    </span>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="py-6 text-center text-xs font-bold text-sky-400">
                  {LABELS?.noAuditLogs || 'No audit logs available.'}
                </p>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

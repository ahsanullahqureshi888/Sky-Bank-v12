import React, { useMemo, useState } from 'react';
import { LedgerTransaction } from '../types/ledger';
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Printer,
  X,
  CheckCircle2,
  Search,
  Wallet,
  Users,
  ArrowUpDown,
  ListFilter,
  FileDown,
} from 'lucide-react';

interface CustomerLedgerTableProps {
  transactions: LedgerTransaction[];
}

type DirectionFilter = 'all' | 'in' | 'out';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrency = (amount: number) => currencyFormatter.format(amount);
const formatAmount = (amount: number) => numberFormatter.format(amount);

/** Deterministic accent per entity so the same name always gets the same chip color. */
const ENTITY_ACCENTS = [
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-slate-200 text-slate-700',
];

const entityAccent = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 9973;
  }
  return ENTITY_ACCENTS[hash % ENTITY_ACCENTS.length];
};

const entityInitials = (name: string) =>
  name
    .replace(/[^A-Za-z\s/]/g, ' ')
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const CustomerLedgerTable: React.FC<CustomerLedgerTableProps> = ({
  transactions: initialTransactions,
}) => {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>(initialTransactions);
  const [showAddModal, setShowAddModal] = useState<'cash-in' | 'cash-out' | null>(null);
  const [newTx, setNewTx] = useState({ entity: '', amount: '' });
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [newestFirst, setNewestFirst] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Totals always reflect the full ledger, never the filtered view.
  const summary = useMemo(() => {
    const totals = transactions.reduce(
      (acc, tx) => {
        acc.totalCashIn += tx.cashIn;
        acc.totalCashOut += tx.cashOut;
        acc.entities.add(tx.associatedEntity);
        return acc;
      },
      { totalCashIn: 0, totalCashOut: 0, entities: new Set<string>() }
    );

    return {
      totalCashIn: totals.totalCashIn,
      totalCashOut: totals.totalCashOut,
      entityCount: totals.entities.size,
      finalBalance:
        transactions.length > 0 ? transactions[transactions.length - 1].runningBalance : 0,
    };
  }, [transactions]);

  const visibleTransactions = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = transactions.filter((tx) => {
      if (direction === 'in' && tx.cashIn <= 0) return false;
      if (direction === 'out' && tx.cashOut <= 0) return false;
      if (!needle) return true;
      return (
        tx.associatedEntity.toLowerCase().includes(needle) ||
        String(tx.serialNumber).includes(needle)
      );
    });

    return newestFirst ? [...filtered].reverse() : filtered;
  }, [transactions, query, direction, newestFirst]);

  const filteredTotals = useMemo(
    () =>
      visibleTransactions.reduce(
        (acc, tx) => ({
          cashIn: acc.cashIn + tx.cashIn,
          cashOut: acc.cashOut + tx.cashOut,
        }),
        { cashIn: 0, cashOut: 0 }
      ),
    [visibleTransactions]
  );

  const isFiltered = query.trim().length > 0 || direction !== 'all';

  const handlePrint = () => window.print();

  const handleExportCsv = () => {
    const header = ['S.No', 'Entity / Sarafi', 'Cash In', 'Cash Out', 'Balance'];
    const rows = visibleTransactions.map((tx) => [
      tx.serialNumber,
      `"${tx.associatedEntity.replace(/"/g, '""')}"`,
      tx.cashIn,
      tx.cashOut,
      tx.runningBalance,
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customer-sarafi-ledger.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.entity || !newTx.amount) return;

    const amountNum = parseFloat(newTx.amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) return;

    const lastBalance =
      transactions.length > 0 ? transactions[transactions.length - 1].runningBalance : 0;

    const newRecord: LedgerTransaction = {
      serialNumber: transactions.length + 1,
      associatedEntity: newTx.entity,
      cashIn: showAddModal === 'cash-in' ? amountNum : 0,
      cashOut: showAddModal === 'cash-out' ? amountNum : 0,
      runningBalance:
        showAddModal === 'cash-in' ? lastBalance + amountNum : lastBalance - amountNum,
    };

    const txTypeLabel = showAddModal === 'cash-in' ? 'Cash in' : 'Cash out';
    const entityName = newTx.entity;

    setTransactions([...transactions, newRecord]);
    setShowAddModal(null);
    setNewTx({ entity: '', amount: '' });

    setToast({
      type: 'success',
      message: `${txTypeLabel} of ${formatCurrency(amountNum)} recorded for ${entityName}.`,
    });
    window.setTimeout(() => setToast(null), 3500);
  };

  const filterTabs: Array<{ id: DirectionFilter; label: string; activeClass: string }> = [
    { id: 'all', label: 'All', activeClass: 'bg-slate-800 text-white shadow-sm' },
    { id: 'in', label: 'Cash In', activeClass: 'bg-emerald-500 text-white shadow-sm' },
    { id: 'out', label: 'Cash Out', activeClass: 'bg-rose-500 text-white shadow-sm' },
  ];

  return (
    <div className="mx-auto flex h-full w-full flex-col gap-4 p-2 pb-20 md:p-4 lg:p-6">
      {/* Header */}
      <header className="flex flex-col gap-4 print:hidden lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">
            Customer &amp; Sarafi Ledger
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-500 sm:text-sm">
            Historical transaction records and running balances
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="group inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 hover:shadow-md sm:text-sm"
          >
            <FileDown size={15} className="flex-shrink-0 transition-transform group-hover:scale-110" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={handlePrint}
            className="group inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 hover:shadow-md sm:text-sm"
            aria-label="Print ledger"
          >
            <Printer size={15} className="flex-shrink-0 transition-transform group-hover:scale-110" />
            <span className="hidden sm:inline">Print</span>
          </button>

          <button
            onClick={() => setShowAddModal('cash-in')}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-500 sm:px-4 sm:text-sm"
          >
            <ArrowDownLeft size={15} strokeWidth={3} className="flex-shrink-0" />
            Cash In
          </button>

          <button
            onClick={() => setShowAddModal('cash-out')}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white shadow-lg shadow-rose-600/20 transition-all hover:-translate-y-0.5 hover:bg-rose-500 sm:px-4 sm:text-sm"
          >
            <ArrowUpRight size={15} strokeWidth={3} className="flex-shrink-0" />
            Cash Out
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 print:hidden lg:grid-cols-4">
        <div className="rounded-2xl border border-white bg-white/70 p-3 shadow-[0_8px_24px_rgba(15,32,60,0.05)] backdrop-blur-xl sm:p-4">
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
            <TrendingUp size={13} className="text-emerald-500" /> Cash In
          </span>
          <p className="mt-1.5 text-lg font-black text-emerald-600 sm:text-2xl">
            {formatCurrency(summary.totalCashIn)}
          </p>
        </div>

        <div className="rounded-2xl border border-white bg-white/70 p-3 shadow-[0_8px_24px_rgba(15,32,60,0.05)] backdrop-blur-xl sm:p-4">
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
            <TrendingDown size={13} className="text-rose-500" /> Cash Out
          </span>
          <p className="mt-1.5 text-lg font-black text-rose-600 sm:text-2xl">
            {formatCurrency(summary.totalCashOut)}
          </p>
        </div>

        <div className="rounded-2xl border border-white bg-white/70 p-3 shadow-[0_8px_24px_rgba(15,32,60,0.05)] backdrop-blur-xl sm:p-4">
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
            <Users size={13} className="text-sky-500" /> Entities
          </span>
          <p className="mt-1.5 text-lg font-black text-slate-800 sm:text-2xl">
            {summary.entityCount}
            <span className="ml-1.5 text-xs font-bold text-slate-400">
              / {transactions.length} txns
            </span>
          </p>
        </div>

        <div
          className={`rounded-2xl border p-3 shadow-[0_8px_24px_rgba(15,32,60,0.18)] transition-all sm:p-4 ${
            summary.finalBalance < 0
              ? 'border-rose-700 bg-gradient-to-br from-rose-900 to-rose-950'
              : 'border-slate-700 bg-slate-900'
          }`}
        >
          <span
            className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${
              summary.finalBalance < 0 ? 'text-rose-300' : 'text-slate-400'
            }`}
          >
            <Wallet
              size={13}
              className={summary.finalBalance < 0 ? 'text-rose-400' : 'text-sky-400'}
            />{' '}
            Final Balance
          </span>
          <p className="mt-1.5 text-lg font-black text-white sm:text-2xl">
            {formatCurrency(summary.finalBalance)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 print:hidden lg:flex-row lg:items-center lg:justify-between">
        <label className="relative flex-1 lg:max-w-sm">
          <span className="sr-only">Search ledger by entity or serial number</span>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entity or S.No..."
            className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white/80 pl-9 pr-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-all placeholder:font-medium placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/15"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white/80 p-1 shadow-sm"
            role="group"
            aria-label="Filter by direction"
          >
            <ListFilter size={14} className="ml-1.5 flex-shrink-0 text-slate-400" />
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDirection(tab.id)}
                aria-pressed={direction === tab.id}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all sm:text-xs ${
                  direction === tab.id
                    ? tab.activeClass
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setNewestFirst((prev) => !prev)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 text-[11px] font-bold text-slate-600 shadow-sm transition-all hover:border-sky-300 hover:text-sky-700 sm:text-xs"
          >
            <ArrowUpDown size={14} className="flex-shrink-0" />
            {newestFirst ? 'Newest first' : 'Oldest first'}
          </button>
        </div>
      </div>

      {/* Main Container for Table & Mobile Cards */}
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-white bg-white/70 shadow-[0_12px_40px_rgba(15,32,60,0.06)] backdrop-blur-2xl print:overflow-visible print:rounded-none print:border-none print:bg-white print:shadow-none md:rounded-[28px]">
        {/* Print-only clean statement header */}
        <div className="hidden border-b-2 border-slate-800 px-6 py-4 print:block">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black text-slate-800">Sky Ariana Limited</h1>
              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-600">
                Customer &amp; Sarafi Ledger Statement
              </p>
            </div>
            <div className="text-right text-[10px] font-semibold text-slate-500">
              <p>
                Generated:{' '}
                <span className="font-black text-slate-700">
                  {new Date().toLocaleDateString()}
                </span>
              </p>
              <p>
                Records: <span className="font-black text-slate-700">{transactions.length}</span>
              </p>
            </div>
          </div>
        </div>

        {visibleTransactions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
            <Search size={28} className="mx-auto mb-3 text-slate-300" />
            <p className="font-bold text-slate-600">No matching transactions</p>
            <p className="mt-1 text-sm text-slate-400">
              Try a different name, serial number, or filter.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card Feed View (hidden on md+ screens) */}
            <div className="block flex-1 overflow-auto p-3 space-y-3 app-scrollbar print:hidden md:hidden">
              {visibleTransactions.map((tx) => (
                <div
                  key={tx.serialNumber}
                  className="space-y-3 rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur-xl"
                >
                  {/* Card Header: Avatar + Entity + S.No Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${entityAccent(
                          tx.associatedEntity
                        )}`}
                        aria-hidden="true"
                      >
                        {entityInitials(tx.associatedEntity)}
                      </span>
                      <span
                        className="truncate font-bold text-slate-800"
                        title={tx.associatedEntity}
                      >
                        {tx.associatedEntity}
                      </span>
                    </div>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-500">
                      #{tx.serialNumber}
                    </span>
                  </div>

                  {/* 2-column Cash In / Cash Out */}
                  <div className="grid grid-cols-2 gap-2 border-y border-slate-100/80 py-2.5 text-xs">
                    <div>
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Cash In
                      </span>
                      {tx.cashIn > 0 ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-700">
                          <ArrowDownLeft
                            size={12}
                            strokeWidth={3}
                            className="flex-shrink-0 text-emerald-500"
                          />
                          {formatAmount(tx.cashIn)}
                        </span>
                      ) : (
                        <span className="mt-1 block font-bold text-slate-300">—</span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Cash Out
                      </span>
                      {tx.cashOut > 0 ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-lg border border-rose-100 bg-rose-50 px-2 py-0.5 text-xs font-bold tabular-nums text-rose-700">
                          <ArrowUpRight
                            size={12}
                            strokeWidth={3}
                            className="flex-shrink-0 text-rose-500"
                          />
                          {formatAmount(tx.cashOut)}
                        </span>
                      ) : (
                        <span className="mt-1 block font-bold text-slate-300">—</span>
                      )}
                    </div>
                  </div>

                  {/* Running Balance */}
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Running Balance
                    </span>
                    <span
                      className={`text-base font-black tabular-nums ${
                        tx.runningBalance < 0 ? 'text-rose-600' : 'text-slate-800'
                      }`}
                    >
                      {tx.runningBalance < 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="rounded bg-rose-100 px-1 py-0.5 text-[9px] font-extrabold text-rose-700">
                            NEG
                          </span>
                          {formatAmount(tx.runningBalance)}
                        </span>
                      ) : (
                        formatAmount(tx.runningBalance)
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (hidden on small screens, visible on md+) */}
            <div className="hidden flex-1 overflow-auto app-scrollbar print:block print:overflow-visible md:block">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-800/95 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-100 shadow-sm backdrop-blur-md print:border-b-2 print:border-slate-800 print:bg-white print:text-slate-800 print:shadow-none sm:text-[11px]">
                  <tr>
                    <th className="w-14 px-3 py-3.5 text-center sm:px-5 sm:py-4">S.No</th>
                    <th className="min-w-[200px] px-3 py-3.5 text-left sm:px-5 sm:py-4">
                      Entity / Sarafi
                    </th>
                    <th className="px-3 py-3.5 text-right sm:px-5 sm:py-4">Cash In</th>
                    <th className="px-3 py-3.5 text-right sm:px-5 sm:py-4">Cash Out</th>
                    <th className="px-3 py-3.5 text-right sm:px-5 sm:py-4">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                  {visibleTransactions.map((tx, idx) => (
                    <tr
                      key={tx.serialNumber}
                      className={`group text-sm transition-colors hover:bg-sky-50/60 print:hover:bg-transparent ${
                        idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-transparent'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center text-xs font-bold tabular-nums text-slate-400 transition-colors group-hover:text-sky-600 sm:px-5 sm:py-3 print:text-slate-600">
                        {tx.serialNumber}
                      </td>

                      <td className="px-3 py-2.5 sm:px-5 sm:py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-black print:hidden sm:flex ${entityAccent(
                              tx.associatedEntity
                            )}`}
                            aria-hidden="true"
                          >
                            {entityInitials(tx.associatedEntity)}
                          </span>
                          <span
                            className="truncate font-bold text-slate-700"
                            title={tx.associatedEntity}
                          >
                            {tx.associatedEntity}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-right sm:px-5 sm:py-3">
                        {tx.cashIn > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-sm font-bold tabular-nums text-emerald-700 print:border-none print:bg-transparent print:p-0">
                            <ArrowDownLeft
                              size={12}
                              strokeWidth={3}
                              className="flex-shrink-0 text-emerald-500 print:hidden"
                            />
                            {formatAmount(tx.cashIn)}
                          </span>
                        ) : (
                          <span className="font-bold text-slate-300 print:text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right sm:px-5 sm:py-3">
                        {tx.cashOut > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-1 text-sm font-bold tabular-nums text-rose-700 print:border-none print:bg-transparent print:p-0">
                            <ArrowUpRight
                              size={12}
                              strokeWidth={3}
                              className="flex-shrink-0 text-rose-500 print:hidden"
                            />
                            {formatAmount(tx.cashOut)}
                          </span>
                        ) : (
                          <span className="font-bold text-slate-300 print:text-slate-400">—</span>
                        )}
                      </td>

                      <td
                        className={`px-3 py-2.5 text-right text-sm font-black tabular-nums sm:px-5 sm:py-3 ${
                          tx.runningBalance < 0 ? 'text-rose-600' : 'text-slate-800'
                        }`}
                      >
                        {tx.runningBalance < 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="rounded bg-rose-100 px-1 py-0.5 text-[10px] font-extrabold text-rose-700">
                              NEG
                            </span>
                            {formatAmount(tx.runningBalance)}
                          </span>
                        ) : (
                          formatAmount(tx.runningBalance)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Footer: reflects the current view */}
        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/80 px-4 py-3 backdrop-blur-md print:border-t-2 print:border-slate-800 print:bg-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs font-bold text-slate-500">
            Showing{' '}
            <span className="font-black text-slate-800">{visibleTransactions.length}</span> of{' '}
            <span className="font-black text-slate-800">{transactions.length}</span> records
            {isFiltered && <span className="ml-1 text-sky-600">(filtered)</span>}
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-bold">
            <span className="text-slate-500">
              In:{' '}
              <span className="font-black tabular-nums text-emerald-600">
                {formatCurrency(filteredTotals.cashIn)}
              </span>
            </span>
            <span className="text-slate-500">
              Out:{' '}
              <span className="font-black tabular-nums text-rose-600">
                {formatCurrency(filteredTotals.cashOut)}
              </span>
            </span>
            <span className="text-slate-500">
              Net:{' '}
              <span className="font-black tabular-nums text-slate-800">
                {formatCurrency(filteredTotals.cashIn - filteredTotals.cashOut)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-sm print:hidden sm:p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl sm:rounded-3xl">
            <div
              className={`relative p-4 text-white sm:p-6 ${
                showAddModal === 'cash-in' ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              <button
                onClick={() => setShowAddModal(null)}
                className="absolute right-3 top-3 flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full bg-black/10 text-white/80 transition-colors hover:bg-black/20 hover:text-white sm:right-4 sm:top-4"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
              <div className="mb-2 flex items-center gap-3 pr-12">
                <div className="flex-shrink-0 rounded-xl bg-white/20 p-2">
                  {showAddModal === 'cash-in' ? (
                    <ArrowDownLeft size={22} />
                  ) : (
                    <ArrowUpRight size={22} />
                  )}
                </div>
                <h3 className="text-lg font-black tracking-tight sm:text-2xl">
                  {showAddModal === 'cash-in' ? 'Add Cash In' : 'Add Cash Out'}
                </h3>
              </div>
              <p className="text-xs font-medium text-white/80 sm:text-sm">
                Enter details for the new{' '}
                {showAddModal === 'cash-in' ? 'deposit' : 'withdrawal'} transaction.
              </p>
            </div>

            <form onSubmit={handleAddTransaction} className="p-4 sm:p-6">
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label
                    htmlFor="ledger-entity"
                    className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500"
                  >
                    Entity / Sarafi
                  </label>
                  <input
                    id="ledger-entity"
                    type="text"
                    required
                    list="ledger-entity-options"
                    value={newTx.entity}
                    onChange={(e) => setNewTx({ ...newTx, entity: e.target.value })}
                    className="min-h-[44px] w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none transition-all focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 sm:text-base"
                    placeholder="Enter or pick a name"
                  />
                  <datalist id="ledger-entity-options">
                    {Array.from(new Set(transactions.map((tx) => tx.associatedEntity))).map(
                      (name) => (
                        <option key={name} value={name} />
                      )
                    )}
                  </datalist>
                </div>

                <div>
                  <label
                    htmlFor="ledger-amount"
                    className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500"
                  >
                    Amount (USD)
                  </label>
                  <div className="relative">
                    <DollarSign
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      id="ledger-amount"
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={newTx.amount}
                      onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                      className="min-h-[44px] w-full rounded-xl border-2 border-slate-100 bg-slate-50 pl-10 pr-4 text-sm font-black text-slate-800 outline-none transition-all focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 sm:text-base"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3 sm:mt-8">
                <button
                  type="button"
                  onClick={() => setShowAddModal(null)}
                  className="min-h-[44px] flex-1 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 sm:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 sm:text-base ${
                    showAddModal === 'cash-in'
                      ? 'bg-emerald-600 shadow-emerald-600/25 hover:bg-emerald-500'
                      : 'bg-rose-600 shadow-rose-600/25 hover:bg-rose-500'
                  }`}
                >
                  <CheckCircle2 size={17} className="flex-shrink-0" />
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border px-4 py-3 text-sm font-black shadow-2xl backdrop-blur-xl print:hidden ${
            toast.type === 'success'
              ? 'border-emerald-100 bg-emerald-50/95 text-emerald-700'
              : 'border-rose-100 bg-rose-50/95 text-rose-700'
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { LedgerTransaction } from '../types/ledger';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, DollarSign, Printer, Plus, Minus, X, CheckCircle2 } from 'lucide-react';

interface CustomerLedgerTableProps {
  transactions: LedgerTransaction[];
}

export const CustomerLedgerTable: React.FC<CustomerLedgerTableProps> = ({ transactions: initialTransactions }) => {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>(initialTransactions);
  const [showAddModal, setShowAddModal] = useState<'cash-in' | 'cash-out' | null>(null);
  const [newTx, setNewTx] = useState({ entity: '', amount: '' });

  // Calculate summary totals
  const summary = useMemo(() => {
    return transactions.reduce(
      (acc, tx) => ({
        totalCashIn: acc.totalCashIn + tx.cashIn,
        totalCashOut: acc.totalCashOut + tx.cashOut,
        finalBalance: tx.runningBalance, // Takes the last row's running balance
      }),
      { totalCashIn: 0, totalCashOut: 0, finalBalance: 0 }
    );
  }, [transactions]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.entity || !newTx.amount) return;

    const amountNum = parseFloat(newTx.amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const lastBalance = transactions.length > 0 ? transactions[transactions.length - 1].runningBalance : 0;
    
    const newRecord: LedgerTransaction = {
      serialNumber: transactions.length + 1,
      associatedEntity: newTx.entity,
      cashIn: showAddModal === 'cash-in' ? amountNum : 0,
      cashOut: showAddModal === 'cash-out' ? amountNum : 0,
      runningBalance: showAddModal === 'cash-in' ? lastBalance + amountNum : lastBalance - amountNum
    };

    setTransactions([...transactions, newRecord]);
    setShowAddModal(null);
    setNewTx({ entity: '', amount: '' });
  };

  return (
    <div className="flex flex-col h-full w-full mx-auto p-2 md:p-4 lg:p-6 pb-20">
      
      {/* Header section */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-6 print:hidden">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight drop-shadow-sm">
            Customer & Sarafi Ledger
          </h2>
          <p className="text-slate-500 font-bold mt-2 text-sm uppercase tracking-widest">
            Historical transaction records and running balances
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handlePrint}
            className="group flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-sky-300 hover:bg-sky-50 transition-all shadow-sm hover:shadow-md text-slate-600 hover:text-sky-700 font-bold text-sm"
          >
            <Printer size={18} className="group-hover:scale-110 transition-transform" />
            Print Ledger
          </button>
          
          <button 
            onClick={() => setShowAddModal('cash-in')}
            className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all font-bold text-sm"
          >
            <div className="bg-white/20 p-1 rounded-md">
              <ArrowDownLeft size={16} strokeWidth={3} />
            </div>
            Add Cash In
          </button>
          
          <button 
            onClick={() => setShowAddModal('cash-out')}
            className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white rounded-xl shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 hover:-translate-y-0.5 transition-all font-bold text-sm"
          >
            <div className="bg-white/20 p-1 rounded-md">
              <ArrowUpRight size={16} strokeWidth={3} />
            </div>
            Add Cash Out
          </button>
        </div>
      </div>

      {/* Premium Glassmorphism Table Container - Light Mode Optimized */}
      <div className="relative flex flex-col flex-1 rounded-2xl md:rounded-[32px] overflow-hidden print:overflow-visible bg-white/70 backdrop-blur-2xl border border-white shadow-[0_12px_40px_rgba(15,32,60,0.06)] print:shadow-none print:border-none print:bg-white print:rounded-none">
        
        {/* Scrollable Table Area */}
        <div className="flex-1 overflow-auto app-scrollbar print:overflow-visible">
          <table className="w-full text-left border-collapse min-w-[800px] print:min-w-full">
            <thead className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur-md text-slate-100 text-[11px] uppercase tracking-[0.2em] font-extrabold shadow-sm print:bg-white print:text-slate-800 print:shadow-none print:border-b-2 print:border-slate-800">
              <tr>
                <th className="px-6 py-5 rounded-tl-[32px] print:rounded-none">S.NO</th>
                <th className="px-6 py-5">Associated Entity / Sarafi</th>
                <th className="px-6 py-5 text-right">Cash In</th>
                <th className="px-6 py-5 text-right">Cash Out</th>
                <th className="px-6 py-5 text-right rounded-tr-[32px] print:rounded-none">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 print:divide-slate-200">
              {transactions.map((tx) => (
                <tr 
                  key={tx.serialNumber} 
                  className="hover:bg-sky-50/50 transition-colors duration-200 group print:hover:bg-transparent"
                >
                  <td className="px-6 py-4 text-sm font-semibold text-slate-400 group-hover:text-sky-600 transition-colors print:text-slate-600">
                    {tx.serialNumber}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">
                    {tx.associatedEntity}
                  </td>
                  
                  {/* Cash In Column */}
                  <td className="px-6 py-4 text-right">
                    {tx.cashIn > 0 ? (
                      <div className="inline-flex items-center justify-end gap-2 text-emerald-600 bg-emerald-50/50 px-3 py-1.5 rounded-lg border border-emerald-100/50 print:border-none print:bg-transparent print:p-0">
                        <ArrowDownLeft size={16} strokeWidth={2.5} className="text-emerald-500 print:hidden" />
                        <span className="font-bold text-[15px]">{formatCurrency(tx.cashIn)}</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 font-bold px-3 py-1.5 inline-block print:text-slate-400">—</span>
                    )}
                  </td>
                  
                  {/* Cash Out Column */}
                  <td className="px-6 py-4 text-right">
                    {tx.cashOut > 0 ? (
                      <div className="inline-flex items-center justify-end gap-2 text-rose-600 bg-rose-50/50 px-3 py-1.5 rounded-lg border border-rose-100/50 print:border-none print:bg-transparent print:p-0">
                        <ArrowUpRight size={16} strokeWidth={2.5} className="text-rose-500 print:hidden" />
                        <span className="font-bold text-[15px]">{formatCurrency(tx.cashOut)}</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 font-bold px-3 py-1.5 inline-block print:text-slate-400">—</span>
                    )}
                  </td>
                  
                  {/* Running Balance Column */}
                  <td className="px-6 py-4 text-sm font-black text-right text-slate-800">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <DollarSign size={14} className="text-slate-400 print:hidden" />
                      <span className="text-[15px]">{formatCurrency(tx.runningBalance).replace('$', '')}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 p-6 sm:px-8 shrink-0 relative overflow-hidden print:bg-white print:border-t-2 print:border-slate-800 print:text-slate-900">
          {/* Subtle light effect inside footer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-2xl bg-gradient-to-t from-sky-500/0 to-sky-400/5 pointer-events-none print:hidden"></div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left relative z-10">
            
            {/* Total Cash In Summary */}
            <div className="flex flex-col items-center sm:items-start group">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5 print:text-slate-600">
                <TrendingUp size={14} className="text-emerald-400 print:hidden" /> Total Cash In
              </span>
              <span className="text-emerald-400 text-2xl font-black drop-shadow-[0_2px_8px_rgba(52,211,153,0.2)] print:text-slate-800 print:drop-shadow-none">
                {formatCurrency(summary.totalCashIn)}
              </span>
            </div>
            
            {/* Total Cash Out Summary */}
            <div className="flex flex-col items-center sm:items-start group">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5 print:text-slate-600">
                <TrendingDown size={14} className="text-rose-400 print:hidden" /> Total Cash Out
              </span>
              <span className="text-rose-400 text-2xl font-black drop-shadow-[0_2px_8px_rgba(251,113,133,0.2)] print:text-slate-800 print:drop-shadow-none">
                {formatCurrency(summary.totalCashOut)}
              </span>
            </div>
            
            {/* Final Balance Summary */}
            <div className="flex flex-col items-center sm:items-end group">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2 print:text-slate-600">
                Final Balance
              </span>
              <span className="text-white text-3xl font-black drop-shadow-[0_2px_12px_rgba(255,255,255,0.15)] print:text-slate-900 print:drop-shadow-none">
                {formatCurrency(summary.finalBalance)}
              </span>
            </div>
            
          </div>
        </div>
        
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            <div className={`p-6 ${showAddModal === 'cash-in' ? 'bg-emerald-500' : 'bg-rose-500'} text-white relative`}>
              <button 
                onClick={() => setShowAddModal(null)}
                className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/10 hover:bg-black/20 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 p-2 rounded-xl">
                  {showAddModal === 'cash-in' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                </div>
                <h3 className="text-2xl font-black tracking-tight">
                  {showAddModal === 'cash-in' ? 'Add Cash In' : 'Add Cash Out'}
                </h3>
              </div>
              <p className="text-white/80 font-medium text-sm">
                Enter details for the new {showAddModal === 'cash-in' ? 'deposit' : 'withdrawal'} transaction.
              </p>
            </div>
            
            <form onSubmit={handleAddTransaction} className="p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                    Associated Entity / Sarafi
                  </label>
                  <input
                    type="text"
                    required
                    value={newTx.entity}
                    onChange={(e) => setNewTx({ ...newTx, entity: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-slate-800 font-bold focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 transition-all outline-none"
                    placeholder="Enter name (e.g. John Doe LTD)"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                    Amount (USD)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <DollarSign size={18} className="text-slate-400" />
                    </div>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={newTx.amount}
                      onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-10 pr-4 py-3 text-slate-800 font-black text-lg focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 transition-all outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-white font-bold rounded-xl transition-all shadow-lg shadow-current/25 hover:shadow-current/40 hover:-translate-y-0.5 ${
                    showAddModal === 'cash-in' 
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-emerald-500' 
                      : 'bg-rose-500 hover:bg-rose-600 text-rose-500'
                  }`}
                >
                  <CheckCircle2 size={18} className="text-white" />
                  <span className="text-white">Confirm</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

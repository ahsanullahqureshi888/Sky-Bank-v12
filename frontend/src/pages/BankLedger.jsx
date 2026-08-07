import React, { useState, useEffect } from 'react';
import { Building, Plus, Printer, FileSpreadsheet, Loader2, Save, Trash2, Edit2, X, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { bankAPI } from '../api/client';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '../utils/formatters';
import GlassCard from '../components/GlassCard';
import StatCard from '../components/StatCard';


const COMPANY_NAME = 'Sky Ariana Limited';
const COMPANY_SUBTITLE = 'Money Transaction & Hawala Receipt Management System';
const COMPANY_LOGO = '/sky-bbb-logo.png';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const openPrintWindow = (html, title = 'Print') => {
  const printWindow = window.open('', '_blank', 'width=1120,height=820');
  if (!printWindow) {
    alert('Please allow popups to print this document.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = title;
};

const currencies = ['USD', 'Toman', 'Dirham', 'Afghani'];

const defaultAccountForm = {
  account_name: '',
  bank_name: '',
  account_number: '',
  currency: 'USD',
  opening_balance: '',
};

export default function BankLedger() {
  const { t } = useTranslation();
  const user = JSON.parse(localStorage.getItem('sky_banking_user') || '{}');
  const isAdmin = user.role === 'Admin';
  const isViewer = user.role === 'Viewer';

  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [ledgerRows, setLedgerRows] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [ledgerError, setLedgerError] = useState('');
  const [ledgerRetryKey, setLedgerRetryKey] = useState(0);

  // CRUD Bank Account Form States
  const [form, setForm] = useState(defaultAccountForm);
  const [editMode, setEditMode] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchAccounts = async (selectFirst = false, preferredId = selectedAccountId) => {
    setLoadingAccounts(true);
    setAccountError('');
    try {
      const res = await bankAPI.list();
      const nextAccounts = Array.isArray(res.data) ? res.data : [];
      setAccounts(nextAccounts);
      if (nextAccounts.length > 0) {
        const preferredAccount = nextAccounts.find((account) => String(account.id) === String(preferredId));
        setSelectedAccountId(String(selectFirst ? nextAccounts[0].id : (preferredAccount?.id || nextAccounts[0].id)));
      } else {
        setSelectedAccountId('');
        setLedgerRows([]);
      }
    } catch (err) {
      console.error('[v0] Failed to load bank accounts', err);
      setAccountError(err.response?.data?.detail || 'Bank accounts could not be loaded.');
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    fetchAccounts(true);
  }, []);

  useEffect(() => {
    if (!selectedAccountId) {
      setLedgerRows([]);
      setLedgerError('');
      return;
    }
    setLoadingLedger(true);
    setLedgerError('');
    bankAPI.getLedger(selectedAccountId)
      .then((res) => {
        setLedgerRows(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error('[v0] Failed to load bank ledger', err);
        setLedgerRows([]);
        setLedgerError(err.response?.data?.detail || 'This account ledger could not be loaded.');
      })
      .finally(() => {
        setLoadingLedger(false);
      });
  }, [selectedAccountId, ledgerRetryKey]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    const accountName = form.account_name.trim();
    const bankName = form.bank_name.trim();
    const accountNumber = form.account_number.trim();
    const openingBalance = Number(form.opening_balance || 0);

    if (!accountName || !bankName || !accountNumber) {
      setFormError('Account name, bank name, and account number are required.');
      return;
    }
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      setFormError('Opening balance must be a valid non-negative number.');
      return;
    }

    setSavingAccount(true);
    setFormError('');

    try {
      if (editMode) {
        const payload = {
          account_name: accountName,
          bank_name: bankName,
          account_number: accountNumber,
          currency: form.currency,
          opening_balance: openingBalance,
        };
        await bankAPI.update(selectedAccountId, payload);
        alert('Bank account details updated successfully.');
        setForm(defaultAccountForm);
        setEditMode(false);
        await fetchAccounts(false, selectedAccountId);
      } else {
        const payload = {
          account_name: accountName,
          bank_name: bankName,
          account_number: accountNumber,
          currency: form.currency,
          opening_balance: openingBalance,
        };
        const res = await bankAPI.create(payload);
        setForm(defaultAccountForm);
        alert('Bank account registered successfully.');
        setSelectedAccountId(String(res.data.id));
        await fetchAccounts(false, res.data.id);
      }
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Failed to save bank account details.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleEditClick = () => {
    const activeAcc = accounts.find(a => a.id === Number(selectedAccountId));
    if (!activeAcc) return;
    setForm({
      account_name: activeAcc.account_name || '',
      bank_name: activeAcc.bank_name || '',
      account_number: activeAcc.account_number || '',
      currency: activeAcc.currency || 'USD',
      opening_balance: activeAcc.opening_balance || '',
    });
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setForm(defaultAccountForm);
    setEditMode(false);
    setFormError('');
  };

  const handleDeleteAccount = async () => {
    const activeAcc = accounts.find(a => a.id === Number(selectedAccountId));
    if (!activeAcc) return;

    if (window.confirm(`Are you sure you want to permanently delete bank account "${activeAcc.account_name}"? This action cannot be undone.`)) {
      try {
        await bankAPI.delete(selectedAccountId);
        alert('Bank account deleted successfully.');
        const remaining = accounts.filter((account) => String(account.id) !== String(selectedAccountId));
        setAccounts(remaining);
        setSelectedAccountId(remaining.length > 0 ? String(remaining[0].id) : '');
        setLedgerRows([]);
        setEditMode(false);
        setForm(defaultAccountForm);
      } catch (err) {
        console.error(err);
        alert(err.response?.data?.detail || 'Failed to delete bank account. Verify it has no transaction history.');
      }
    }
  };


  const buildLedgerPrintHtml = () => {
    const printStyle = `
      <style>
        @page { size: A4 landscape; margin: 9mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; background: #fff; }
        body { font-family: Inter, Arial, sans-serif; color: #10233f; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .sheet { position: relative; overflow: hidden; border: 1px solid #cfe0f3; background: #fff; padding: 4mm; }
        .top-rule { position: absolute; inset: 0 0 auto; height: 2mm; background: linear-gradient(90deg, #0f2a4a, #2563eb 72%, #c79a45); }
        .brand { display: flex; justify-content: space-between; align-items: center; gap: 8mm; padding: 1.5mm 0 2mm; border-bottom: 1px solid #c79a45; }
        .brand-left { display: flex; min-width: 0; align-items: center; }
        .logo { display: inline-flex; width: 22mm; height: 15mm; flex: 0 0 auto; align-items: center; justify-content: center; margin-right: 4mm; overflow: hidden; border: 1px solid #d9e8f7; border-radius: 3mm; background: #fff; }
        .logo img { width: 100%; height: 100%; object-fit: contain; padding: 1mm; }
        h1 { margin: 0; color: #0f2a4a; font-size: 18pt; font-weight: 900; line-height: 1.05; }
        .subtitle { margin-top: 1.2mm; color: #2563eb; font-size: 8.2pt; font-weight: 800; text-transform: uppercase; }
        .report-meta { min-width: 55mm; overflow: hidden; border: 1px solid #cfe0f3; border-radius: 3mm; background: #f8fbff; }
        .report-meta div { display: flex; justify-content: space-between; gap: 5mm; padding: 1.5mm 2.5mm; border-bottom: 1px solid #e4edf7; font-size: 7.6pt; }
        .report-meta div:last-child { border-bottom: 0; }
        .report-meta span { color: #64748b; font-weight: 700; }
        .report-meta strong { color: #0f2a4a; font-weight: 900; }
        .report-title { display: flex; justify-content: space-between; align-items: flex-end; gap: 6mm; padding: 2mm 0 1.5mm; }
        .report-title h2 { margin: 0; color: #0f2a4a; font-size: 14pt; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; }
        .report-title p { margin: 0.7mm 0 0; color: #64748b; font-size: 7.5pt; }
        .report-scope { max-width: 120mm; color: #2563eb; font-size: 7.5pt; font-weight: 800; text-align: right; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm; margin-bottom: 2mm; }
        .summary-card { min-height: 14mm; padding: 1.8mm 3mm; border: 1px solid #dbeafe; border-radius: 2.5mm; background: #f7fbff; }
        .summary-card.debit-card { border-color: #ffd0d8; background: #fff7f8; }
        .summary-card.credit-card { border-color: #b7e9d2; background: #f0fdf7; }
        .summary-card.balance-card { border-color: #bfdbfe; background: #eff6ff; }
        .summary-card .label { display: block; margin-bottom: 1.2mm; color: #64748b; font-size: 6.6pt; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
        .summary-card .value { color: #10233f; font-size: 10pt; font-weight: 900; line-height: 1.25; }
        .debit-card .value { color: #be123c; }
        .credit-card .value { color: #047857; }
        .balance-card .value { color: #0f2a4a; }
        .table-shell { overflow: hidden; border: 1px solid #cfe0f3; border-radius: 2.5mm; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        thead { display: table-header-group; }
        th { padding: 1.8mm 1.8mm; background: #0f2a4a; color: #fff; font-size: 6.4pt; font-weight: 900; letter-spacing: 0.07em; text-align: left; text-transform: uppercase; }
        td { padding: 1.7mm 1.8mm; border-bottom: 1px solid #e2eaf4; color: #334155; font-size: 7.1pt; line-height: 1.2; vertical-align: top; overflow-wrap: anywhere; }
        tbody tr:nth-child(even) { background: #f8fbff; }
        tbody tr:last-child td { border-bottom: 0; }
        tbody tr { break-inside: avoid; page-break-inside: avoid; }
        .amount { text-align: right; white-space: nowrap; font-weight: 900; overflow-wrap: normal; overflow: hidden; text-overflow: clip; }
        .debit { color: #be123c; }
        .credit { color: #047857; }
        .empty-state { padding: 10mm !important; color: #64748b; text-align: center; }
        .authorization { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; margin-top: 4mm; }
        .signature { padding-top: 6mm; border-top: 1px solid #71849b; color: #475569; font-size: 7pt; font-weight: 800; }
        .signature small { display: block; margin-top: 1mm; color: #94a3b8; font-size: 5.8pt; font-weight: 600; }
        .document-footer { display: flex; justify-content: space-between; gap: 5mm; margin-top: 2.5mm; padding-top: 1.5mm; border-top: 1px solid #dbeafe; color: #64748b; font-size: 6pt; }
      </style>
    `;

    const rows = ledgerRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.date || '-')}</td>
        <td>${escapeHtml(row.description || '-')}</td>
        <td class="amount debit">${row.debit ? escapeHtml(formatCurrency(row.debit, currentCurrency)) : '-'}</td>
        <td class="amount credit">${row.credit ? escapeHtml(formatCurrency(row.credit, currentCurrency)) : '-'}</td>
        <td class="amount">${escapeHtml(formatCurrency(row.balance, currentCurrency))}</td>
      </tr>
    `).join('');

    return `<!doctype html>
      <html>
        <head>
          <title>${escapeHtml(selectedAcc?.account_name || 'Bank')} Statement</title>
          ${printStyle}
        </head>
        <body>
          <div class="sheet">
            <div class="top-rule"></div>
            <div class="brand">
              <div class="brand-left">
                <div class="logo"><img src="${COMPANY_LOGO}" alt="${COMPANY_NAME}" /></div>
                <div>
                  <h1>${COMPANY_NAME}</h1>
                  <div class="subtitle">${COMPANY_SUBTITLE}</div>
                </div>
              </div>
              <div class="report-meta">
                <div><span>Document</span><strong>Bank Account Statement</strong></div>
                <div><span>Generated</span><strong>${escapeHtml(new Date().toLocaleDateString())}</strong></div>
                <div><span>Account</span><strong>${escapeHtml(selectedAcc?.account_name || '-')}</strong></div>
              </div>
            </div>
            <div class="report-title">
              <div>
                <h2>Bank Ledger &amp; Vaults Statement</h2>
                <p>Official bank account ledger and balance statement</p>
              </div>
              <div class="report-scope">${escapeHtml(selectedAcc ? `${selectedAcc.account_name} — ${selectedAcc.bank_name} (${selectedAcc.account_number})` : '')}</div>
            </div>
            <div class="summary">
              <div class="summary-card"><span class="label">Currency</span><span class="value">${escapeHtml(currentCurrency)}</span></div>
              <div class="summary-card debit-card"><span class="label">Total Debit (Out)</span><span class="value">${escapeHtml(formatCurrency(totalDebit, currentCurrency))}</span></div>
              <div class="summary-card credit-card"><span class="label">Total Credit (In)</span><span class="value">${escapeHtml(formatCurrency(totalCredit, currentCurrency))}</span></div>
              <div class="summary-card balance-card"><span class="label">Current Balance</span><span class="value">${escapeHtml(formatCurrency(finalBalance, currentCurrency))}</span></div>
            </div>
            <div class="table-shell">
              <table>
                <colgroup>
                  <col style="width:15%"><col style="width:40%"><col style="width:15%"><col style="width:15%"><col style="width:15%">
                </colgroup>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th style="text-align:right">Debit (Out)</th>
                    <th style="text-align:right">Credit (In)</th>
                    <th style="text-align:right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="5" class="empty-state">No statement entries recorded for this account.</td></tr>'}
                </tbody>
              </table>
            </div>
            <div class="authorization">
              <div class="signature">Prepared By<small>Name, date, and signature</small></div>
              <div class="signature">Reviewed By<small>Accounts verification</small></div>
              <div class="signature">Authorized Signature / Stamp<small>Official approval</small></div>
            </div>
            <div class="document-footer">
              <span>Official bank statement generated by ${COMPANY_NAME}.</span>
              <span>${COMPANY_SUBTITLE}</span>
              <span>Page 1</span>
            </div>
          </div>
          <script>window.onload = () => { window.focus(); window.print(); };</script>
        </body>
      </html>`;
  };

  const handlePrint = () => {
    if (!selectedAcc) return;
    const html = buildLedgerPrintHtml();
    openPrintWindow(html, `${selectedAcc.account_name || 'Bank'} Statement`);
  };


  const handleExportCSV = () => {
    const selectedAcc = accounts.find((a) => a.id === Number(selectedAccountId));
    const filename = `${selectedAcc?.account_name || 'bank'}-ledger.csv`;

    let csvContent = 'Date,Description,Debit,Credit,Balance\n';
    ledgerRows.forEach((row) => {
      csvContent += `"${row.date}","${row.description.replace(/'/g, "''")}",${row.debit || 0},${row.credit || 0},${row.balance}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedAcc = accounts.find((a) => a.id === Number(selectedAccountId));
  const currentCurrency = selectedAcc?.currency || 'USD';

  // Summarize details
  const totalDebit = ledgerRows.reduce((sum, r) => sum + (r.debit || 0), 0);
  const totalCredit = ledgerRows.reduce((sum, r) => sum + (r.credit || 0), 0);
  const finalBalance = ledgerRows.length > 0 ? ledgerRows.at(-1)?.balance || 0 : 0;

  return (
    <div className="bank-ledger-page space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-sky-600 shadow-sm">
            <Wallet size={12} />
            Treasury control
          </div>
          <h1 className="text-2xl font-black tracking-tight text-sky-950 leading-tight font-sans">{t('bankLedger.title')}</h1>
          <p className="text-sm text-sky-600/80 font-medium mt-1">{t('bankLedger.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            disabled={ledgerRows.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/60 hover:bg-sky-50 border border-sky-100 font-bold text-xs text-sky-800 rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            <Printer size={14} />
            <span>{t('bankLedger.print')}</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={ledgerRows.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-tr from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/15 transition-all text-xs disabled:opacity-50"
          >
            <FileSpreadsheet size={14} />
            <span>{t('bankLedger.export')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 print:block">
        
        {/* Ledger statement list */}
        <div className={isViewer ? "xl:col-span-3 space-y-6" : "xl:col-span-2 space-y-6"}>
          <GlassCard className="p-4 sm:p-6 print:border-none print:bg-white print:shadow-none">
            {/* Print-only clean statement header (fallback if printed without the dedicated Print Statement button) */}
            <div className="hidden print:block mb-4">
              <div className="flex items-center justify-between border-b-2 border-sky-900 pb-3 mb-3">
                <div>
                  <h1 className="text-lg font-black text-sky-900">{COMPANY_NAME}</h1>
                  <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wide">Bank Ledger &amp; Vaults Statement</p>
                </div>
                <div className="text-right text-[10px] font-semibold text-slate-600">
                  <p>Account: <span className="font-black text-sky-900">{selectedAcc?.account_name || '-'}</span></p>
                  <p>{selectedAcc?.bank_name} ({selectedAcc?.account_number})</p>
                  <p>Generated: {new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-sky-100/80 pb-4 gap-3 mb-5 print:hidden">
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-sky-950">{t('bankLedger.select_ledger')}</h2>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Choose a vault to review its running balance</p>
              </div>
              {loadingAccounts ? (
                <Loader2 className="animate-spin text-sky-500" size={18} />
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    className="px-4 py-2 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-sky-900"
                    value={selectedAccountId}
                    onChange={(e) => {
                      setSelectedAccountId(e.target.value);
                      setEditMode(false);
                      setForm(defaultAccountForm);
                    }}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_name} ({a.bank_name} - {a.account_number})
                      </option>
                    ))}
                  </select>

                  {/* CRUD action buttons */}
                  {!isViewer && selectedAcc && (
                    <div className="flex gap-1.5 ml-2">
                      <button
                        onClick={handleEditClick}
                        className="min-h-11 min-w-11 p-2 border border-sky-100 bg-white hover:bg-sky-50 text-sky-800 rounded-xl transition-all"
                        title="Edit Account Details"
                        aria-label="Edit account details"
                      >
                        <Edit2 size={13} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={handleDeleteAccount}
                          className="min-h-11 min-w-11 p-2 border border-rose-100 bg-rose-550/5 hover:bg-rose-100 text-rose-700 rounded-xl transition-all"
                          title="Delete Bank Account"
                          aria-label="Delete bank account"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedAcc && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100/80 bg-gradient-to-r from-sky-50/80 to-white/70 px-4 py-3 print:hidden">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Building size={16} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-sky-950">{selectedAcc.account_name}</p>
                    <p className="truncate text-[10px] font-semibold text-slate-500">{selectedAcc.bank_name} · {selectedAcc.account_number}</p>
                  </div>
                </div>
                <span className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-sky-700">{currentCurrency}</span>
              </div>
            )}

            {accountError && (
              <div className="mb-4 flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs font-semibold text-rose-700 sm:flex-row sm:items-center sm:justify-between print:hidden" role="alert">
                <span>{accountError}</span>
                <button type="button" onClick={() => fetchAccounts(false)} className="w-fit rounded-lg bg-rose-100 px-3 py-2 font-black text-rose-800 hover:bg-rose-200">
                  Retry
                </button>
              </div>
            )}

            {selectedAcc ? (
              <div className="space-y-6">
                
                {/* Metric Summary Rows */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_8px_24px_rgba(15,42,74,0.06)] transition-transform hover:-translate-y-0.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      <TrendingDown size={14} className="text-rose-500" />
                      {t('bankLedger.total_debit')}
                    </span>
                    <strong className="text-base sm:text-lg font-black text-rose-600 block">
                      {formatCurrency(totalDebit, currentCurrency)}
                    </strong>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_8px_24px_rgba(15,42,74,0.06)] transition-transform hover:-translate-y-0.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      <TrendingUp size={14} className="text-emerald-500" />
                      {t('bankLedger.total_credit')}
                    </span>
                    <strong className="text-base sm:text-lg font-black text-emerald-600 block">
                      {formatCurrency(totalCredit, currentCurrency)}
                    </strong>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_8px_24px_rgba(15,42,74,0.06)] transition-transform hover:-translate-y-0.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      <Wallet size={14} className="text-sky-500" />
                      {t('bankLedger.current_balance')}
                    </span>
                    <strong className="text-base sm:text-lg font-black text-sky-900 block">
                      {formatCurrency(finalBalance, currentCurrency)}
                    </strong>
                  </div>
                </div>

                {/* Account Transactions Ledger */}
                {loadingLedger ? (
                  <div className="py-16 flex flex-col items-center justify-center">
                    <Loader2 className="animate-spin text-sky-500 mb-3" size={24} />
                    <p className="text-xs font-semibold text-sky-600">{t('bankLedger.loading')}</p>
                  </div>
                ) : ledgerError ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-100 bg-rose-50/60 px-4 py-12 text-center" role="alert">
                    <p className="text-xs font-semibold text-rose-700">{ledgerError}</p>
                    <button type="button" onClick={() => setLedgerRetryKey((value) => value + 1)} className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-black text-rose-800 hover:bg-rose-200">
                      Retry ledger
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full min-w-[620px] text-left border-collapse print:min-w-0 print:text-[9px]">
                      <thead className="bg-sky-50/60">
                        <tr className="border-b border-sky-100/70 text-[10px] font-black text-sky-600 uppercase tracking-[0.1em]">
                          <th className="pb-3 pr-2">{t('bankLedger.date')}</th>
                          <th className="pb-3 px-2">{t('bankLedger.description')}</th>
                          <th className="pb-3 px-2 text-right">{t('bankLedger.debit_out')}</th>
                          <th className="pb-3 px-2 text-right">{t('bankLedger.credit_in')}</th>
                          <th className="pb-3 pl-2 text-right">{t('bankLedger.balance')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sky-100/30 text-xs font-semibold text-sky-900/90">
                        {ledgerRows.map((row) => (
                          <tr key={row.id} className="border-b border-sky-100/40 transition-colors odd:bg-white/35 even:bg-sky-50/25 hover:bg-sky-100/35">
                            <td className="py-4 pr-2 text-[11px] font-bold text-sky-500/80">{row.date}</td>
                            <td className="py-4 px-2 text-[11px]">{row.description}</td>
                            <td className="py-3.5 px-2 text-right font-black text-rose-600">
                              {row.debit ? formatCurrency(row.debit, currentCurrency) : '-'}
                            </td>
                            <td className="py-3.5 px-2 text-right font-black text-emerald-600">
                              {row.credit ? formatCurrency(row.credit, currentCurrency) : '-'}
                            </td>
                            <td className="py-3.5 pl-2 text-right font-black text-sky-900">
                              {formatCurrency(row.balance, currentCurrency)}
                            </td>
                          </tr>
                        ))}
                        {ledgerRows.length === 0 && (
                          <tr>
                            <td colSpan="5" className="py-12 text-center text-sky-400 font-semibold">
                              No statement entries recorded for this account.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            ) : (
              <div className="py-20 text-center text-sky-400 font-semibold">
                No bank accounts registered. Fill in the form on the right to start.
              </div>
            )}
          </GlassCard>
        </div>

        {/* Add/Edit Bank Account form (Visible to Admins/Accountants) */}
        {!isViewer && (
          <div className="xl:col-span-1 print:hidden">
            <GlassCard className="relative overflow-hidden p-5 sm:p-6">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-emerald-400" />
              <div className="flex items-start justify-between border-b border-sky-100 pb-4 mb-5">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-1.5 text-base font-extrabold text-sky-900">
                    {editMode ? <Edit2 size={16} className="text-sky-500" /> : <Building size={18} className="text-sky-500" />}
                    <span>{editMode ? 'Edit Account' : 'Add Bank Account'}</span>
                  </h2>
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">{editMode ? 'Update vault details without changing its audit currency.' : 'Register a controlled bank or cash vault.'}</p>
                </div>
                {editMode && (
                  <button onClick={handleCancelEdit} className="ml-3 text-sky-400 transition-colors hover:text-sky-600">
                    <X size={16} />
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveAccount} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    name="account_name"
                    className="min-h-11 w-full rounded-xl border border-sky-100 bg-white/60 px-3 py-2 text-xs font-semibold text-sky-900 shadow-inner shadow-sky-950/[0.02] transition focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
                    placeholder="Dubai Hawala Desk, Main vault"
                    value={form.account_name}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    name="bank_name"
                    className="min-h-11 w-full rounded-xl border border-sky-100 bg-white/60 px-3 py-2 text-xs font-semibold text-sky-900 shadow-inner shadow-sky-950/[0.02] transition focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
                    placeholder="AIB Bank, Hawala Desk"
                    value={form.bank_name}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    name="account_number"
                    className="min-h-11 w-full rounded-xl border border-sky-100 bg-white/60 px-3 py-2 text-xs font-semibold text-sky-900 shadow-inner shadow-sky-950/[0.02] transition focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
                    placeholder="DXB-HWL-443"
                    value={form.account_number}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                    Currency
                  </label>
                  <select
                    name="currency"
                    className="min-h-11 w-full rounded-xl border border-sky-100 bg-white/60 px-3 py-2 text-xs font-semibold text-sky-900 shadow-inner shadow-sky-950/[0.02] transition focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
                    value={form.currency}
                    onChange={handleFormChange}
                    disabled={editMode} // Disable currency change on edit to preserve balance audit integrity
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {!editMode && (
                  <div>
                    <label className="block text-[10px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                      Opening Balance
                    </label>
                    <input
                      type="number"
                      name="opening_balance"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className="w-full min-h-11 px-3 py-2 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-sky-900"
                      placeholder="0.00"
                      value={form.opening_balance}
                      onChange={handleFormChange}
                    />
                  </div>
                )}

                {formError && (
                  <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-[11px] font-semibold text-red-600">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingAccount}
                  className="w-full py-3 bg-gradient-to-tr from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-bold rounded-xl shadow-lg shadow-sky-500/10 transition-all text-xs flex items-center justify-center gap-1.5"
                >
                  {savingAccount ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                  <span>{editMode ? 'Update Bank Account' : 'Save Bank Account'}</span>
                </button>
              </form>
            </GlassCard>
          </div>
        )}

      </div>
    </div>
  );
}

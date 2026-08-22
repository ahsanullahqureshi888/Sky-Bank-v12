import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  Filter,
  Loader2,
  Paperclip,
  Plus,
  Printer,
  Receipt,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Copy,
  Check,
  Maximize2,
  X,
  Sparkles,
} from 'lucide-react';
import { bankAPI, settingsAPI, transactionAPI } from '../api/client';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '../utils/formatters';
import GlassCard from '../components/GlassCard';
import ReceiptDocument from '../components/ReceiptDocument';
import { downloadReceiptPdf, printReceipt, formatHawalaSummary } from '../utils/receiptExport';

const COMPANY_NAME = 'Sky Ariana Limited';
const COMPANY_SUBTITLE = 'Money Transaction & Hawala Receipt Management System';
const COMPANY_LOGO = '/sky-bbb-logo.png';
const currencies = ['USD', 'Toman', 'Dirham', 'Afghani'];
const methods = ['Bank Transfer', 'Cash', 'Hawala'];
const statuses = ['Completed', 'Pending', 'Cancelled'];

const defaultFilters = {
  search: '',
  customer: '',
  currency: '',
  bank_account_id: '',
  payment_method: '',
  status: '',
  date_from: '',
  date_to: '',
  amount_min: '',
  amount_max: '',
};

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const safeFilename = (value) =>
  String(value || 'transaction-archive')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const getApiErrorMessage = (error, fallback) =>
  error?.response?.data?.detail || error?.response?.data?.message || error?.message || fallback;

export default function TransactionHistory() {
  const { t, i18n } = useTranslation();
  const user = JSON.parse(localStorage.getItem('sky_banking_user') || '{}');
  const isAdmin = user.role === 'Admin';
  const isViewer = user.role === 'Viewer';

  const [transactions, setTransactions] = useState([]);
  const [banks, setBanks] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState(null);
  const [generatingPdfId, setGeneratingPdfId] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewTx, setPreviewTx] = useState(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const fileInputRef = useRef(null);
  const [activeUploadId, setActiveUploadId] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const navigate = useNavigate();

  const handleCopySummary = async (tx) => {
    if (!tx) return;
    try {
      const bankAccount = banks.find((bank) => bank.id === Number(tx.bank_account_id));
      const text = formatHawalaSummary({
        transaction: tx,
        bankAccount,
        settings,
      });
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2200);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const showToast = (type, message) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3500);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v));
      const res = await transactionAPI.list(params);
      setTransactions(res.data);
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      if (e.detail) {
        setSettings((prev) => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('sky_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('sky_settings_updated', handleSettingsUpdated);
  }, []);

  useEffect(() => {
    Promise.all([bankAPI.list(), settingsAPI.get()])
      .then(([bankResponse, settingsResponse]) => {
        setBanks(Array.isArray(bankResponse.data) ? bankResponse.data : []);
        setSettings(settingsResponse.data || null);
      })
      .catch((err) => console.error('Failed to load receipt prerequisites', err));
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  const archiveTotals = useMemo(() => {
    return transactions.reduce(
      (acc, tx) => {
        const value = Number(tx.amount || 0);
        if (tx.type === 'Received') acc.received += value;
        else acc.paid += value;
        acc.count += 1;
        return acc;
      },
      { received: 0, paid: 0, count: 0 }
    );
  }, [transactions]);

  const bankNameById = useMemo(() => {
    const map = new Map();
    banks.forEach((bank) => map.set(bank.id, `${bank.account_name} (${bank.bank_name})`));
    return map;
  }, [banks]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => setFilters(defaultFilters);

  const handleDelete = (transaction) => {
    if (!transaction?.id || deletingTransactionId) return;
    setPendingDelete(transaction);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete?.id || deletingTransactionId) return;

    setDeletingTransactionId(pendingDelete.id);
    try {
      await transactionAPI.delete(pendingDelete.id);
      await fetchTransactions();
      showToast('success', 'Transaction deleted permanently.');
      setPendingDelete(null);
    } catch (err) {
      console.error(err);
      showToast('error', getApiErrorMessage(err, 'Failed to delete transaction. Ensure you have Admin permissions.'));
    } finally {
      setDeletingTransactionId(null);
    }
  };

  const handleConfirmDeleteAll = async () => {
    if (isDeletingAll) return;
    setIsDeletingAll(true);
    try {
      await transactionAPI.deleteAll();
      await fetchTransactions();
      showToast('success', 'All transactions have been deleted and ledgers reset.');
      setConfirmDeleteAll(false);
    } catch (err) {
      console.error(err);
      showToast('error', getApiErrorMessage(err, 'Failed to delete all transactions. Ensure you have Admin permissions.'));
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleUploadClick = (txId) => {
    setActiveUploadId(txId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadId) return;

    setUploadingAttachment(true);
    try {
      await transactionAPI.uploadReceipt(activeUploadId, file);
      showToast('success', 'Attachment uploaded successfully.');
      fetchTransactions();
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to upload attachment file.');
    } finally {
      setUploadingAttachment(false);
      setActiveUploadId(null);
      e.target.value = '';
    }
  };

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

  const buildArchivePrintHtml = () => {
    const totalUSDReceived = transactions.filter(t => t.currency === 'USD' && t.type === 'Received').reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalUSDPaid = transactions.filter(t => t.currency === 'USD' && (t.type === 'Paid' || t.type === 'Export')).reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalAFNReceived = transactions.filter(t => t.currency === 'Afghani' && t.type === 'Received').reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalAFNPaid = transactions.filter(t => t.currency === 'Afghani' && (t.type === 'Paid' || t.type === 'Export')).reduce((s, t) => s + Number(t.amount || 0), 0);

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>${COMPANY_NAME} - Official Transaction Archive Statement</title>
          <style>
            @page { size: A4 landscape; margin: 6mm 8mm; }
            * { box-sizing: border-box; }
            body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            
            .header-banner { position: relative; border-bottom: 2px solid #0f2a4a; padding-bottom: 10px; margin-bottom: 12px; }
            .gold-bar { height: 3px; background: linear-gradient(90deg, #0f2a4a 0%, #1e40af 50%, #c79a45 100%); margin-bottom: 10px; border-radius: 2px; }
            .brand-row { display: flex; justify-content: space-between; align-items: flex-start; }
            .brand-title { font-size: 20px; font-weight: 900; color: #0f2a4a; tracking-tight: -0.02em; }
            .brand-sub { font-size: 10px; color: #2563eb; font-weight: 800; text-transform: uppercase; margin-top: 2px; }
            .brand-meta { font-size: 9px; color: #64748b; font-weight: 700; text-align: right; }
            .brand-meta strong { color: #0f2a4a; font-size: 11px; }

            .summary-ribbon { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; background: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .summary-box { text-align: center; }
            .summary-box .lbl { font-size: 8px; font-weight: 800; text-transform: uppercase; color: #64748b; }
            .summary-box .val { font-size: 12px; font-weight: 900; color: #0f2a4a; margin-top: 1px; }

            table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 16px; }
            th { background: #0f2a4a; color: #ffffff; text-align: left; padding: 7px 8px; font-weight: 800; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.05em; }
            th.text-right { text-align: right; }
            tr:nth-child(even) { background: #f8fafc; }
            td { padding: 6.5px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 600; vertical-align: middle; }
            
            .receipt-code { font-family: 'Courier New', monospace; font-weight: 800; color: #0369a1; background: #f0f9ff; padding: 2px 5px; border-radius: 4px; border: 1px solid #bae6fd; font-size: 9.5px; }
            .badge-in { color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 2px 6px; border-radius: 4px; font-weight: 900; }
            .badge-out { color: #be123c; background: #fff1f2; border: 1px solid #fecdd3; padding: 2px 6px; border-radius: 4px; font-weight: 900; }
            .status-pill { background: #f1f5f9; color: #334155; padding: 2px 6px; border-radius: 99px; font-size: 8px; font-weight: 800; text-transform: uppercase; }

            .footer-signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 20px; page-break-inside: avoid; }
            .sig-card { border: 1px border #cbd5e1; border-radius: 6px; padding: 8px; text-align: center; background: #fff; min-height: 55px; display: flex; flex-direction: column; justify-content: space-between; }
            .sig-line { border-bottom: 1px dashed #94a3b8; margin-top: 22px; margin-bottom: 4px; }
            .sig-title { font-size: 9px; font-weight: 800; color: #0f2a4a; text-transform: uppercase; }
            .stamp-box { border: 1.5px dashed #3b82f6; border-radius: 6px; background: #eff6ff; color: #1d4ed8; font-size: 8px; font-weight: 900; padding: 10px; text-align: center; }

            .print-footer { border-top: 1px solid #e2e8f0; padding-top: 6px; display: flex; justify-content: space-between; font-size: 8px; color: #64748b; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="gold-bar"></div>
          <div class="header-banner">
            <div class="brand-row">
              <div>
                <div class="brand-title">${COMPANY_NAME}</div>
                <div class="brand-sub">${COMPANY_SUBTITLE}</div>
              </div>
              <div class="brand-meta">
                <div>Statement Date: <strong>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}</strong></div>
                <div>Total Records: <strong>${transactions.length} Archived</strong></div>
              </div>
            </div>
          </div>

          <div class="summary-ribbon">
            <div class="summary-box">
              <div class="lbl">USD Inflow (+)</div>
              <div class="val" style="color:#047857">+$${totalUSDReceived.toLocaleString()}</div>
            </div>
            <div class="summary-box">
              <div class="lbl">USD Outflow (-)</div>
              <div class="val" style="color:#be123c">-$${totalUSDPaid.toLocaleString()}</div>
            </div>
            <div class="summary-box">
              <div class="lbl">AFN Inflow (+)</div>
              <div class="val" style="color:#047857">+؋${totalAFNReceived.toLocaleString()}</div>
            </div>
            <div class="summary-box">
              <div class="lbl">AFN Outflow (-)</div>
              <div class="val" style="color:#be123c">-؋${totalAFNPaid.toLocaleString()}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Receipt No</th>
                <th>Date</th>
                <th>Customer & Company</th>
                <th>Purpose / Subject</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Equivalent</th>
                <th>Method</th>
                <th>Receiver</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map(tx => `
                <tr>
                  <td><span class="receipt-code">${escapeHtml(tx.receipt_no)}</span></td>
                  <td>${formatDate(tx.date)}</td>
                  <td>
                    <strong>${escapeHtml(tx.customer_name)}</strong>
                    ${tx.company_name ? `<br/><span style="font-size:8.5px;color:#64748b;">${escapeHtml(tx.company_name)}</span>` : ''}
                  </td>
                  <td>${escapeHtml(tx.subject || '-')}</td>
                  <td class="text-right">
                    <span class="${tx.type === 'Received' ? 'badge-in' : 'badge-out'}">
                      ${tx.type === 'Received' ? '+' : '-'}${formatCurrency(tx.amount, tx.currency)}
                    </span>
                  </td>
                  <td class="text-right">
                    ${tx.equivalent_amount ? `<strong>${formatCurrency(tx.equivalent_amount, tx.equivalent_currency)}</strong>` : '<span style="color:#cbd5e1">-</span>'}
                  </td>
                  <td>${escapeHtml(tx.payment_method)}</td>
                  <td>${escapeHtml(tx.receiver_name || '-')}</td>
                  <td><span class="status-pill">${escapeHtml(tx.status)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer-signatures">
            <div class="sig-card">
              <div class="sig-line"></div>
              <div class="sig-title">Prepared By (Auditor)</div>
            </div>
            <div class="sig-card">
              <div class="sig-line"></div>
              <div class="sig-title">Finance Officer Signature</div>
            </div>
            <div class="stamp-box">
              OFFICIAL COMPANY STAMP & SEAL<br/>
              <span style="font-size:7px;opacity:0.8;">Sky Ariana & Balam Bar Baran</span>
            </div>
          </div>

          <div class="print-footer" style="margin-top: 10px;">
            <span>Official ledger archive record generated by ${COMPANY_NAME}.</span>
            <span>Printed: ${new Date().toLocaleString()} | Page 1 of 1</span>
          </div>
          <script>window.onload = () => { window.focus(); window.print(); };</script>
        </body>
      </html>
    `;
  };

  const handlePrintArchive = () => {
    openPrintWindow(buildArchivePrintHtml(), t('transactionHistory.title'));
  };

  const handleExportCSV = () => {
    const header = [
      'Company',
      'Receipt No',
      'Date',
      'Customer',
      'Subject',
      'Type',
      'Amount',
      'Currency',
      'Equivalent Amount',
      'Equivalent Currency',
      'Payment Method',
      'Bank Account',
      'Receiver',
      'Status',
      'Description',
    ];
    const rows = transactions.map((tx) => [
      COMPANY_NAME,
      tx.receipt_no,
      tx.date,
      tx.customer_name,
      tx.subject,
      tx.type,
      tx.amount,
      tx.currency,
      tx.equivalent_amount,
      tx.equivalent_currency,
      tx.payment_method,
      bankNameById.get(tx.bank_account_id) || '',
      tx.receiver_name,
      tx.status,
      tx.description,
    ]);
    const csvContent = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFilename('transaction-archive')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrintReceipt = (tx) => {
    const bankAccount = banks.find((bank) => bank.id === Number(tx.bank_account_id));
    printReceipt({ transaction: tx, bankAccount, settings, language: i18n.resolvedLanguage });
  };

  const handleDownloadPDF = async (tx) => {
    if (generatingPdfId !== null) return;
    setGeneratingPdfId(tx.id);
    try {
      const bankAccount = banks.find((bank) => bank.id === Number(tx.bank_account_id));
      await downloadReceiptPdf({ transaction: tx, bankAccount, settings, language: i18n.resolvedLanguage });
    } catch (err) {
      console.error(err);
      showToast('error', err.message || 'Failed to download receipt PDF.');
    } finally {
      setGeneratingPdfId(null);
    }
  };

  return (
    <div id="transaction-history-page" className="transaction-history-page space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between print:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('transactionHistory.title')}</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-sky-100/80 text-sky-800 text-xs font-black">
              {transactions.length} Records
            </span>
          </div>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Official Hawala receipts, bank statements, and money transaction archive log.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {!isViewer && (
            <button
              onClick={() => navigate('/add-transaction')}
              className="h-11 inline-flex items-center gap-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs shadow-md shadow-sky-600/20 transition-all hover:scale-[1.02]"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>New Entry</span>
            </button>
          )}

          <button
            onClick={() => setShowFilters((val) => !val)}
            className={`h-11 inline-flex items-center gap-2 px-4 rounded-xl border font-bold text-xs transition-all ${
              showFilters
                ? 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/20'
                : 'bg-white/80 hover:bg-sky-50 text-slate-700 border-slate-200/80 shadow-xs'
            }`}
          >
            <SlidersHorizontal size={15} />
            <span>{t('transactionHistory.filters')}</span>
          </button>

          <button
            onClick={handlePrintArchive}
            className="h-11 inline-flex items-center gap-2 px-4 bg-white/80 hover:bg-sky-50 border border-slate-200/80 font-bold text-xs text-slate-700 rounded-xl shadow-xs transition-all"
          >
            <Printer size={15} />
            <span>{t('transactionHistory.print_archive')}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="h-11 inline-flex items-center gap-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02]"
          >
            <FileSpreadsheet size={15} />
            <span>{t('transactionHistory.export_csv')}</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setConfirmDeleteAll(true)}
              className="h-11 inline-flex items-center gap-2 px-3.5 bg-white hover:bg-rose-50 border border-rose-200/70 text-rose-600 hover:text-rose-700 font-bold rounded-xl transition-all text-xs"
              title="Delete all records permanently"
            >
              <Trash2 size={15} />
              <span>Delete All</span>
            </button>
          )}
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,image/*"
      />

      {/* Modern Filter Panel */}
      {showFilters && (
        <GlassCard className="p-5 animate-fadeIn print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Customer Name
              </label>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="customer"
                  className="h-11 w-full pl-10 pr-3.5 rounded-xl border border-slate-200 bg-white/70 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-slate-900"
                  placeholder="Search customer..."
                  value={filters.customer}
                  onChange={handleFilterChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('transactionHistory.date_from')}</label>
              <input
                type="date"
                name="date_from"
                className="h-11 w-full px-3.5 rounded-xl border border-slate-200 bg-white/70 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-slate-900"
                value={filters.date_from}
                onChange={handleFilterChange}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('transactionHistory.date_to')}</label>
              <input
                type="date"
                name="date_to"
                className="h-11 w-full px-3.5 rounded-xl border border-slate-200 bg-white/70 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-slate-900"
                value={filters.date_to}
                onChange={handleFilterChange}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('transactionHistory.currency')}</label>
              <select
                name="currency"
                className="h-11 w-full px-3.5 rounded-xl border border-slate-200 bg-white/70 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-slate-900"
                value={filters.currency}
                onChange={handleFilterChange}
              >
                <option value="">{t('transactionHistory.all_currencies')}</option>
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('transactionHistory.payment_method')}</label>
              <select
                name="payment_method"
                className="h-11 w-full px-3.5 rounded-xl border border-slate-200 bg-white/70 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-slate-900"
                value={filters.payment_method}
                onChange={handleFilterChange}
              >
                <option value="">{t('transactionHistory.all_methods')}</option>
                {methods.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('transactionHistory.bank_account')}</label>
              <select
                name="bank_account_id"
                className="h-11 w-full px-3.5 rounded-xl border border-slate-200 bg-white/70 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-slate-900"
                value={filters.bank_account_id}
                onChange={handleFilterChange}
              >
                <option value="">{t('transactionHistory.all_accounts')}</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.account_name} ({bank.bank_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('transaction.status')}</label>
              <select
                name="status"
                className="h-11 w-full px-3.5 rounded-xl border border-slate-200 bg-white/70 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-slate-900"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="">All Statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end sm:col-span-2">
              <button
                onClick={handleClearFilters}
                className="h-11 w-full rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Main Table Card Container */}
      <GlassCard className="p-4 sm:p-6 min-w-0">

        {/* Global Live Search Bar directly above the table */}
        <div className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              name="search"
              className="h-10 w-full pl-10 pr-3.5 rounded-xl border border-slate-200/80 bg-white/80 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-slate-900 placeholder:text-slate-400"
              placeholder="Instant search receipt #, customer, subject, receiver..."
              value={filters.search}
              onChange={handleFilterChange}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Currency:</span>
            <button
              onClick={() => setFilters(prev => ({ ...prev, currency: '' }))}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                !filters.currency ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {currencies.map(c => (
              <button
                key={c}
                onClick={() => setFilters(prev => ({ ...prev, currency: c }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filters.currency === c ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-sky-600 mb-3" size={32} />
            <p className="text-xs font-bold text-slate-500">{t('transactionHistory.retrieving')}</p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="overflow-x-auto app-scrollbar pb-6 print:overflow-visible">
              <table className="w-full min-w-[950px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 text-[10px] font-black text-slate-400 uppercase tracking-[0.14em]">
                    <th className="pb-3 pr-3">{t('transaction.receipt_no')}</th>
                    <th className="pb-3 px-3">{t('transaction.date_plain')}</th>
                    <th className="pb-3 px-3">{t('customerLedger.customer')}</th>
                    <th className="pb-3 px-3 text-right">{t('transaction.amount')}</th>
                    <th className="pb-3 px-3 text-right">{t('transaction.equivalent')}</th>
                    <th className="pb-3 px-3">{t('transaction.method')}</th>
                    <th className="pb-3 px-3">{t('receiver')}</th>
                    <th className="pb-3 px-3">{t('transaction.status')}</th>
                    <th className="pb-3 pl-3 text-right print:hidden">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-800">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className={`hover:bg-sky-50/30 transition-all duration-150 group ${deletingTransactionId === tx.id ? 'opacity-50' : ''}`}>
                      <td className="py-3.5 pr-3 font-mono font-bold">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <button
                            className="inline-flex items-center px-2 py-0.5 rounded-lg bg-sky-50/80 hover:bg-sky-100 text-sky-700 hover:text-sky-900 border border-sky-100 transition-colors font-bold text-xs"
                            onClick={() => setPreviewTx(tx)}
                            title="Click to Preview Official Receipt"
                          >
                            {tx.receipt_no}
                          </button>
                          {tx.attachment_path && (
                            <span 
                              className="p-1 rounded-md bg-amber-50 text-amber-600 cursor-pointer hover:bg-amber-100 transition-colors"
                              title={tx.attachment_path.split(/[/\\]/).pop()}
                              onClick={() => navigate(`/transactions/${tx.id}`)}
                            >
                              <Paperclip size={12} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap text-xs font-semibold">{formatDate(tx.date)}</td>
                      <td className="py-3.5 px-3 font-extrabold text-slate-900 break-words max-w-[180px] leading-snug">
                        {tx.customer_name || '-'}
                        {tx.company_name && (
                          <span className="block text-[10px] font-semibold text-slate-400 truncate">{tx.company_name}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black border ${
                          tx.type === 'Received' 
                            ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60' 
                            : 'bg-rose-50/80 text-rose-700 border-rose-200/60'
                        }`}>
                          {tx.type === 'Received' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-700 font-extrabold whitespace-nowrap">
                        {tx.equivalent_amount ? (
                          <span className="inline-flex items-center gap-1 text-slate-800 font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                            {formatCurrency(tx.equivalent_amount, tx.equivalent_currency)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap font-medium text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100/70 text-slate-700 text-[11px]">
                          {tx.payment_method || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 break-words max-w-[130px] leading-snug text-xs">{tx.receiver_name || '-'}</td>
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                          tx.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70' :
                          tx.status === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-200/70' : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            tx.status === 'Completed' ? 'bg-emerald-500' :
                            tx.status === 'Pending' ? 'bg-amber-500' : 'bg-rose-500'
                          }`} />
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3.5 pl-3 text-right whitespace-nowrap print:hidden">
                        <div className="inline-flex items-center gap-1 p-1 bg-white/80 backdrop-blur-md border border-slate-200/70 rounded-xl transition-all shadow-xs group-hover:border-slate-300">
                          {/* Read & Export Group */}
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => setPreviewTx(tx)}
                              disabled={deletingTransactionId === tx.id}
                              className="w-7 h-7 inline-flex items-center justify-center text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all disabled:opacity-50"
                              title="Preview Official Receipt"
                            >
                              <Receipt size={14} />
                            </button>
                            <button
                              onClick={() => navigate(`/transactions/${tx.id}`)}
                              disabled={deletingTransactionId === tx.id}
                              className="w-7 h-7 inline-flex items-center justify-center text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all disabled:opacity-50"
                              title="View Details"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handlePrintReceipt(tx)}
                              disabled={deletingTransactionId === tx.id}
                              className="w-7 h-7 inline-flex items-center justify-center text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all disabled:opacity-50"
                              title="Print Receipt"
                            >
                              <Printer size={14} />
                            </button>
                            <button
                              onClick={() => handleDownloadPDF(tx)}
                              disabled={deletingTransactionId === tx.id || generatingPdfId !== null}
                              className="w-7 h-7 inline-flex items-center justify-center text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all disabled:opacity-50"
                              title="Download PDF"
                            >
                              {generatingPdfId === tx.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            </button>
                          </div>

                          {/* Modify Group */}
                          {!isViewer && (
                            <>
                              <span className="w-px h-3.5 bg-slate-200 my-auto mx-0.5" aria-hidden="true" />
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => handleUploadClick(tx.id)}
                                  disabled={deletingTransactionId === tx.id}
                                  className="w-7 h-7 inline-flex items-center justify-center text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all disabled:opacity-50"
                                  title="Attach Receipt"
                                >
                                  <Paperclip size={14} />
                                </button>
                                <button
                                  onClick={() => navigate(`/edit-transaction/${tx.id}`)}
                                  disabled={deletingTransactionId === tx.id}
                                  className="w-7 h-7 inline-flex items-center justify-center text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all disabled:opacity-50"
                                  title="Edit Details"
                                >
                                  <Edit2 size={14} />
                                </button>
                              </div>
                            </>
                          )}

                          {/* Danger Group */}
                          {isAdmin && (
                            <>
                              <span className="w-px h-3.5 bg-slate-200 my-auto mx-0.5" aria-hidden="true" />
                              <button
                                onClick={() => handleDelete(tx)}
                                disabled={deletingTransactionId === tx.id}
                                className="w-7 h-7 inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-50"
                                title="Delete Permanently"
                              >
                                {deletingTransactionId === tx.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan="9" className="py-14 text-center text-slate-400 font-bold">
                        No transaction records matched the search filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </GlassCard>

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

      {/* Delete Single Modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-900/20">
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Trash2 size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Delete Transaction?
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  This will permanently delete receipt <span className="font-black text-slate-950">{pendingDelete.receipt_no}</span> and its transaction history. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={Boolean(deletingTransactionId)}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={Boolean(deletingTransactionId)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 text-sm font-black text-white shadow-lg shadow-rose-900/20 transition-colors hover:bg-rose-700"
              >
                {deletingTransactionId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Modal */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm print:hidden" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-900/20">
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Trash2 size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Delete All Transactions?
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  This will permanently delete <strong className="text-rose-600">ALL</strong> transactions, attachments, and reset all ledgers. This action is extremely destructive and cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(false)}
                disabled={isDeletingAll}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                disabled={isDeletingAll}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 text-sm font-black text-white shadow-lg shadow-rose-900/20 transition-colors hover:bg-rose-700"
              >
                {isDeletingAll ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Live Receipt Document Preview Modal */}
      {previewTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="w-full max-w-5xl flex items-center justify-between bg-slate-900 text-white p-4 rounded-t-2xl border-b border-slate-800 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="font-black text-sm uppercase tracking-wider text-sky-400">Official Money Receipt Document</span>
              <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                {previewTx.receipt_no}
              </span>
              <span className="text-[11px] font-extrabold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-0.5 rounded-full">
                {formatCurrency(previewTx.amount, previewTx.currency)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopySummary(previewTx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                  copiedSummary
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title="Copy Hawala WhatsApp Text"
              >
                {copiedSummary ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedSummary ? 'Copied!' : 'Copy Summary'}</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrintReceipt(previewTx)}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all"
              >
                <Printer size={14} /> Print
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPDF(previewTx)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all"
              >
                {generatingPdfId === previewTx.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewTx(null)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors ml-1"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="w-full max-w-5xl bg-slate-200/90 p-4 sm:p-8 rounded-b-2xl max-h-[85vh] overflow-y-auto flex justify-center shadow-2xl custom-scrollbar">
            <ReceiptDocument
              transaction={previewTx}
              bankAccount={banks.find((bank) => bank.id === Number(previewTx.bank_account_id))}
              settings={settings}
              language={i18n.resolvedLanguage}
            />
          </div>
        </div>
      )}
    </div>
  );
}

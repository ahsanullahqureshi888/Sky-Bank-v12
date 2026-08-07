import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  Loader2,
  Paperclip,
  Printer,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { bankAPI, settingsAPI, transactionAPI } from '../api/client';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '../utils/formatters';
import GlassCard from '../components/GlassCard';
import { downloadReceiptPdf, printReceipt } from '../utils/receiptExport';

const COMPANY_NAME = 'Sky Ariana Limited';
const COMPANY_SUBTITLE = 'Money Transaction & Hawala Receipt Management System';
const COMPANY_LOGO = '/sky-bbb-logo.png';
const currencies = ['USD', 'Toman', 'Dirham', 'Afghani'];
const methods = ['Bank Transfer', 'Cash', 'Hawala'];
const statuses = ['Completed', 'Pending', 'Cancelled'];

const defaultFilters = {
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

  const fileInputRef = useRef(null);
  const [activeUploadId, setActiveUploadId] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const navigate = useNavigate();

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

  const activeFilterText = useMemo(() => {
    const labels = [];
    if (filters.customer) labels.push(`Customer: ${filters.customer}`);
    if (filters.date_from || filters.date_to) labels.push(`Date: ${filters.date_from || 'start'} to ${filters.date_to || 'today'}`);
    if (filters.currency) labels.push(`Currency: ${filters.currency}`);
    if (filters.payment_method) labels.push(`Method: ${filters.payment_method}`);
    if (filters.status) labels.push(`Status: ${filters.status}`);
    if (filters.bank_account_id) labels.push(`Bank: ${bankNameById.get(Number(filters.bank_account_id)) || filters.bank_account_id}`);
    return labels.length ? labels.join(' | ') : 'All transaction records';
  }, [filters, bankNameById]);

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
      alert('Attachment uploaded successfully.');
      fetchTransactions();
    } catch (err) {
      console.error(err);
      alert('Failed to upload attachment file.');
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
      .summary { display: grid; grid-template-columns: 1.1fr 0.5fr 0.9fr 0.9fr 0.9fr; gap: 2mm; margin-bottom: 2mm; }
      .summary-card { min-height: 14mm; padding: 1.8mm 3mm; border: 1px solid #dbeafe; border-radius: 2.5mm; background: #f7fbff; }
      .summary-card.received-card { border-color: #b7e9d2; background: #f0fdf7; }
      .summary-card.paid-card { border-color: #ffd0d8; background: #fff7f8; }
      .summary-card.net-card { border-color: #fcd34d; background: #fffbeb; }
      .summary-card .label { display: block; margin-bottom: 1.2mm; color: #64748b; font-size: 6.6pt; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
      .summary-card .value { color: #10233f; font-size: 10pt; font-weight: 900; line-height: 1.25; }
      .received-card .value { color: #047857; }
      .paid-card .value { color: #be123c; }
      .net-card .value { color: #b45309; }
      .filter-value { font-size: 8.2pt; white-space: normal; }
      .volume-line { display: block; line-height: 1.5; white-space: nowrap; }
      .table-shell { overflow: hidden; border: 1px solid #cfe0f3; border-radius: 2.5mm; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      thead { display: table-header-group; }
      th { padding: 1.8mm 1.8mm; background: #0f2a4a; color: #fff; font-size: 6.4pt; font-weight: 900; letter-spacing: 0.07em; text-align: left; text-transform: uppercase; }
      td { padding: 1.7mm 1.8mm; border-bottom: 1px solid #e2eaf4; color: #334155; font-size: 7.1pt; line-height: 1.2; vertical-align: top; overflow-wrap: anywhere; }
      tbody tr:nth-child(even) { background: #f8fbff; }
      tbody tr:last-child td { border-bottom: 0; }
      tbody tr { break-inside: avoid; page-break-inside: avoid; }
      .receipt-number { color: #075fb8; font-weight: 900; white-space: nowrap; }
      .customer { color: #10233f; font-weight: 800; }
      .amount { text-align: right; white-space: nowrap; font-weight: 900; overflow-wrap: normal; }
      .received { color: #047857; }
      .paid { color: #be123c; }
      .direction { display: block; margin-top: 0.6mm; color: #64748b; font-size: 5.6pt; font-weight: 800; text-transform: uppercase; }
      .method { color: #334155; font-weight: 700; }
      .status-pill { display: inline-block; padding: 1mm 2mm; border-radius: 10mm; background: #e8fff3; color: #047857; font-size: 6pt; font-weight: 900; text-transform: uppercase; white-space: nowrap; }
      .status-pending { background: #fff8df; color: #a16207; }
      .status-cancelled { background: #fff0f2; color: #be123c; }
      .empty-state { padding: 10mm !important; color: #64748b; text-align: center; }
      .authorization { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; margin-top: 4mm; }
      .signature { padding-top: 6mm; border-top: 1px solid #71849b; color: #475569; font-size: 7pt; font-weight: 800; }
      .signature small { display: block; margin-top: 1mm; color: #94a3b8; font-size: 5.8pt; font-weight: 600; }
      .document-footer { display: flex; justify-content: space-between; gap: 5mm; margin-top: 2.5mm; padding-top: 1.5mm; border-top: 1px solid #dbeafe; color: #64748b; font-size: 6pt; }
    </style>
  `;

  const buildArchivePrintHtml = () => {
    const currencyVolumes = (direction) => {
      const totals = new Map();
      transactions
        .filter((tx) => (direction === 'Received' ? tx.type === 'Received' : tx.type !== 'Received'))
        .forEach((tx) => {
          const currency = tx.currency || 'Unknown';
          totals.set(currency, (totals.get(currency) || 0) + Number(tx.amount || 0));
        });
      if (!totals.size) return '<span class="volume-line">0.00</span>';
      return Array.from(totals.entries())
        .map(([currency, amount]) => `<span class="volume-line">${escapeHtml(formatCurrency(amount, currency))}</span>`)
        .join('');
    };

    const currencyNetVolume = () => {
      const totals = new Map();
      transactions.forEach((tx) => {
        const currency = tx.currency || 'Unknown';
        const amount = Number(tx.amount || 0);
        const sign = tx.type === 'Received' ? 1 : -1;
        totals.set(currency, (totals.get(currency) || 0) + amount * sign);
      });
      if (!totals.size) return '<span class="volume-line">0.00</span>';
      return Array.from(totals.entries())
        .map(([currency, amount]) => `<span class="volume-line">${escapeHtml(formatCurrency(amount, currency))}</span>`)
        .join('');
    };

    const rows = transactions.map((tx) => `
      <tr>
        <td class="receipt-number">${escapeHtml(tx.receipt_no || '-')}</td>
        <td>${escapeHtml(formatDate(tx.date))}</td>
        <td class="customer">${escapeHtml(tx.customer_name || '-')}</td>
        <td>${escapeHtml(tx.subject || '-')}</td>
        <td class="amount ${tx.type === 'Received' ? 'received' : 'paid'}">${escapeHtml(tx.type === 'Received' ? '+' : '-')}${escapeHtml(formatCurrency(tx.amount, tx.currency))}<span class="direction">${escapeHtml(tx.type || '-')}</span></td>
        <td class="amount">${tx.equivalent_amount ? escapeHtml(formatCurrency(tx.equivalent_amount, tx.equivalent_currency)) : '-'}</td>
        <td class="method">${escapeHtml(tx.payment_method || '-')}</td>
        <td>${escapeHtml(tx.receiver_name || '-')}</td>
        <td><span class="status-pill status-${escapeHtml(String(tx.status || '').toLowerCase())}">${escapeHtml(tx.status || '-')}</span></td>
      </tr>
    `).join('');

    return `<!doctype html>
      <html>
        <head>
          <title>${escapeHtml(t('transactionHistory.title'))}</title>
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
                <div><span>Document</span><strong>Transaction Archive</strong></div>
                <div><span>Generated</span><strong>${escapeHtml(new Date().toLocaleDateString())}</strong></div>
                <div><span>Records</span><strong>${archiveTotals.count}</strong></div>
              </div>
            </div>
            <div class="report-title">
              <div>
                <h2>All Transaction Records</h2>
                <p>Official consolidated money transaction and Hawala activity statement</p>
              </div>
              <div class="report-scope">${escapeHtml(activeFilterText)}</div>
            </div>
            <div class="summary">
              <div class="summary-card"><span class="label">Report Scope</span><span class="value filter-value">${escapeHtml(activeFilterText)}</span></div>
              <div class="summary-card"><span class="label">Total Records</span><span class="value">${archiveTotals.count}</span></div>
              <div class="summary-card received-card"><span class="label">Received Volume</span><span class="value">${currencyVolumes('Received')}</span></div>
              <div class="summary-card paid-card"><span class="label">Paid Volume</span><span class="value">${currencyVolumes('Paid')}</span></div>
              <div class="summary-card net-card"><span class="label">Net Volume</span><span class="value">${currencyNetVolume()}</span></div>
            </div>
            <div class="table-shell">
              <table>
                <colgroup>
                  <col style="width:9%"><col style="width:8%"><col style="width:14%"><col style="width:16%"><col style="width:13%"><col style="width:12%"><col style="width:10%"><col style="width:10%"><col style="width:8%">
                </colgroup>
                <thead>
                  <tr>
                    <th>${escapeHtml(t('transaction.receipt_no'))}</th>
                    <th>${escapeHtml(t('transaction.date_plain'))}</th>
                    <th>${escapeHtml(t('customerLedger.customer'))}</th>
                    <th>${escapeHtml(t('subject'))}</th>
                    <th style="text-align:right">${escapeHtml(t('transaction.amount'))}</th>
                    <th style="text-align:right">${escapeHtml(t('transaction.equivalent'))}</th>
                    <th>${escapeHtml(t('transaction.method'))}</th>
                    <th>${escapeHtml(t('receiver'))}</th>
                    <th>${escapeHtml(t('transaction.status'))}</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="9" class="empty-state">No transaction records matched the selected filters.</td></tr>'}
                </tbody>
              </table>
            </div>
            <div class="authorization">
              <div class="signature">Prepared By<small>Name, date, and signature</small></div>
              <div class="signature">Reviewed By<small>Accounts verification</small></div>
              <div class="signature">Authorized Signature / Stamp<small>Official approval</small></div>
            </div>
            <div class="document-footer">
              <span>Official transaction archive generated by ${COMPANY_NAME}.</span>
              <span>Money Transaction &amp; Hawala Receipt Management System</span>
              <span>Page 1</span>
            </div>
          </div>
          <script>window.onload = () => { window.focus(); window.print(); };</script>
        </body>
      </html>`;
  };

  const buildReceiptPrintHtml = (tx) => `<!doctype html>
    <html>
      <head>
        <title>${escapeHtml(tx.receipt_no || 'Receipt')}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm 10mm; }
          * { box-sizing: border-box; }
          html, body { margin: 0; background: #fff; }
          body { font-family: Tahoma, Arial, Helvetica, sans-serif; color: #10233f; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .receipt { border: 1px solid #d9e8f7; padding: 14px; display: flex; flex-direction: column; page-break-inside: avoid; break-inside: avoid; }
          .brand { overflow: hidden; border: 1px solid #d9e8f7; border-radius: 15px; background: #eff6ff; margin-bottom: 8px; }
          .top-rule { height: 6px; background: linear-gradient(90deg, #0f2a4a, #1677ff, #0f2a4a); }
          .brand-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding: 10px 11px; }
          .brand-left { display: flex; align-items: center; min-width: 0; }
          .logo { width: 72px; height: 50px; border-radius: 14px; border: 1px solid #d9e8f7; background: #fff; color: #fff; display: inline-flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 18px; font-weight: 900; overflow: hidden; }
          .logo img { width: 100%; height: 100%; object-fit: contain; padding: 3px; }
          .logo .fallback { display: none; width: 100%; height: 100%; align-items: center; justify-content: center; border-radius: 12px; background: linear-gradient(135deg, #1677ff, #0f2a4a); }
          h1 { margin: 0; font-size: 19px; letter-spacing: -0.01em; color: #0f2a4a; }
          .subtitle { margin-top: 4px; color: #2563eb; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
          .badge { display: grid; grid-template-columns: 88px 1fr; gap: 4px 10px; min-width: 218px; background: #fff; border: 1px solid #d9e8f7; border-radius: 14px; padding: 9px 11px; font-size: 10px; font-weight: 900; color: #2563eb; }
          .badge strong { text-align: right; color: #0f172a; }
          .title { margin: 0 0 8px; border-top: 1px solid #dbeafe; border-bottom: 1px solid #dbeafe; background: #eff6ff; padding: 7px 12px; text-align: center; }
          .title h2 { margin: 0; font-size: 14px; letter-spacing: 0.24em; text-transform: uppercase; color: #0f2a4a; }
          .title p { margin: 3px 0 0; font-size: 9px; font-weight: 800; color: #2563eb; }
          .title .fa, .badge small, .summary small, .label small, .section-label small, .sign-card .fa, footer .fa { display: block; direction: rtl; font-size: 8.6px; letter-spacing: 0; opacity: 0.82; margin-top: 1px; }
          .summary { margin-bottom: 8px; display: grid; grid-template-columns: 1.45fr 1fr 1fr 1fr; gap: 7px; border: 1px solid #bbf7d0; border-radius: 13px; background: linear-gradient(135deg, #ecfdf5, #fff, #eff6ff); padding: 8px; }
          .summary span { display: block; color: #64748b; font-size: 10px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; }
          .summary strong { display: block; margin-top: 6px; color: #111827; font-size: 13px; font-weight: 900; overflow-wrap: anywhere; }
          .summary .money { color: #0f2a4a; font-size: 21px; white-space: nowrap; }
          .section-label { background: #0f2a4a; color: #fff; padding: 5px 10px; font-size: 9px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; }
          .section-label.light { background: #eff6ff; color: #2563eb; }
          .info { overflow: hidden; border: 1px solid #d9e8f7; border-radius: 16px; }
          .row { display: grid; grid-template-columns: 148px minmax(0, 1fr); border-bottom: 1px solid #e6eef7; }
          .row:last-child { border-bottom: 0; }
          .label { background: #f3f8ff; padding: 5px 10px; color: #0d75dd; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; }
          .value { padding: 6px 10px; color: #10233f; font-size: 11px; font-weight: 800; overflow-wrap: anywhere; }
          .info + .info { margin-top: 6px; }
          .amount { font-size: 18px; font-weight: 900; color: #071b34; white-space: nowrap; overflow-wrap: normal; }
          .notes { margin-top: 6px; border: 1px solid #d9e8f7; border-radius: 13px; background: #f8fbff; padding: 7px 9px; }
          .notes .label { display: block; background: transparent; padding: 0; margin-bottom: 6px; }
          .notes p { margin: 0; min-height: 20px; color: #334155; font-size: 10.5px; font-weight: 700; line-height: 1.32; }
          .sign { margin-top: 8px; padding-top: 8px; border-top: 2px solid #d9e8f7; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .sign-card { min-height: 68px; border: 1px solid #d9e8f7; border-radius: 12px; padding: 7px; display: flex; flex-direction: column; justify-content: flex-end; text-align: center; }
          .line { height: 18px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px; }
          .date-line { width: 100%; border-bottom: 1px dotted #cbd5e1; height: 6px; margin: 2px 0 1px; }
          .stamp { height: 36px; width: 96px; border: 2px dashed #93c5fd; background: #f8fbff; border-radius: 10px; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center; color: #60a5fa; font-size: 7.5px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; }
          .sign-card b { color: #0d75dd; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
          .sign-card small { margin-top: 4px; color: #64748b; font-size: 9px; font-weight: 700; }
          footer { margin-top: 6px; border-top: 1px solid #d9e8f7; padding-top: 5px; text-align: center; color: #64748b; font-size: 8px; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="brand">
            <div class="top-rule"></div>
            <div class="brand-row">
              <div class="brand-left">
                <div class="logo">
                  <img src="${window.location.origin}${COMPANY_LOGO}" alt="${COMPANY_NAME}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
                  <span class="fallback">SA</span>
                </div>
                <div>
                  <h1>${COMPANY_NAME}</h1>
                  <div class="subtitle">${COMPANY_SUBTITLE}</div>
                </div>
              </div>
              <div class="badge">
                <span>${escapeHtml(t('transaction.receipt_no'))}<small dir="rtl">شماره رسید</small></span><strong>${escapeHtml(tx.receipt_no || '-')}</strong>
                <span>${escapeHtml(t('transaction.date_plain'))}<small dir="rtl">تاریخ</small></span><strong>${escapeHtml(tx.date || '-')}</strong>
                <span>${escapeHtml(t('transaction.status'))}<small dir="rtl">وضعیت</small></span><strong>${escapeHtml(tx.status || '-')}</strong>
              </div>
            </div>
          </div>
          <div class="title">
            <h2>Money Transaction Receipt</h2>
            <div class="fa" dir="rtl">رسید انتقال وجه</div>
            <p>Official Payment / Hawala / Bank Transfer Record<span class="fa" dir="rtl">سند رسمی پرداخت / حواله / انتقال بانکی</span></p>
          </div>
          <div class="summary">
            <div><span>${escapeHtml(t('transaction.amount'))}<small dir="rtl">مبلغ</small></span><strong class="money">${escapeHtml(formatCurrency(tx.amount, tx.currency))}</strong></div>
            <div><span>${escapeHtml(t('transaction.equivalent'))}<small dir="rtl">معادل</small></span><strong>${escapeHtml(tx.equivalent_amount ? formatCurrency(tx.equivalent_amount, tx.equivalent_currency) : '-')}</strong></div>
            <div><span>${escapeHtml(t('transaction.method'))}<small dir="rtl">روش پرداخت</small></span><strong>${escapeHtml(tx.payment_method || '-')}</strong></div>
            <div><span>${escapeHtml(t('transaction.status'))}<small dir="rtl">وضعیت</small></span><strong>${escapeHtml(tx.status || '-')}</strong></div>
          </div>
          <div class="info">
            <div class="section-label">Party Details<small dir="rtl">مشخصات طرف معامله</small></div>
            <div class="row"><div class="label">${escapeHtml(t('customerLedger.customer'))}<small dir="rtl">مشتری</small></div><div class="value">${escapeHtml(tx.customer_name || '-')}</div></div>
            <div class="row"><div class="label">Company<small dir="rtl">شرکت</small></div><div class="value">${escapeHtml(tx.company_name || '-')}</div></div>
            <div class="row"><div class="label">${escapeHtml(t('subject'))}<small dir="rtl">موضوع</small></div><div class="value">${escapeHtml(tx.subject || '-')}</div></div>
            <div class="row"><div class="label">${escapeHtml(t('receiver'))}<small dir="rtl">دریافت کننده</small></div><div class="value">${escapeHtml(tx.receiver_name || '-')}</div></div>
          </div>
          <div class="info">
            <div class="section-label light">Payment Information<small dir="rtl">معلومات پرداخت</small></div>
            <div class="row"><div class="label">Payment Method<small dir="rtl">روش پرداخت</small></div><div class="value">${escapeHtml(tx.payment_method || '-')}</div></div>
            <div class="row"><div class="label">Bank Account<small dir="rtl">حساب بانکی</small></div><div class="value">${escapeHtml(bankNameById.get(tx.bank_account_id) || (tx.bank_account_id ? `Account ID: ${tx.bank_account_id}` : 'No bank account selected'))}</div></div>
            <div class="row"><div class="label">Currency<small dir="rtl">واحد پول</small></div><div class="value">${escapeHtml(tx.currency || '-')}</div></div>
            <div class="row"><div class="label">Equivalent Currency<small dir="rtl">واحد پول معادل</small></div><div class="value">${escapeHtml(tx.equivalent_currency || '-')}</div></div>
          </div>
          <div class="notes">
            <span class="label">Description / Notes<small dir="rtl">توضیحات</small></span>
            <p>${escapeHtml(tx.description || 'No description notes.')}</p>
          </div>
          <div class="sign">
            <div class="sign-card"><div class="line"></div><b>Prepared By<span class="fa" dir="rtl">تهیه کننده</span></b><div class="date-line"></div><small>Authorized officer</small></div>
            <div class="sign-card"><div class="line"></div><b>Customer Signature<span class="fa" dir="rtl">امضای مشتری</span></b><div class="date-line"></div><small>Received and confirmed</small></div>
            <div class="sign-card"><div class="stamp">Company Stamp<span class="fa" dir="rtl">مهر شرکت</span></div><b>Company Stamp<span class="fa" dir="rtl">مهر شرکت</span></b><div class="date-line"></div><small>Official seal area</small></div>
          </div>
          <footer>
            Official receipt generated by ${COMPANY_NAME}.<br />
            <span class="fa" dir="rtl">رسید رسمی ایجاد شده توسط ${COMPANY_NAME}</span>
            Printed on ${escapeHtml(new Date().toLocaleString())} - This receipt is system-generated and valid for office accounting records. Page 1 of 1.
          </footer>
        </div>
        <script>window.onload = () => { window.focus(); window.print(); };</script>
      </body>
    </html>`;

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-sky-950 leading-tight tracking-normal">{t('transactionHistory.title')}</h1>
          <p className="text-sm text-sky-600 font-semibold mt-1">
            Search, print, export, and manage Hawala receipt records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowFilters((value) => !value)}
            className={`h-12 inline-flex items-center gap-2 px-4 rounded-2xl border border-sky-100 font-black text-sm transition-all ${
              showFilters ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'bg-white/75 hover:bg-sky-50 text-sky-800'
            }`}
          >
            <SlidersHorizontal size={16} />
            <span>{t('transactionHistory.filters')}</span>
          </button>
          <button
            onClick={handlePrintArchive}
            className="h-12 inline-flex items-center gap-2 px-4 bg-white/75 hover:bg-sky-50 border border-sky-100 font-black text-sm text-sky-800 rounded-2xl shadow-lg shadow-sky-900/5 transition-all"
          >
            <Printer size={16} />
            <span>{t('transactionHistory.print_archive')}</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="h-12 inline-flex items-center gap-2 px-4 bg-gradient-to-tr from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all text-sm"
          >
            <FileSpreadsheet size={16} />
            <span>{t('transactionHistory.export_csv')}</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setConfirmDeleteAll(true)}
              className="h-12 inline-flex items-center gap-2 px-4 bg-gradient-to-tr from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black rounded-2xl shadow-lg shadow-red-500/20 transition-all text-sm"
            >
              <Trash2 size={16} />
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

      {showFilters && (
        <GlassCard className="p-5 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
            <div>
              <label className="block text-[11px] font-black text-sky-600 uppercase tracking-wide mb-2">
                Customer Name
              </label>
              <div className="relative">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-400" />
                <input
                  type="text"
                  name="customer"
                  className="h-12 w-full pl-11 pr-4 rounded-2xl border border-sky-100 bg-white/70 focus:outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 text-base font-bold"
                  placeholder="Search customer..."
                  value={filters.customer}
                  onChange={handleFilterChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-sky-600 uppercase tracking-wide mb-2">{t('transactionHistory.date_from')}</label>
              <input
                type="date"
                name="date_from"
                className="h-12 w-full px-4 rounded-2xl border border-sky-100 bg-white/70 focus:outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 text-base font-bold"
                value={filters.date_from}
                onChange={handleFilterChange}
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-sky-600 uppercase tracking-wide mb-2">{t('transactionHistory.date_to')}</label>
              <input
                type="date"
                name="date_to"
                className="h-12 w-full px-4 rounded-2xl border border-sky-100 bg-white/70 focus:outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 text-base font-bold"
                value={filters.date_to}
                onChange={handleFilterChange}
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-sky-600 uppercase tracking-wide mb-2">{t('transactionHistory.currency')}</label>
              <select
                name="currency"
                className="h-12 w-full px-4 rounded-2xl border border-sky-100 bg-white/70 focus:outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 text-base font-bold"
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
              <label className="block text-[11px] font-black text-sky-600 uppercase tracking-wide mb-2">{t('transactionHistory.payment_method')}</label>
              <select
                name="payment_method"
                className="h-12 w-full px-4 rounded-2xl border border-sky-100 bg-white/70 focus:outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 text-base font-bold"
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
              <label className="block text-[11px] font-black text-sky-600 uppercase tracking-wide mb-2">{t('transactionHistory.bank_account')}</label>
              <select
                name="bank_account_id"
                className="h-12 w-full px-4 rounded-2xl border border-sky-100 bg-white/70 focus:outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 text-base font-bold"
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
              <label className="block text-[11px] font-black text-sky-600 uppercase tracking-wide mb-2">{t('transaction.status')}</label>
              <select
                name="status"
                className="h-12 w-full px-4 rounded-2xl border border-sky-100 bg-white/70 focus:outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 text-base font-bold"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="">{t('transactionHistory.all_statuses')}</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-sky-600 uppercase tracking-wide mb-2">{t('transactionHistory.amount_min')}</label>
              <input
                type="number"
                name="amount_min"
                className="h-12 w-full px-4 rounded-2xl border border-sky-100 bg-white/70 focus:outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 text-base font-bold"
                placeholder="0.00"
                value={filters.amount_min}
                onChange={handleFilterChange}
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-sky-600 uppercase tracking-wide mb-2">{t('transactionHistory.amount_max')}</label>
              <input
                type="number"
                name="amount_max"
                className="h-12 w-full px-4 rounded-2xl border border-sky-100 bg-white/70 focus:outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 text-base font-bold"
                placeholder="0.00"
                value={filters.amount_max}
                onChange={handleFilterChange}
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleClearFilters}
                className="h-12 w-full rounded-2xl bg-sky-100/70 hover:bg-sky-100 text-sky-800 font-black text-sm transition-all"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {uploadingAttachment && (
        <div className="rounded-2xl border border-sky-100 bg-white/70 p-3 text-sm font-bold text-sky-700 shadow-lg shadow-sky-900/5">
          Uploading attachment...
        </div>
      )}

      <GlassCard className="p-4 sm:p-6 min-w-0">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-sky-500 mb-3" size={32} />
            <p className="text-sm font-bold text-sky-600">{t('transactionHistory.retrieving')}</p>
          </div>
        ) : (
                  <div>
                    {/* Mobile Card Feed View */}
                    <div className="block md:hidden space-y-4 ios-card-fade-up">
                      {transactions.map((tx) => (
                        <div 
                          key={tx.id} 
                          className={`p-4 bg-white border border-sky-100 rounded-[20px] space-y-3.5 shadow-sm shadow-sky-950/[0.02] border-l-4 transition-all ${
                            tx.type === 'Received' ? 'border-l-emerald-500' : 'border-l-rose-500'
                          } ${deletingTransactionId === tx.id ? 'opacity-70' : ''}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  className="text-sm font-black text-sky-700 hover:underline text-left min-h-[32px] flex items-center"
                                  onClick={() => navigate(`/transactions/${tx.id}`)}
                                >
                                  {tx.receipt_no}
                                </button>
                                {tx.attachment_path && (
                                  <span className="p-1.5 bg-sky-50 rounded-md shrink-0 cursor-pointer min-w-[24px] min-h-[24px] flex items-center justify-center" onClick={() => navigate(`/transactions/${tx.id}`)}>
                                    <Paperclip size={12} className="text-sky-500" />
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-bold text-sky-500 mt-0.5">{formatDate(tx.date)}</p>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide whitespace-nowrap ${
                              tx.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                              tx.status === 'Pending' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                            }`}>
                              {tx.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs py-2.5 border-y border-sky-50/50">
                            <div>
                              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">{t('customerLedger.customer')}</span>
                              <span className="font-extrabold text-slate-800 truncate block">{tx.customer_name || '-'}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">{t('receiver')}</span>
                              <span className="font-extrabold text-slate-800 truncate block">{tx.receiver_name || '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">{t('transaction.amount')}</span>
                              <span className={`font-black ${tx.type === 'Received' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {tx.type === 'Received' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">{t('transaction.equivalent')}</span>
                              <span className="font-black text-sky-800">
                                {tx.equivalent_amount ? formatCurrency(tx.equivalent_amount, tx.equivalent_currency) : '-'}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 pt-1">
                            <span className="text-[10px] text-slate-500 font-bold">{t('transactionHistory.method_colon')} <strong className="text-slate-700">{tx.payment_method}</strong></span>
                            
                            {/* Action Buttons Stack */}
                            <div className="flex gap-1.5 flex-wrap w-full">
                              <button 
                                onClick={() => navigate(`/transactions/${tx.id}`)} 
                                disabled={deletingTransactionId === tx.id} 
                                className="h-11 flex-1 min-w-[50px] inline-flex items-center justify-center bg-sky-50 text-sky-600 rounded-xl disabled:opacity-50 transition-all hover:bg-sky-100" 
                                title="View" 
                                aria-label={`View transaction ${tx.receipt_no}`}
                              >
                                <Eye size={16} />
                              </button>
                              <button 
                                onClick={() => handlePrintReceipt(tx)} 
                                disabled={deletingTransactionId === tx.id || generatingPdfId !== null} 
                                className="h-11 flex-1 min-w-[50px] inline-flex items-center justify-center bg-sky-50 text-sky-600 rounded-xl disabled:opacity-50 transition-all hover:bg-sky-100" 
                                title="Print" 
                                aria-label={`Print transaction ${tx.receipt_no}`}
                              >
                                <Printer size={16} />
                              </button>
                              <button 
                                onClick={() => handleDownloadPDF(tx)} 
                                disabled={deletingTransactionId === tx.id || generatingPdfId !== null} 
                                className="h-11 flex-1 min-w-[50px] inline-flex items-center justify-center bg-sky-50 text-sky-600 rounded-xl disabled:opacity-50 transition-all hover:bg-sky-100" 
                                title="PDF" 
                                aria-label={`Download PDF for transaction ${tx.receipt_no}`}
                              >
                                {generatingPdfId === tx.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                              </button>
                              {!isViewer && (
                                <button 
                                  onClick={() => handleUploadClick(tx.id)} 
                                  disabled={deletingTransactionId === tx.id} 
                                  className="h-11 flex-1 min-w-[50px] inline-flex items-center justify-center bg-sky-50 text-sky-600 rounded-xl disabled:opacity-50 transition-all hover:bg-sky-100" 
                                  title="Attach" 
                                  aria-label={`Attach receipt to transaction ${tx.receipt_no}`}
                                >
                                  <Paperclip size={16} />
                                </button>
                              )}
                              {!isViewer && (
                                <button 
                                  onClick={() => navigate(`/edit-transaction/${tx.id}`)} 
                                  disabled={deletingTransactionId === tx.id} 
                                  className="h-11 flex-1 min-w-[50px] inline-flex items-center justify-center bg-sky-50 text-sky-600 rounded-xl disabled:opacity-50 transition-all hover:bg-sky-100" 
                                  title="Edit" 
                                  aria-label={`Edit transaction ${tx.receipt_no}`}
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(tx)}
                                  disabled={deletingTransactionId === tx.id}
                                  className="h-11 flex-1 min-w-[50px] inline-flex items-center justify-center bg-rose-50 text-rose-600 rounded-xl disabled:opacity-50 transition-all hover:bg-rose-100"
                                  title="Delete Permanently"
                                  aria-label={`Delete transaction ${tx.receipt_no}`}
                                >
                                  {deletingTransactionId === tx.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {transactions.length === 0 && (
                        <div className="py-10 text-center text-sky-400 font-bold">
                          No transaction records matched the search filters.
                        </div>
                      )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto app-scrollbar pb-10">
                      <table className="w-full min-w-[950px] text-left border-collapse">
                        <thead>
                          <tr className="border-b border-sky-100 text-[10px] font-black text-sky-500 uppercase tracking-[0.1em]">
                            <th className="pb-3 pr-2">{t('transaction.receipt_no')}</th>
                            <th className="pb-3 px-2">{t('transaction.date_plain')}</th>
                            <th className="pb-3 px-2">{t('customerLedger.customer')}</th>
                            <th className="pb-3 px-2 text-right">{t('transaction.amount')}</th>
                            <th className="pb-3 px-2 text-right">{t('transaction.equivalent')}</th>
                            <th className="pb-3 px-2">{t('transaction.method')}</th>
                            <th className="pb-3 px-2">{t('receiver')}</th>
                            <th className="pb-3 px-2">{t('transaction.status')}</th>
                            <th className="pb-3 pl-2 text-right">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sky-100/60 text-[13px] font-bold text-sky-900">
                          {transactions.map((tx) => (
                            <tr key={tx.id} className={`hover:bg-sky-50/40 transition-colors group ${deletingTransactionId === tx.id ? 'opacity-70' : ''}`}>
                              <td className="py-3 pr-2 font-black text-sky-950">
                                <div className="flex items-center gap-1 min-w-0">
                                  <button
                                    className="text-left text-sky-700 hover:text-sky-950 hover:underline break-words max-w-[120px] leading-tight"
                                    onClick={() => navigate(`/transactions/${tx.id}`)}
                                  >
                                    {tx.receipt_no}
                                  </button>
                                  {tx.attachment_path && (
                                    <Paperclip
                                      size={12}
                                      className="text-sky-400 shrink-0 cursor-pointer"
                                      title={tx.attachment_path.split(/[\/]/).pop()}
                                      onClick={() => navigate(`/transactions/${tx.id}`)}
                                    />
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-sky-500 whitespace-nowrap text-xs">{formatDate(tx.date)}</td>
                              <td className="py-3 px-2 break-words max-w-[160px] leading-tight">{tx.customer_name || '-'}</td>
                              <td className={`py-3 px-2 text-right font-black whitespace-nowrap ${tx.type === 'Received' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {tx.type === 'Received' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                              </td>
                              <td className="py-3 px-2 text-right text-sky-800 font-black whitespace-nowrap">
                                {tx.equivalent_amount ? formatCurrency(tx.equivalent_amount, tx.equivalent_currency) : '-'}
                              </td>
                              <td className="py-3 px-2 text-sky-900/70 whitespace-nowrap text-xs">{tx.payment_method || '-'}</td>
                              <td className="py-3 px-2 text-sky-900/70 break-words max-w-[120px] leading-tight">{tx.receiver_name || '-'}</td>
                              <td className="py-3 px-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide whitespace-nowrap ${
                                  tx.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                                  tx.status === 'Pending' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                }`}>
                                  {tx.status}
                                </span>
                              </td>
                              <td className="py-3 pl-2 text-right">
                                <div className="inline-flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => navigate(`/transactions/${tx.id}`)} disabled={deletingTransactionId === tx.id} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="View Details" aria-label={`View transaction ${tx.receipt_no}`}>
                                    <Eye size={14} />
                                  </button>
                                  <button onClick={() => handlePrintReceipt(tx)} disabled={deletingTransactionId === tx.id} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Print Receipt" aria-label={`Print transaction ${tx.receipt_no}`}>
                                    <Printer size={14} />
                                  </button>
                                  <button onClick={() => handleDownloadPDF(tx)} disabled={deletingTransactionId === tx.id || generatingPdfId !== null} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Download PDF" aria-label={`Download PDF for transaction ${tx.receipt_no}`}>
                                    {generatingPdfId === tx.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                  </button>
                                  {!isViewer && (
                                    <button onClick={() => handleUploadClick(tx.id)} disabled={deletingTransactionId === tx.id} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Attach Receipt" aria-label={`Attach receipt to transaction ${tx.receipt_no}`}>
                                      <Paperclip size={14} />
                                    </button>
                                  )}
                                  {!isViewer && (
                                    <button onClick={() => navigate(`/edit-transaction/${tx.id}`)} disabled={deletingTransactionId === tx.id} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Edit Details" aria-label={`Edit transaction ${tx.receipt_no}`}>
                                      <Edit2 size={14} />
                                    </button>
                                  )}
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDelete(tx)}
                                      disabled={deletingTransactionId === tx.id}
                                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Delete Permanently"
                                      aria-label={`Delete transaction ${tx.receipt_no}`}
                                    >
                                      {deletingTransactionId === tx.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {transactions.length === 0 && (
                            <tr>
                              <td colSpan="9" className="py-14 text-center text-sky-400 font-bold">
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

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border px-4 py-3 text-sm font-black shadow-2xl backdrop-blur-xl ${
            toast.type === 'success'
              ? 'border-emerald-100 bg-emerald-50/95 text-emerald-700'
              : 'border-rose-100 bg-rose-50/95 text-rose-700'
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-transaction-title">
          <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-900/20">
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Trash2 size={22} />
              </div>
              <div>
                <h2 id="delete-transaction-title" className="text-xl font-black text-slate-950">
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
                className="h-12 rounded-2xl border border-sky-100 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={Boolean(deletingTransactionId)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 text-sm font-black text-white shadow-lg shadow-rose-900/20 transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deletingTransactionId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteAll && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-all-title">
          <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-900/20">
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Trash2 size={22} />
              </div>
              <div>
                <h2 id="delete-all-title" className="text-xl font-black text-slate-950">
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
                className="h-12 rounded-2xl border border-sky-100 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                disabled={isDeletingAll}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 text-sm font-black text-white shadow-lg shadow-rose-900/20 transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeletingAll ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

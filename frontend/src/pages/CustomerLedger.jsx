import React, { useEffect, useMemo, useState } from 'react';
import {
  Edit2,
  FileSpreadsheet,
  Loader2,
  Plus,
  Printer,
  Save,
  Search,
  TrendingDown,
  TrendingUp,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { customerAPI } from '../api/client';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '../utils/formatters';
import GlassCard from '../components/GlassCard';

const COMPANY_NAME = 'SKY ARIANA GROUP OF COMPANIES';
const COMPANY_SUBTITLE = 'Money Transaction & Hawala Receipt Management System';
const COMPANY_LOGO = '/logo.png';

const defaultForm = {
  name: '',
  phone: '',
  address: '',
  notes: '',
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
  String(value || 'customer-ledger')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

/** Deterministic accent per customer so the same name always gets the same avatar color. */
const CUSTOMER_ACCENTS = [
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
];

const customerAccent = (name) => {
  let hash = 0;
  const str = String(name || '');
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % 9973;
  }
  return CUSTOMER_ACCENTS[hash % CUSTOMER_ACCENTS.length];
};

const customerInitials = (name) =>
  String(name || '')
    .replace(/[^A-Za-z\s/]/g, ' ')
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '?';

function LedgerMetricCard({ title, value, tone, icon: Icon }) {
  const toneStyles = {
    rose: {
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      valueColor: 'text-rose-600',
      glow: 'from-rose-500/15',
    },
    emerald: {
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      valueColor: 'text-emerald-600',
      glow: 'from-emerald-500/15',
    },
    sky: {
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
      valueColor: 'text-sky-950',
      glow: 'from-sky-500/15',
    },
  };

  const style = toneStyles[tone] || toneStyles.sky;

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-white bg-white/70 backdrop-blur-xl shadow-sm p-5 min-w-0 group transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div
        className={`absolute top-0 right-0 -mr-6 -mt-6 h-28 w-28 rounded-full bg-gradient-to-br ${style.glow} to-transparent blur-2xl opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none`}
      />
      <div className="relative z-10 flex items-center gap-3.5 min-w-0">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${style.iconBg} ${style.iconColor} shadow-sm border border-white`}
        >
          {Icon && <Icon size={20} strokeWidth={2.5} />}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</p>
          <p className={`text-lg sm:text-xl font-black tracking-tight ${style.valueColor} truncate`} title={value}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CustomerLedger() {
  const { t } = useTranslation();
  const user = JSON.parse(localStorage.getItem('sky_banking_user') || '{}');
  const isAdmin = user.role === 'Admin';
  const isViewer = user.role === 'Viewer';

  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [ledgerRows, setLedgerRows] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const [form, setForm] = useState(defaultForm);
  const [editMode, setEditMode] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchCustomers = async (selectFirst = false) => {
    setLoadingCustomers(true);
    try {
      const res = await customerAPI.list();
      setCustomers(res.data);
      if (res.data.length > 0 && (selectFirst || !selectedCustomerId)) {
        setSelectedCustomerId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    fetchCustomers(true);
  }, []);

  useEffect(() => {
    if (!selectedCustomerId) {
      setLedgerRows([]);
      return;
    }

    setLoadingLedger(true);
    customerAPI.getLedger(selectedCustomerId)
      .then((res) => setLedgerRows(res.data))
      .catch((err) => console.error('Failed to load customer ledger', err))
      .finally(() => setLoadingLedger(false));
  }, [selectedCustomerId]);

  const selectedCustomer = customers.find((c) => c.id === Number(selectedCustomerId));

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.address, customer.notes]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query))
    );
  }, [customers, customerSearch]);

  const totals = useMemo(() => {
    const debit = ledgerRows.reduce((sum, row) => sum + Number(row.debit || 0), 0);
    const credit = ledgerRows.reduce((sum, row) => sum + Number(row.credit || 0), 0);
    const balance = ledgerRows.length ? Number(ledgerRows.at(-1)?.balance || 0) : 0;
    return { debit, credit, balance };
  }, [ledgerRows]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(defaultForm);
    setEditMode(false);
    setFormError('');
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Customer name is required.');
      return;
    }

    setSavingCustomer(true);
    setFormError('');

    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editMode) {
        await customerAPI.update(selectedCustomerId, payload);
        await fetchCustomers(false);
        resetForm();
      } else {
        const res = await customerAPI.create(payload);
        await fetchCustomers(false);
        setSelectedCustomerId(res.data.id);
        resetForm();
      }
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Failed to save customer details.');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleEditClick = () => {
    if (!selectedCustomer) return;
    setForm({
      name: selectedCustomer.name || '',
      phone: selectedCustomer.phone || '',
      address: selectedCustomer.address || '',
      notes: selectedCustomer.notes || '',
    });
    setEditMode(true);
    setFormError('');
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    if (!window.confirm(`Delete customer "${selectedCustomer.name}" permanently?`)) return;

    try {
      await customerAPI.delete(selectedCustomerId);
      const remaining = customers.filter((c) => c.id !== Number(selectedCustomerId));
      setCustomers(remaining);
      setSelectedCustomerId(remaining.length ? remaining[0].id : '');
      resetForm();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to delete customer. Verify they have no transactions.');
    }
  };

  const buildLedgerPrintHtml = () => {
    const now = new Date();
    const printStyle = `
      <style>
        @page { size: A4; margin: 10mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; background: #fff; }
        body { font-family: Inter, Arial, sans-serif; color: #10233f; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .sheet { position: relative; overflow: hidden; border: 1px solid #cfe0f3; background: #fff; padding: 6mm; }
        .top-rule { position: absolute; inset: 0 0 auto; height: 2mm; background: linear-gradient(90deg, #0f2a4a, #2563eb 72%, #c79a45); }
        .brand { display: flex; justify-content: space-between; align-items: center; gap: 8mm; padding: 2mm 0 3mm; border-bottom: 1px solid #c79a45; }
        .brand-left { display: flex; min-width: 0; align-items: center; }
        .logo { display: inline-flex; width: 22mm; height: 15mm; flex: 0 0 auto; align-items: center; justify-content: center; margin-right: 4mm; overflow: hidden; border: 1px solid #d9e8f7; border-radius: 3mm; background: #fff; }
        .logo img { width: 100%; height: 100%; object-fit: contain; padding: 1mm; }
        h1 { margin: 0; color: #0f2a4a; font-size: 17pt; font-weight: 900; line-height: 1.05; }
        .subtitle { margin-top: 1.2mm; color: #2563eb; font-size: 8pt; font-weight: 800; text-transform: uppercase; }
        .report-meta { min-width: 58mm; overflow: hidden; border: 1px solid #cfe0f3; border-radius: 3mm; background: #f8fbff; }
        .report-meta div { display: flex; justify-content: space-between; gap: 5mm; padding: 1.6mm 2.8mm; border-bottom: 1px solid #e4edf7; font-size: 7.6pt; }
        .report-meta div:last-child { border-bottom: 0; }
        .report-meta span { color: #64748b; font-weight: 700; }
        .report-meta strong { color: #0f2a4a; font-weight: 900; }
        .report-title { display: flex; justify-content: space-between; align-items: flex-end; gap: 6mm; padding: 3mm 0 2mm; }
        .report-title h2 { margin: 0; color: #0f2a4a; font-size: 13pt; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; }
        .report-title p { margin: 0.7mm 0 0; color: #64748b; font-size: 7.5pt; }
        .customer-panel { margin-bottom: 3mm; padding: 2.5mm 3.5mm; border: 1px solid #dbeafe; border-radius: 2.5mm; background: #f7fbff; display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
        .customer-panel div { min-width: 0; }
        .customer-panel .label { display: block; margin-bottom: 1mm; color: #64748b; font-size: 6.6pt; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
        .customer-panel .value { color: #10233f; font-size: 9.5pt; font-weight: 800; overflow-wrap: anywhere; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm; margin-bottom: 3mm; }
        .summary-card { min-height: 15mm; padding: 2mm 3.5mm; border: 1px solid #dbeafe; border-radius: 2.5mm; background: #f7fbff; }
        .summary-card.debit-card { border-color: #ffd0d8; background: #fff7f8; }
        .summary-card.credit-card { border-color: #b7e9d2; background: #f0fdf7; }
        .summary-card.balance-card { border-color: #bfdbfe; background: #eff6ff; }
        .summary-card .label { display: block; margin-bottom: 1.3mm; color: #64748b; font-size: 6.8pt; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
        .summary-card .value { color: #10233f; font-size: 11pt; font-weight: 900; line-height: 1.25; white-space: nowrap; }
        .debit-card .value { color: #be123c; }
        .credit-card .value { color: #047857; }
        .balance-card .value { color: #0f2a4a; }
        .table-shell { overflow: hidden; border: 1px solid #cfe0f3; border-radius: 2.5mm; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        thead { display: table-header-group; }
        th { padding: 2mm 2mm; background: #0f2a4a; color: #fff; font-size: 7pt; font-weight: 900; letter-spacing: 0.07em; text-align: left; text-transform: uppercase; }
        td { padding: 1.9mm 2mm; border-bottom: 1px solid #e2eaf4; color: #334155; font-size: 8pt; line-height: 1.25; vertical-align: top; overflow-wrap: anywhere; }
        tbody tr:nth-child(even) { background: #f8fbff; }
        tbody tr:last-child td { border-bottom: 0; }
        tbody tr { break-inside: avoid; page-break-inside: avoid; }
        .amount { text-align: right; white-space: nowrap; font-weight: 900; overflow-wrap: normal; overflow: hidden; text-overflow: clip; }
        .debit { color: #be123c; }
        .credit { color: #047857; }
        .empty-state { padding: 12mm !important; color: #64748b; text-align: center; }
        tfoot td { background: #eef5fd; font-size: 8.6pt; font-weight: 900; border-top: 2px solid #cfe0f3; border-bottom: 0; }
        .authorization { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8mm; margin-top: 6mm; }
        .signature { padding-top: 6mm; border-top: 1px solid #71849b; color: #475569; font-size: 7.5pt; font-weight: 800; }
        .signature small { display: block; margin-top: 1mm; color: #94a3b8; font-size: 6pt; font-weight: 600; }
        .document-footer { display: flex; justify-content: space-between; gap: 5mm; margin-top: 3mm; padding-top: 1.8mm; border-top: 1px solid #dbeafe; color: #64748b; font-size: 6.4pt; }
      </style>
    `;

    const rows = ledgerRows.map((row) => `
      <tr>
        <td>${escapeHtml(formatDate(row.date))}</td>
        <td>${escapeHtml(row.receipt_no || 'OP')}</td>
        <td>${escapeHtml(row.description || '-')}</td>
        <td class="amount debit">${row.debit ? escapeHtml(formatCurrency(row.debit, 'USD')) : '-'}</td>
        <td class="amount credit">${row.credit ? escapeHtml(formatCurrency(row.credit, 'USD')) : '-'}</td>
        <td class="amount">${escapeHtml(formatCurrency(row.balance, 'USD'))}</td>
      </tr>
    `).join('');

    return `<!doctype html>
      <html>
        <head>
          <title>${escapeHtml(selectedCustomer?.name || 'Customer')} Statement</title>
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
                <div><span>Document</span><strong>Customer Account Statement</strong></div>
                <div><span>Generated</span><strong>${escapeHtml(now.toLocaleDateString())}</strong></div>
                <div><span>Time</span><strong>${escapeHtml(now.toLocaleTimeString())}</strong></div>
              </div>
            </div>
            <div class="report-title">
              <div>
                <h2>Customer Ledger Statement</h2>
                <p>Official customer account ledger and balance statement</p>
              </div>
            </div>
            <div class="customer-panel">
              <div><span class="label">Customer</span><span class="value">${escapeHtml(selectedCustomer?.name || '-')}</span></div>
              <div><span class="label">Phone</span><span class="value">${escapeHtml(selectedCustomer?.phone || '-')}</span></div>
              <div><span class="label">Address</span><span class="value">${escapeHtml(selectedCustomer?.address || '-')}</span></div>
            </div>
            <div class="summary">
              <div class="summary-card debit-card"><span class="label">Total Debit</span><span class="value">${escapeHtml(formatCurrency(totals.debit, 'USD'))}</span></div>
              <div class="summary-card credit-card"><span class="label">Total Credit</span><span class="value">${escapeHtml(formatCurrency(totals.credit, 'USD'))}</span></div>
              <div class="summary-card balance-card"><span class="label">Closing Balance</span><span class="value">${escapeHtml(formatCurrency(totals.balance, 'USD'))}</span></div>
            </div>
            <div class="table-shell">
              <table>
                <colgroup>
                  <col style="width:9%"><col style="width:13%"><col style="width:24%"><col style="width:16%"><col style="width:17%"><col style="width:21%">
                </colgroup>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Receipt No.</th>
                    <th>Description</th>
                    <th style="text-align:right">Debit</th>
                    <th style="text-align:right">Credit</th>
                    <th style="text-align:right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="6" class="empty-state">No ledger entries recorded for this customer.</td></tr>'}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3">Statement Total</td>
                    <td class="amount debit">${escapeHtml(formatCurrency(totals.debit, 'USD'))}</td>
                    <td class="amount credit">${escapeHtml(formatCurrency(totals.credit, 'USD'))}</td>
                    <td class="amount">${escapeHtml(formatCurrency(totals.balance, 'USD'))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div class="authorization">
              <div class="signature">Prepared By<small>Name, date, and signature</small></div>
              <div class="signature">Authorized Signature / Stamp<small>Official approval</small></div>
            </div>
            <div class="document-footer">
              <span>Official customer statement generated by ${COMPANY_NAME}.</span>
              <span>${COMPANY_SUBTITLE}</span>
              <span>Page 1</span>
            </div>
          </div>
          <script>window.onload = () => { window.focus(); window.print(); };</script>
        </body>
      </html>`;
  };

  const handlePrint = () => {
    if (!selectedCustomer) return;
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('Please allow popups to print the ledger.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildLedgerPrintHtml());
    printWindow.document.close();
  };

  const handleExportCSV = () => {
    if (!selectedCustomer) return;
    const header = [
      'Company',
      'Customer',
      t('customerLedger.date'),
      t('customerLedger.receipt_no'),
      t('customerLedger.description'),
      t('customerLedger.debit'),
      t('customerLedger.credit'),
      t('customerLedger.balance'),
    ];
    const rows = ledgerRows.map((row) => [
      COMPANY_NAME,
      selectedCustomer.name,
      row.date,
      row.receipt_no || 'OP',
      row.description || '',
      row.debit || 0,
      row.credit || 0,
      row.balance || 0,
    ]);
    rows.push([COMPANY_NAME, selectedCustomer.name, '', 'TOTAL', '', totals.debit, totals.credit, totals.balance]);

    const csvContent = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${safeFilename(selectedCustomer.name)}-ledger.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-sky-950 leading-tight tracking-normal">{t('customerLedger.customer_ledger')}</h1>
          <p className="text-sm text-sky-600 font-semibold mt-1">
            Professional customer statements, balances, receipts, and payment history.
          </p>
        </div>
        <div className="flex flex-col xs:flex-row sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={handlePrint}
            disabled={!selectedCustomer}
            className="h-11 inline-flex items-center justify-center gap-2 px-5 bg-white hover:bg-sky-50 border border-sky-100 font-bold text-[13px] text-sky-700 rounded-[14px] shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={16} className="text-sky-500" />
            <span>{t('customerLedger.print_ledger')}</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!selectedCustomer}
            className="h-11 inline-flex items-center justify-center gap-2 px-5 bg-gradient-to-b from-emerald-400 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 border-t border-white/30 text-white font-bold rounded-[14px] shadow-md shadow-emerald-500/20 transition-all text-[13px] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <FileSpreadsheet size={16} />
            <span>{t('customerLedger.export_csv')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-5 items-start print:block">
        <div className="flex flex-col gap-5 xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] overflow-y-auto nav-scrollbar xl:pb-0 pb-10 pr-1 print:hidden">
          <GlassCard className="p-5 shrink-0">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[11px] font-black text-sky-500 uppercase tracking-[0.18em]">Accounts</p>
              <h2 className="text-lg font-black text-sky-950">{t('customerLedger.customer_directory')}</h2>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users size={20} />
            </div>
          </div>

          <div className="relative mb-4">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-400" />
            <input
              type="search"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="h-12 w-full rounded-2xl border border-sky-100 bg-sky-50/50 pl-11 pr-4 text-base font-bold text-sky-950 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
              placeholder="Search customers..."
            />
          </div>

          {loadingCustomers ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="animate-spin text-sky-500" size={24} />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-[54vh] min-h-0 overflow-y-auto pr-2 nav-scrollbar">
              {filteredCustomers.map((customer) => {
                const isSelected = Number(selectedCustomerId) === customer.id;
                return (
                  <button
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      resetForm();
                    }}
                    className={`w-full text-left px-4 py-3 rounded-[18px] transition-all min-w-0 flex items-center gap-3 border ${
                      isSelected
                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 border-transparent translate-x-1'
                        : 'bg-white/70 border-white hover:bg-white text-sky-900 shadow-sm hover:shadow-md hover:border-sky-100 hover:translate-x-0.5'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-black ${
                        isSelected ? 'bg-white/20 text-white' : customerAccent(customer.name)
                      }`}
                      aria-hidden="true"
                    >
                      {customerInitials(customer.name)}
                    </span>
                    <span className="min-w-0 flex flex-col justify-center">
                      <span className="block truncate text-[14px] font-black">{customer.name}</span>
                      {(customer.phone || customer.address) && (
                        <span className={`block truncate text-[11px] mt-0.5 font-bold ${isSelected ? 'text-sky-100' : 'text-sky-500'}`}>
                          {customer.phone || customer.address}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              {filteredCustomers.length === 0 && (
                <div className="text-center py-10 bg-white/40 rounded-2xl border border-dashed border-sky-200">
                  <p className="text-sm text-sky-500 font-bold">
                    No customers found.
                  </p>
                </div>
              )}
            </div>
          )}

          </GlassCard>
          {!isViewer && (
            <GlassCard className="p-5 shrink-0">
            <div className="flex items-center justify-between border-b border-sky-100 pb-4 mb-5">
              <div>
                <p className="text-[11px] font-black text-sky-500 uppercase tracking-[0.16em]">
                  {editMode ? 'Update Profile' : 'New Account'}
                </p>
                <h2 className="text-lg font-black text-sky-950 flex items-center gap-2">
                  {editMode ? 'Edit Customer' : 'Add Customer'}
                </h2>
              </div>
              {editMode ? (
                <button
                  onClick={resetForm}
                  className="h-10 w-10 rounded-xl text-sky-400 hover:text-sky-700 hover:bg-sky-50 transition-colors inline-flex items-center justify-center"
                  title="Cancel edit"
                >
                  <X size={17} />
                </button>
              ) : (
                <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 inline-flex items-center justify-center">
                  <Plus size={18} />
                </div>
              )}
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-sky-700 uppercase tracking-wide mb-2">
                  Customer / Company Name
                </label>
                <input
                  type="text"
                  name="name"
                  className="h-12 w-full px-4 rounded-2xl border border-sky-100 bg-white/70 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 text-base font-bold text-sky-950"
                  placeholder="Ariana Transport, Kabul Corp"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-sky-700 uppercase tracking-wide mb-2">
                  Contact Phone
                </label>
                <input
                  type="text"
                  name="phone"
                  className="h-12 w-full px-4 rounded-2xl border border-sky-100 bg-white/70 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 text-base font-bold text-sky-950"
                  placeholder="+93 799..."
                  value={form.phone}
                  onChange={handleFormChange}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-sky-700 uppercase tracking-wide mb-2">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  className="h-12 w-full px-4 rounded-2xl border border-sky-100 bg-white/70 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 text-base font-bold text-sky-950"
                  placeholder="Kabul, Afghanistan"
                  value={form.address}
                  onChange={handleFormChange}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-sky-700 uppercase tracking-wide mb-2">
                  Notes
                </label>
                <textarea
                  name="notes"
                  rows="4"
                  className="w-full px-4 py-3 rounded-2xl border border-sky-100 bg-white/70 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 text-base font-bold text-sky-950 resize-none"
                  placeholder="Internal ledger notes..."
                  value={form.notes}
                  onChange={handleFormChange}
                />
              </div>

              {formError && (
                <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={savingCustomer}
                className="h-12 w-full bg-gradient-to-tr from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black rounded-2xl shadow-lg shadow-sky-500/20 transition-all text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {savingCustomer ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                <span>{editMode ? 'Update Customer' : 'Register Customer'}</span>
              </button>
            </form>
          </GlassCard>
          )}
        </div>

        <div className="space-y-5 min-w-0 flex-1">
          {selectedCustomer ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <LedgerMetricCard
                  title={t('customerLedger.total_debit')}
                  value={formatCurrency(totals.debit, 'USD')}
                  icon={TrendingDown}
                  tone="rose"
                />
                <LedgerMetricCard
                  title={t('customerLedger.total_credit')}
                  value={formatCurrency(totals.credit, 'USD')}
                  icon={TrendingUp}
                  tone="emerald"
                />
                <LedgerMetricCard
                  title={t('customerLedger.closing_balance')}
                  value={formatCurrency(totals.balance, 'USD')}
                  icon={Wallet}
                  tone="sky"
                />
              </div>

              <GlassCard className="p-5 sm:p-6 min-w-0 print:border-none print:bg-white print:shadow-none">
                {/* Print-only clean statement header (fallback if printed without the dedicated Print Ledger button) */}
                <div className="hidden print:block mb-4">
                  <div className="flex items-center justify-between border-b-2 border-sky-900 pb-3 mb-3">
                    <div>
                      <h1 className="text-lg font-black text-sky-950">{COMPANY_NAME}</h1>
                      <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wide">Customer Account Statement</p>
                    </div>
                    <div className="text-right text-[10px] font-semibold text-slate-600">
                      <p>Customer: <span className="font-black text-sky-950">{selectedCustomer.name}</span></p>
                      <p>Generated: {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <div className="border-b border-sky-100 pb-5 mb-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 print:hidden">
                  <div className="min-w-0">
                    <h2 className="text-xl font-black text-sky-950 leading-snug truncate">
                      {selectedCustomer.name}
                    </h2>
                    <p className="text-sm font-bold text-sky-500">Account Statement</p>
                  </div>

                  {!isViewer && (
                    <div className="flex flex-wrap gap-2.5 mt-3 lg:mt-0">
                      <button
                        onClick={handleEditClick}
                        className="h-10 px-4 bg-gradient-to-br from-sky-50 to-white hover:from-sky-100 hover:to-sky-50 text-sky-700 font-bold text-xs uppercase tracking-wide rounded-xl border border-sky-100 shadow-sm hover:shadow inline-flex items-center gap-2 transition-all"
                      >
                        <Edit2 size={14} />
                        <span>{t('customerLedger.edit_account')}</span>
                      </button>
                      {isAdmin && (
                        <button
                          onClick={handleDeleteCustomer}
                          className="h-10 px-4 bg-gradient-to-br from-rose-50 to-white hover:from-rose-100 hover:to-rose-50 text-rose-600 font-bold text-xs uppercase tracking-wide rounded-xl border border-rose-100 shadow-sm hover:shadow inline-flex items-center gap-2 transition-all"
                        >
                          <Trash2 size={14} />
                          <span>{t('customerLedger.delete_account')}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {loadingLedger ? (
                  <div className="py-16 flex flex-col items-center justify-center">
                    <Loader2 className="animate-spin text-sky-500 mb-3" size={30} />
                    <p className="text-sm font-bold text-sky-600">Retrieving account statement...</p>
                  </div>
                ) : (
                  <div>
                    {/* Mobile Cards Statement View */}
                    <div className="block md:hidden print:hidden space-y-3.5 ios-card-fade-up">
                      {ledgerRows.map((row) => (
                        <div 
                          key={row.id} 
                          className={`p-4 bg-white border border-sky-100 rounded-[20px] space-y-2.5 shadow-sm shadow-sky-950/[0.02] border-l-4 ${
                            row.debit ? 'border-l-rose-500' : row.credit ? 'border-l-emerald-500' : 'border-l-sky-400'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-sky-600">{formatDate(row.date)}</span>
                              <span className="text-[10px] font-black text-sky-950 bg-sky-50 px-2 py-0.5 rounded-lg">
                                {row.receipt_no || 'OP'}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">{t('customerLedger.running_bal')}</span>
                              <span className="text-xs font-black text-slate-900">{formatCurrency(row.balance, 'USD')}</span>
                            </div>
                          </div>
                          
                          {row.description && (
                            <div className="text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-sky-100/10 break-words">
                              {row.description}
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center text-xs font-black pt-2 border-t border-sky-50/50">
                            <div>
                              {row.debit ? (
                                <span className="text-rose-600 uppercase tracking-wide text-[10px]">Debit: +{formatCurrency(row.debit, 'USD')}</span>
                              ) : <span className="text-slate-300">-</span>}
                            </div>
                            <div>
                              {row.credit ? (
                                <span className="text-emerald-600 uppercase tracking-wide text-[10px]">Credit: -{formatCurrency(row.credit, 'USD')}</span>
                              ) : <span className="text-slate-300">-</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                      {ledgerRows.length === 0 && (
                        <div className="py-10 text-center">
                          <p className="text-sky-500 font-bold text-sm">No ledger entries yet</p>
                        </div>
                      )}
                      {ledgerRows.length > 0 && (
                        <div className="p-4 bg-sky-50/80 border border-sky-100/70 rounded-2xl space-y-1.5 text-xs font-black text-sky-950 shadow-sm mt-4">
                          <div className="flex justify-between">
                            <span>{t('customerLedger.statement_debit_total')}</span>
                            <span className="text-rose-600">+{formatCurrency(totals.debit, 'USD')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t('customerLedger.statement_credit_total')}</span>
                            <span className="text-emerald-600">-{formatCurrency(totals.credit, 'USD')}</span>
                          </div>
                          <div className="flex justify-between border-t border-sky-200/50 pt-1.5 text-sm">
                            <span>{t('customerLedger.closing_balance_label')}</span>
                            <span>{formatCurrency(totals.balance, 'USD')}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block print:block overflow-x-auto print:overflow-visible app-scrollbar rounded-2xl border border-sky-100 bg-white/50 print:border-none">
                      <table className="w-full text-left border-collapse print:text-[9px]">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-sky-100 text-[11px] font-black text-sky-600 uppercase tracking-[0.15em]">
                            <th className="py-3.5 pl-5 pr-4">{t('customerLedger.date')}</th>
                            <th className="py-3.5 px-4">{t('customerLedger.receipt_no')}</th>
                            <th className="py-3.5 px-4">{t('customerLedger.description')}</th>
                            <th className="py-3.5 px-4 text-right">{t('customerLedger.debit')}</th>
                            <th className="py-3.5 px-4 text-right">{t('customerLedger.credit')}</th>
                            <th className="py-3.5 pr-5 pl-4 text-right">{t('customerLedger.balance')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sky-100/60 text-sm font-bold text-sky-900">
                          {ledgerRows.map((row, rowIndex) => (
                            <tr
                              key={row.id}
                              className={`transition-colors hover:bg-sky-50/60 ${rowIndex % 2 === 1 ? 'bg-sky-50/30' : ''}`}
                            >
                              <td className="py-4 pl-5 pr-4 text-sky-500 whitespace-nowrap">{formatDate(row.date)}</td>
                              <td className="py-4 px-4 font-black text-sky-950 whitespace-nowrap">
                                <span className="bg-sky-50 px-2 py-1 rounded-lg text-xs">{row.receipt_no || 'OP'}</span>
                              </td>
                              <td className="py-4 px-4 min-w-[220px]">{row.description || '-'}</td>
                              <td className="py-4 px-4 text-right font-black text-rose-600 whitespace-nowrap">
                                {row.debit ? formatCurrency(row.debit, 'USD') : '-'}
                              </td>
                              <td className="py-4 px-4 text-right font-black text-emerald-600 whitespace-nowrap">
                                {row.credit ? formatCurrency(row.credit, 'USD') : '-'}
                              </td>
                              <td className="py-4 pr-5 pl-4 text-right font-black text-sky-950 whitespace-nowrap">
                                {formatCurrency(row.balance, 'USD')}
                              </td>
                            </tr>
                          ))}
                          {ledgerRows.length === 0 && (
                            <tr>
                              <td colSpan="6" className="py-14 text-center">
                                <div className="mx-auto max-w-sm">
                                  <div className="mx-auto h-12 w-12 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center mb-3">
                                    <FileSpreadsheet size={22} />
                                  </div>
                                  <p className="text-sky-800 font-black">No ledger entries yet</p>
                                  <p className="text-sky-400 text-xs mt-1">
                                    Saved transactions for this customer will appear here automatically.
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-sky-200 bg-gradient-to-r from-sky-50/80 to-blue-50/80 text-sm font-black text-sky-950 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                            <td className="py-4.5 pl-5 pr-4 uppercase tracking-widest text-[11px]" colSpan="3">{t('customerLedger.statement_total')}</td>
                            <td className="py-4.5 px-4 text-right text-rose-600 whitespace-nowrap">{formatCurrency(totals.debit, 'USD')}</td>
                            <td className="py-4.5 px-4 text-right text-emerald-600 whitespace-nowrap">{formatCurrency(totals.credit, 'USD')}</td>
                            <td className="py-4.5 pr-5 pl-4 text-right whitespace-nowrap">{formatCurrency(totals.balance, 'USD')}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </GlassCard>
            </>
          ) : (
            <GlassCard className="py-20 text-center">
              <p className="text-sky-500 font-black">Select or register a customer to view account ledgers.</p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

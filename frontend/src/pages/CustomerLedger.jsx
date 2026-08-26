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
  RotateCw,
} from 'lucide-react';
import { customerAPI } from '../api/client';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate, safeGetStoredUser } from '../utils/formatters';
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
  const user = safeGetStoredUser();
  const isAdmin = user.role === 'Admin';
  const isViewer = user.role === 'Viewer';

  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('ALL');
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
        const preferred = res.data.find((c) => c.name?.includes('Khanam') || c.name?.includes('Bolambar')) || res.data[0];
        setSelectedCustomerId(preferred.id);
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

  const loadLedger = (customerId, currency) => {
    if (!customerId) {
      setLedgerRows([]);
      return;
    }

    setLoadingLedger(true);
    const currParam = currency && currency !== 'ALL' ? currency : undefined;
    customerAPI.getLedger(customerId, currParam)
      .then((res) => {
        setLedgerRows(res.data || []);
      })
      .catch((err) => console.error('Failed to load customer ledger', err))
      .finally(() => setLoadingLedger(false));
  };

  useEffect(() => {
    loadLedger(selectedCustomerId, selectedCurrency);
  }, [selectedCustomerId, selectedCurrency]);

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
    const balance = ledgerRows.length ? Number(ledgerRows.at(-1)?.balance || 0) : (credit - debit);
    return { debit, credit, balance };
  }, [ledgerRows]);

  const activeCurrencyLabel = selectedCurrency === 'ALL' ? (ledgerRows[0]?.currency || 'USD') : selectedCurrency;

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
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();

    return `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(selectedCustomer.name)} - Customer Statement</title>
          <style>
            @page { size: A4; margin: 10mm; }
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; }
            .sheet { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; padding: 20px; }
            .top-bar { height: 4px; background: linear-gradient(90deg, #1e3a8a, #3b82f6 70%, #d97706); margin: -20px -20px 20px -20px; }
            .header-flex { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
            .brand-left { display: flex; align-items: center; gap: 15px; }
            .brand-logo { width: 65px; height: 50px; object-fit: contain; }
            .brand-title { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; }
            .brand-sub { font-size: 8.5px; font-weight: 800; color: #2563eb; text-transform: uppercase; margin-top: 3px; letter-spacing: 0.05em; }
            .meta-box { border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc; font-size: 10px; width: 220px; }
            .meta-row { display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #e2e8f0; }
            .meta-row:last-child { border-bottom: none; }
            .meta-label { color: #64748b; font-weight: 700; }
            .meta-val { font-weight: 900; color: #0f172a; }
            .doc-title { font-size: 16px; font-weight: 900; color: #0f172a; margin: 15px 0 3px 0; text-transform: uppercase; letter-spacing: 0.05em; }
            .doc-sub { font-size: 9px; color: #64748b; margin-bottom: 15px; }
            .customer-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 15px; display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 11px; }
            .cust-col { flex: 1; }
            .cust-label { font-size: 8px; font-weight: 900; text-transform: uppercase; color: #64748b; margin-bottom: 3px; letter-spacing: 0.05em; }
            .cust-val { font-weight: 800; color: #0f172a; }
            .kpi-row { display: flex; gap: 10px; margin-bottom: 15px; }
            .kpi-box { flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
            .kpi-debit { background: #fff1f2; border-color: #fecdd3; }
            .kpi-credit { background: #f0fdf4; border-color: #bbf7d0; }
            .kpi-bal { background: #f0fdfa; border-color: #ccfbf1; }
            .kpi-title { font-size: 8.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
            .kpi-val { font-size: 15px; font-weight: 900; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px; }
            thead th { background: #0f243e; color: #fff; text-align: left; padding: 8px 10px; font-size: 8.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
            thead th.num { text-align: right; }
            tbody tr { border-bottom: 1px solid #e2e8f0; }
            tbody tr:nth-child(even) { background: #f8fafc; }
            tbody td { padding: 8px 10px; color: #334155; font-weight: 600; }
            tbody td.num { text-align: right; font-weight: 800; }
            tfoot tr { background: #f1f5f9; font-weight: 900; border-top: 2px solid #cbd5e1; }
            tfoot td { padding: 10px; font-size: 10.5px; }
            .auth-row { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; }
            .sign-block { width: 200px; text-align: center; border-top: 1px dashed #94a3b8; padding-top: 5px; font-size: 9px; font-weight: 700; color: #475569; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="top-bar"></div>
            <div class="header-flex">
              <div class="brand-left">
                <img src="/logo.png" class="brand-logo" alt="Logo" />
                <div>
                  <h1 class="brand-title">Sky Ariana Limited</h1>
                  <div class="brand-sub">MONEY TRANSACTION & HAWALA RECEIPT MANAGEMENT SYSTEM</div>
                </div>
              </div>
              <div class="meta-box">
                <div class="meta-row"><span class="meta-label">Document</span><span class="meta-val">Customer Account Statement</span></div>
                <div class="meta-row"><span class="meta-label">Generated</span><span class="meta-val">${dateStr}</span></div>
                <div class="meta-row"><span class="meta-label">Time</span><span class="meta-val">${timeStr}</span></div>
              </div>
            </div>

            <div class="doc-title">CUSTOMER LEDGER STATEMENT</div>
            <div class="doc-sub">Official customer account ledger and balance statement</div>

            <div class="customer-card">
              <div class="cust-col">
                <div class="cust-label">CUSTOMER</div>
                <div class="cust-val">${escapeHtml(selectedCustomer.name)}</div>
              </div>
              <div class="cust-col">
                <div class="cust-label">PHONE</div>
                <div class="cust-val">${escapeHtml(selectedCustomer.phone || '-')}</div>
              </div>
              <div class="cust-col" style="flex: 1.5;">
                <div class="cust-label">ADDRESS</div>
                <div class="cust-val">${escapeHtml(selectedCustomer.address || '-')}</div>
              </div>
            </div>

            <div class="kpi-row">
              <div class="kpi-box kpi-debit">
                <div class="kpi-title" style="color: #e11d48;">TOTAL DEBIT</div>
                <div class="kpi-val" style="color: #e11d48;">${formatCurrency(totals.debit, activeCurrencyLabel)}</div>
              </div>
              <div class="kpi-box kpi-credit">
                <div class="kpi-title" style="color: #16a34a;">TOTAL CREDIT</div>
                <div class="kpi-val" style="color: #16a34a;">${formatCurrency(totals.credit, activeCurrencyLabel)}</div>
              </div>
              <div class="kpi-box kpi-bal">
                <div class="kpi-title" style="color: #0f766e;">CLOSING BALANCE</div>
                <div class="kpi-val" style="color: #0f766e;">${formatCurrency(totals.balance, activeCurrencyLabel)}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 14%;">DATE</th>
                  <th style="width: 18%;">RECEIPT NO.</th>
                  <th style="width: 32%;">DESCRIPTION</th>
                  <th class="num" style="width: 12%;">DEBIT</th>
                  <th class="num" style="width: 12%;">CREDIT</th>
                  <th class="num" style="width: 12%;">BALANCE</th>
                </tr>
              </thead>
              <tbody>
                ${ledgerRows.map((r) => `
                  <tr>
                    <td>${formatDate(r.date)}</td>
                    <td style="font-weight: 800; color: #0f172a;">${escapeHtml(r.receipt_no || 'OP')}</td>
                    <td>${escapeHtml(r.description || '-')}</td>
                    <td class="num" style="color: ${r.debit ? '#e11d48' : '#94a3b8'};">${r.debit ? formatCurrency(r.debit, r.currency || activeCurrencyLabel) : '-'}</td>
                    <td class="num" style="color: ${r.credit ? '#16a34a' : '#94a3b8'};">${r.credit ? formatCurrency(r.credit, r.currency || activeCurrencyLabel) : '-'}</td>
                    <td class="num" style="font-weight: 900; color: #0f172a;">${formatCurrency(r.balance, r.currency || activeCurrencyLabel)}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3">Statement Total</td>
                  <td class="num" style="color: #e11d48;">${formatCurrency(totals.debit, activeCurrencyLabel)}</td>
                  <td class="num" style="color: #16a34a;">${formatCurrency(totals.credit, activeCurrencyLabel)}</td>
                  <td class="num" style="color: #0f172a;">${formatCurrency(totals.balance, activeCurrencyLabel)}</td>
                </tr>
              </tfoot>
            </table>

            <div class="auth-row">
              <div class="sign-block">Prepared By</div>
              <div class="sign-block">Authorized Signature / Stamp</div>
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
      'Date',
      'Receipt No',
      'Description',
      'Currency',
      'Debit',
      'Credit',
      'Balance',
    ];
    const rows = ledgerRows.map((row) => [
      COMPANY_NAME,
      selectedCustomer.name,
      row.date,
      row.receipt_no || 'OP',
      row.description || '',
      row.currency || activeCurrencyLabel,
      row.debit || 0,
      row.credit || 0,
      row.balance || 0,
    ]);
    rows.push([COMPANY_NAME, selectedCustomer.name, '', 'TOTAL', '', activeCurrencyLabel, totals.debit, totals.credit, totals.balance]);

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
      {/* Top Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">{t('customerLedger.customer_ledger')}</h1>
          <p className="text-xs text-sky-600 font-bold mt-1">
            Official customer statements, Hawala ledger, and live balance verification.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              loadLedger(selectedCustomerId, selectedCurrency);
              fetchCustomers(false);
            }}
            className="h-10 inline-flex items-center justify-center gap-2 px-4 bg-white hover:bg-sky-50 border border-sky-200/80 font-black text-xs text-sky-700 rounded-xl shadow-xs transition-all active:scale-95"
            title="Refresh customer ledger data"
          >
            <RotateCw size={14} className={loadingLedger ? 'animate-spin text-sky-500' : 'text-sky-600'} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={!selectedCustomer}
            className="h-10 inline-flex items-center justify-center gap-2 px-4 bg-white hover:bg-sky-50 border border-sky-200/80 font-black text-xs text-sky-700 rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <Printer size={15} className="text-sky-600" />
            <span>{t('customerLedger.print_ledger')}</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!selectedCustomer}
            className="h-10 inline-flex items-center justify-center gap-2 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl shadow-md shadow-emerald-500/20 transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <FileSpreadsheet size={15} />
            <span>{t('customerLedger.export_csv')}</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-5 items-start print:block">
        
        {/* Left Sidebar: Customer Directory */}
        <div className="flex flex-col gap-5 xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] overflow-y-auto nav-scrollbar xl:pb-0 pb-10 pr-1 print:hidden">
          <GlassCard className="p-5 shrink-0">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.18em]">Directory</p>
                <h2 className="text-base font-black text-slate-900">{t('customerLedger.customer_directory')}</h2>
              </div>
              <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                <Users size={18} />
              </div>
            </div>

            <div className="relative mb-3.5">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400" />
              <input
                type="search"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="h-10 w-full rounded-xl border border-sky-100 bg-sky-50/60 pl-10 pr-3 text-xs font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-500/10"
                placeholder="Search customers..."
              />
            </div>

            {loadingCustomers ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="animate-spin text-sky-500" size={24} />
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[50vh] min-h-0 overflow-y-auto pr-1 nav-scrollbar">
                {filteredCustomers.map((customer) => {
                  const isSelected = Number(selectedCustomerId) === customer.id;
                  return (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomerId(customer.id);
                        resetForm();
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all min-w-0 flex items-center gap-3 border ${
                        isSelected
                          ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20 border-transparent'
                          : 'bg-white/80 border-sky-100 hover:bg-sky-50/70 text-slate-800 shadow-2xs hover:border-sky-200'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-black ${
                          isSelected ? 'bg-white/20 text-white' : customerAccent(customer.name)
                        }`}
                        aria-hidden="true"
                      >
                        {customerInitials(customer.name)}
                      </span>
                      <span className="min-w-0 flex flex-col justify-center flex-1">
                        <span className="block truncate text-xs font-black">{customer.name}</span>
                        {(customer.phone || customer.address) && (
                          <span className={`block truncate text-[10px] mt-0.5 font-bold ${isSelected ? 'text-sky-100' : 'text-slate-400'}`}>
                            {customer.phone || customer.address}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
                {filteredCustomers.length === 0 && (
                  <div className="text-center py-8 bg-white/40 rounded-xl border border-dashed border-sky-200">
                    <p className="text-xs text-sky-600 font-bold">No customers found.</p>
                  </div>
                )}
              </div>
            )}
          </GlassCard>

          {/* Add / Edit Customer Form */}
          {!isViewer && (
            <GlassCard className="p-5 shrink-0">
              <div className="flex items-center justify-between border-b border-sky-100 pb-3 mb-4">
                <div>
                  <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.16em]">
                    {editMode ? 'Update Profile' : 'New Account'}
                  </p>
                  <h2 className="text-sm font-black text-slate-900">
                    {editMode ? 'Edit Customer' : 'Add Customer'}
                  </h2>
                </div>
                {editMode ? (
                  <button
                    onClick={resetForm}
                    className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-sky-50 transition-colors inline-flex items-center justify-center"
                    title="Cancel edit"
                  >
                    <X size={15} />
                  </button>
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-600 inline-flex items-center justify-center">
                    <Plus size={16} />
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveCustomer} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Mrs Khanam Tokali Bolambar"
                    className="h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10"
                    value={form.name}
                    onChange={handleFormChange}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    name="phone"
                    placeholder="+98 0917 232 5086"
                    className="h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10"
                    value={form.phone}
                    onChange={handleFormChange}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    placeholder="Cubic Building, Bandar Abbas, Iran"
                    className="h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10"
                    value={form.address}
                    onChange={handleFormChange}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    name="notes"
                    placeholder="Account notes"
                    className="h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10"
                    value={form.notes}
                    onChange={handleFormChange}
                  />
                </div>

                {formError && (
                  <div className="p-2.5 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="h-10 w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-black rounded-xl shadow-md shadow-sky-500/20 transition-all text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {savingCustomer ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                  <span>{editMode ? 'Update Customer' : 'Save Customer'}</span>
                </button>
              </form>
            </GlassCard>
          )}
        </div>

        {/* Right Panel: Official Customer Statement */}
        <div className="space-y-5 min-w-0 flex-1">
          {selectedCustomer ? (
            <>
              {/* Quick Customer Switcher & Currency Tabs */}
              <GlassCard className="p-4 print:hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 shrink-0">
                      Active Customer:
                    </label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => {
                        setSelectedCustomerId(e.target.value);
                        resetForm();
                      }}
                      className="h-10 flex-1 max-w-sm rounded-xl border border-sky-200 bg-white px-3 text-xs font-black text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    >
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Currency Filter Tabs */}
                  <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl shrink-0">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 px-2">Currency:</span>
                    {['ALL', 'USD', 'Toman', 'AFN', 'AED'].map((curr) => {
                      const isActive = selectedCurrency === curr;
                      return (
                        <button
                          key={curr}
                          onClick={() => setSelectedCurrency(curr)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                            isActive
                              ? 'bg-white text-sky-700 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {curr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </GlassCard>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-rose-200/60 bg-gradient-to-br from-rose-50/90 via-white to-rose-100/30 p-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-sm">
                      <TrendingDown size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-600">Total Debit</p>
                      <p className="text-lg font-black text-rose-700">{formatCurrency(totals.debit, activeCurrencyLabel)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-100/30 p-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600">Total Credit</p>
                      <p className="text-lg font-black text-emerald-700">{formatCurrency(totals.credit, activeCurrencyLabel)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-teal-200/60 bg-gradient-to-br from-teal-50/90 via-white to-teal-100/30 p-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">Closing Balance</p>
                      <p className="text-lg font-black text-teal-900">{formatCurrency(totals.balance, activeCurrencyLabel)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Account Statement Card */}
              <GlassCard className="p-5 sm:p-6 min-w-0 shadow-xl shadow-sky-950/[0.04]">
                {/* Statement Header */}
                <div className="border-b border-sky-100 pb-4 mb-5 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900 leading-tight">
                        {selectedCustomer.name}
                      </h2>
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-black uppercase text-sky-700 border border-sky-200">
                        {activeCurrencyLabel}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-1">
                      {selectedCustomer.phone ? `${selectedCustomer.phone} • ` : ''}{selectedCustomer.address || 'Bandar Abbas, Iran'}
                    </p>
                  </div>

                  {!isViewer && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleEditClick}
                        className="h-8 px-3 rounded-lg border border-sky-200 bg-white text-xs font-black text-sky-700 shadow-2xs hover:bg-sky-50 inline-flex items-center gap-1.5 transition-all"
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>
                      {isAdmin && (
                        <button
                          onClick={handleDeleteCustomer}
                          className="h-8 px-3 rounded-lg border border-rose-200 bg-rose-50/60 text-xs font-black text-rose-600 shadow-2xs hover:bg-rose-100 inline-flex items-center gap-1.5 transition-all"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {loadingLedger ? (
                  <div className="py-16 flex flex-col items-center justify-center">
                    <Loader2 className="animate-spin text-sky-600 mb-2" size={28} />
                    <p className="text-xs font-bold text-sky-600">Loading ledger statement records...</p>
                  </div>
                ) : (
                  <div>
                    {/* Desktop & Printable Statement Table */}
                    <div className="overflow-x-auto app-scrollbar rounded-xl border border-sky-100 bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#0f243e] text-white text-[10px] font-black uppercase tracking-[0.14em]">
                            <th className="py-3 px-4">DATE</th>
                            <th className="py-3 px-4">RECEIPT NO.</th>
                            <th className="py-3 px-4">DESCRIPTION</th>
                            <th className="py-3 px-4 text-right">DEBIT</th>
                            <th className="py-3 px-4 text-right">CREDIT</th>
                            <th className="py-3 px-4 text-right">BALANCE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sky-100/70 text-xs font-bold text-slate-700">
                          {ledgerRows.map((row, idx) => (
                            <tr
                              key={row.id || idx}
                              className={`transition-colors hover:bg-sky-50/50 ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}
                            >
                              <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap font-bold">{formatDate(row.date)}</td>
                              <td className="py-3.5 px-4 font-black text-slate-900 whitespace-nowrap">
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black">
                                  {row.receipt_no || 'OP'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 min-w-[200px] text-slate-800 font-semibold">{row.description || '-'}</td>
                              <td className="py-3.5 px-4 text-right font-black text-rose-600 whitespace-nowrap">
                                {row.debit ? formatCurrency(row.debit, row.currency || activeCurrencyLabel) : '-'}
                              </td>
                              <td className="py-3.5 px-4 text-right font-black text-emerald-600 whitespace-nowrap">
                                {row.credit ? formatCurrency(row.credit, row.currency || activeCurrencyLabel) : '-'}
                              </td>
                              <td className="py-3.5 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                                {formatCurrency(row.balance, row.currency || activeCurrencyLabel)}
                              </td>
                            </tr>
                          ))}
                          {ledgerRows.length === 0 && (
                            <tr>
                              <td colSpan="6" className="py-12 text-center text-xs font-bold text-slate-400">
                                No transactions found for this customer under {selectedCurrency}.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-300 bg-slate-100/90 text-xs font-black text-slate-900">
                            <td className="py-3.5 px-4 uppercase tracking-wider" colSpan="3">Statement Total</td>
                            <td className="py-3.5 px-4 text-right text-rose-600 whitespace-nowrap">{formatCurrency(totals.debit, activeCurrencyLabel)}</td>
                            <td className="py-3.5 px-4 text-right text-emerald-600 whitespace-nowrap">{formatCurrency(totals.credit, activeCurrencyLabel)}</td>
                            <td className="py-3.5 px-4 text-right text-slate-900 whitespace-nowrap">{formatCurrency(totals.balance, activeCurrencyLabel)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </GlassCard>
            </>
          ) : (
            <GlassCard className="p-12 text-center">
              <Users size={32} className="mx-auto text-sky-300 mb-2" />
              <p className="text-sm font-black text-slate-700">Please select a customer from the directory.</p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Save,
  Printer,
  Download,
  ArrowLeft,
  Loader2,
  FileCheck,
  DollarSign,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Clock3,
  XCircle,
  AlertCircle,
  Hash,
  Users,
  Wallet,
  UserCheck,
  StickyNote,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Plus,
  UserPlus,
  RefreshCw,
  Search,
  Copy,
  Check,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { transactionAPI, bankAPI, customerAPI, settingsAPI } from '../api/client';
import GlassCard from '../components/GlassCard';
import { useTranslation } from 'react-i18next';
import ReceiptDocument from '../components/ReceiptDocument';
import { downloadReceiptPdf, printReceipt, formatHawalaSummary } from '../utils/receiptExport';

const LANDMARK_OPTIONS = [
  { id: '/afghan-blue-mosque.jpg', name: 'Blue Mosque', location: 'Mazar' },
  { id: '/afghan-darul-aman.jpg', name: 'Darul Aman', location: 'Kabul' },
  { id: '/afghan-qala-bost.jpg', name: 'Qala-e-Bost', location: 'Helmand' },
  { id: '/afghan-band-e-amir.jpg', name: 'Band-e-Amir', location: 'Bamyan' },
];

const currencies = ['USD', 'Toman', 'Dirham', 'Afghani'];
const methods = ['Bank Transfer', 'Cash', 'Hawala'];
const defaultForm = {
  receipt_no: '',
  date: new Date().toISOString().slice(0, 10),
  type: 'Received',
  customer_id: '',
  customer_name: '',
  company_name: '',
  subject: '',
  amount: '',
  currency: 'USD',
  equivalent_amount: '',
  equivalent_currency: 'Afghani',
  payment_method: 'Bank Transfer',
  bank_account_id: '',
  receiver_name: '',
  status: 'Completed',
  description: '',
};

export default function AddTransaction() {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState(defaultForm);
  const [banks, setBanks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [previewZoom, setPreviewZoom] = useState(0.42);
  const [showFullscreenModal, setShowFullscreenModal] = useState(false);
  const [previewLanguage, setPreviewLanguage] = useState(i18n.resolvedLanguage || 'en');
  const [previewWatermark, setPreviewWatermark] = useState(
    (typeof window !== 'undefined' && window.localStorage.getItem('sky_receipt_bg')) || '/afghan-blue-mosque.jpg'
  );
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Quick Customer Creation Modal State
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerType, setNewCustomerType] = useState('customer');
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [refreshingReceiptNo, setRefreshingReceiptNo] = useState(false);

  const calculateEquivalent = (amt, fromCurr, toCurr, rate) => {
    const num = parseFloat(amt);
    if (isNaN(num) || num <= 0) return '';
    if (fromCurr === toCurr) return String(num);
    if (rate && !isNaN(parseFloat(rate)) && parseFloat(rate) > 0) {
      return String((num * parseFloat(rate)).toFixed(2));
    }
    const ratesInUSD = {
      USD: 1,
      Afghani: 70.5,
      Dirham: 3.67,
      Toman: 60000,
    };
    const fromUSD = ratesInUSD[fromCurr] || 1;
    const toUSD = ratesInUSD[toCurr] || 1;
    const usdValue = num / fromUSD;
    const converted = usdValue * toUSD;
    return String(converted.toFixed(2));
  };
  
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      if (e.detail) {
        setSettings((prev) => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('sky_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('sky_settings_updated', handleSettingsUpdated);
  }, []);

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearchFilter, setCustomerSearchFilter] = useState('');

  const fetchCustomersList = async () => {
    setLoadingCustomers(true);
    try {
      const res = await customerAPI.list();
      const raw = res.data;
      let cList = [];
      if (Array.isArray(raw)) cList = raw;
      else if (Array.isArray(raw?.data)) cList = raw.data;
      else if (Array.isArray(raw?.customers)) cList = raw.customers;

      setCustomers(cList);
      if (cList.length > 0) {
        setForm((prev) => {
          const existing = cList.find((c) => String(c.id) === String(prev.customer_id));
          if (existing) {
            return { ...prev, customer_name: existing.name };
          }
          return {
            ...prev,
            customer_id: String(cList[0].id),
            customer_name: cList[0].name,
          };
        });
      }
    } catch (err) {
      console.error('Failed to reload customers', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const filteredCustomerOptions = useMemo(() => {
    const query = customerSearchFilter.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((c) =>
      String(c.name || '').toLowerCase().includes(query) ||
      String(c.phone || '').toLowerCase().includes(query) ||
      String(c.entity_type || '').toLowerCase().includes(query)
    );
  }, [customers, customerSearchFilter]);

  useEffect(() => {
    // Initial fetch
    fetchCustomersList();

    // Auto retry after 1.2 seconds if customers list is initially empty
    const retryTimer = setTimeout(() => {
      if (customers.length === 0) {
        fetchCustomersList();
      }
    }, 1200);

    const handleFocus = () => fetchCustomersList();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimeout(retryTimer);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    // Load banks, customers & settings independently so one failure does not block the rest
    const loadPrerequisites = async () => {
      try {
        const [bankRes, customerRes, settingsRes] = await Promise.allSettled([
          bankAPI.list(),
          customerAPI.list(),
          settingsAPI.get(),
        ]);

        if (bankRes.status === 'fulfilled') {
          setBanks(Array.isArray(bankRes.value.data) ? bankRes.value.data : []);
        }

        if (customerRes.status === 'fulfilled') {
          const raw = customerRes.value.data;
          let cList = [];
          if (Array.isArray(raw)) cList = raw;
          else if (Array.isArray(raw?.data)) cList = raw.data;
          else if (Array.isArray(raw?.customers)) cList = raw.customers;

          setCustomers(cList);
          if (cList.length > 0 && !id) {
            setForm((prev) => ({
              ...prev,
              customer_id: prev.customer_id || String(cList[0].id),
              customer_name: prev.customer_name || cList[0].name,
            }));
          }
        }

        if (settingsRes.status === 'fulfilled') {
          setSettings(settingsRes.value.data && typeof settingsRes.value.data === 'object' ? settingsRes.value.data : null);
        }

        // Check if editing
        if (id) {
          const txRes = await transactionAPI.get(id);
          const tx = txRes.data;
          setForm({
            receipt_no: tx.receipt_no || '',
            date: tx.date || new Date().toISOString().slice(0, 10),
            type: tx.type || 'Received',
            customer_id: tx.customer_id ? String(tx.customer_id) : '',
            customer_name: tx.customer_name || '',
            company_name: tx.company_name || '',
            subject: tx.subject || '',
            amount: tx.amount || '',
            currency: tx.currency || 'USD',
            equivalent_amount: tx.equivalent_amount || '',
            equivalent_currency: tx.equivalent_currency || 'Afghani',
            payment_method: tx.payment_method || 'Bank Transfer',
            bank_account_id: tx.bank_account_id || '',
            receiver_name: tx.receiver_name || '',
            status: tx.status || 'Completed',
            description: tx.description || '',
          });
        } else {
          refreshReceiptNo();
        }
      } catch (err) {
        console.error('Failed to load transaction prerequisites', err);
      }
    };
    loadPrerequisites();
  }, [id, location.state]);

  const refreshReceiptNo = async () => {
    setRefreshingReceiptNo(true);
    try {
      const nextRes = await settingsAPI.getNextReceiptNo();
      if (nextRes.data?.receipt_no) {
        setForm((prev) => ({ ...prev, receipt_no: nextRes.data.receipt_no }));
        setRefreshingReceiptNo(false);
        return;
      }
    } catch (err) {
      console.error('Failed to fetch receipt number', err);
    }
    const prefix = (settings?.receipt_prefix !== undefined ? settings.receipt_prefix : 'TX').trim();
    const nextNum = settings?.next_receipt_number || 1;
    const fallbackNo = prefix ? `${prefix}-${String(nextNum).padStart(4, '0')}` : String(nextNum);
    setForm((prev) => ({ ...prev, receipt_no: fallbackNo }));
    setRefreshingReceiptNo(false);
  };

  const handleQuickAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    setCreatingCustomer(true);
    try {
      const res = await customerAPI.create({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || null,
        entity_type: newCustomerType,
      });
      const newCust = res.data;
      setCustomers((prev) => [...prev, newCust]);
      setForm((prev) => ({
        ...prev,
        customer_id: String(newCust.id),
        customer_name: newCust.name,
      }));
      setNewCustomerName('');
      setNewCustomerPhone('');
      setShowCustomerModal(false);
    } catch (err) {
      console.error('Failed to create customer', err);
      alert('Failed to create customer. Ensure the name is unique.');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadingFile(e.target.files[0]);
    }
  };

  const saveTransaction = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    if (!form.customer_id) {
      setErrorMessage('Select a customer before saving the transaction.');
      setLoading(false);
      return null;
    }

    // Sanitize values
    const payload = {
      ...form,
      amount: Number(form.amount || 0),
      equivalent_amount: Number(form.equivalent_amount || 0),
      bank_account_id: form.bank_account_id ? Number(form.bank_account_id) : null,
      customer_id: form.customer_id ? Number(form.customer_id) : null,
    };

    try {
      let savedTx;
      if (id) {
        const res = await transactionAPI.update(id, payload);
        savedTx = res.data;
      } else {
        const res = await transactionAPI.create(payload);
        savedTx = res.data;
      }

      // If there's an attachment to upload
      if (uploadingFile && savedTx.id) {
        await transactionAPI.uploadReceipt(savedTx.id, uploadingFile);
      }

      return savedTx;
    } catch (err) {
      console.error('Failed to save transaction', err);
      const detail = err.response?.data?.detail;
      let msg = 'Failed to save transaction record.';
      if (typeof detail === 'string') msg = detail;
      else if (Array.isArray(detail)) msg = detail.map(e => e.msg || JSON.stringify(e)).join(', ');
      setErrorMessage(msg);
      setLoading(false);
      return null;
    }
  };
  const handleSave = async (e) => {
    const result = await saveTransaction(e);
    if (result) {
      navigate('/transactions');
    }
  };

  const handleSaveAndPrint = async (e) => {
    const result = await saveTransaction(e);
    if (result) {
      setLoading(false);
      const bankAccount = banks.find((bank) => bank.id === Number(result.bank_account_id));
      printReceipt({ transaction: result, bankAccount, settings, language: i18n.resolvedLanguage });
    }
  };

  const handleDownloadPDF = async (e) => {
    const result = await saveTransaction(e);
    if (result) {
      try {
        const bankAccount = banks.find((bank) => bank.id === Number(result.bank_account_id));
        await downloadReceiptPdf({ transaction: result, bankAccount, settings, language: i18n.resolvedLanguage });
      } catch (error) {
        console.error('Failed to generate receipt PDF', error);
        setErrorMessage(error.message || 'Failed to generate receipt PDF.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Find selected bank information for live preview
  const selectedBank = banks.find((b) => b.id === Number(form.bank_account_id));

  // Settings with active live preview watermark
  const effectiveSettings = useMemo(() => ({
    ...settings,
    receipt_background: previewWatermark || settings?.receipt_background || '/afghan-blue-mosque.jpg',
  }), [settings, previewWatermark]);

  const handleCopySummary = async () => {
    try {
      const text = formatHawalaSummary({
        transaction: form,
        bankAccount: selectedBank,
        settings: effectiveSettings,
      });
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2200);
    } catch (err) {
      console.error('Failed to copy summary', err);
    }
  };

  const handleDirectPrintDraft = () => {
    printReceipt({
      transaction: form,
      bankAccount: selectedBank,
      settings: effectiveSettings,
      language: previewLanguage,
    });
  };

  const handleDirectDownloadDraftPDF = async () => {
    try {
      setLoading(true);
      await downloadReceiptPdf({
        transaction: form,
        bankAccount: selectedBank,
        settings: effectiveSettings,
        language: previewLanguage,
      });
    } catch (err) {
      console.error('Failed to download draft PDF', err);
      setErrorMessage(err.message || 'Failed to download receipt PDF.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1560px] space-y-4">
      
      {/* Header bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-white/70 text-sky-700 shadow-sm transition-all hover:bg-sky-50"
          aria-label="Go back"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-black leading-tight text-slate-900 md:text-2xl">
            {id ? 'Edit Transaction Details' : 'Record New Transaction'}
          </h1>
          <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-600/70">
            Input money transaction, Hawala slips, or paid bank statements
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_480px]">
        
        {/* Form panel */}
        <GlassCard className="p-4 md:p-5">
          <form 
            className="transaction-form grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 pb-20 md:pb-0"
            onSubmit={(e) => { e.preventDefault(); handleSave(e); }}
          >
            
            <div className="md:col-span-2 flex items-center gap-2 border-b border-sky-100 pb-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-600"><Hash size={12} /></span>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-sky-800">Transaction Details</h4>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide">
                  Receipt No / Payment No <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => refreshReceiptNo()}
                  disabled={refreshingReceiptNo}
                  className="inline-flex items-center gap-1 text-[10px] font-black text-sky-600 hover:text-sky-800 transition-colors"
                  title="Auto Generate / Refresh Receipt Number"
                >
                  <RefreshCw size={11} className={refreshingReceiptNo ? 'animate-spin' : ''} />
                  <span>{refreshingReceiptNo ? 'Generating...' : 'Auto No'}</span>
                </button>
              </div>
              <input
                type="text"
                name="receipt_no"
                className="w-full px-3.5 py-2 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 text-sm transition-all font-semibold"
                placeholder="Auto-generating..."
                value={form.receipt_no}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="date"
                className="w-full px-3.5 py-2 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 text-sm transition-all font-semibold"
                value={form.date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Transaction Direction
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Transaction direction">
                {[
                  { value: 'Received', label: t('transaction.received_inflow'), icon: ArrowDownLeft, active: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 border-emerald-600' },
                  { value: 'Paid', label: t('transaction.paid_outflow'), icon: ArrowUpRight, active: 'bg-rose-600 text-white shadow-md shadow-rose-600/20 border-rose-600' },
                  { value: 'Import', label: t('transaction.import_payment'), icon: ArrowDownCircle, active: 'bg-sky-600 text-white shadow-md shadow-sky-600/20 border-sky-600' },
                  { value: 'Export', label: t('transaction.export_receipt'), icon: ArrowUpCircle, active: 'bg-amber-600 text-white shadow-md shadow-amber-600/20 border-amber-600' },
                ].map(({ value, label, icon: Icon, active }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, type: value }))}
                    aria-pressed={form.type === value}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-all ${
                      form.type === value ? active : 'border-sky-100 bg-white/40 text-sky-700 hover:bg-sky-50'
                    }`}
                  >
                    <Icon size={13} strokeWidth={2.5} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 mt-1 flex items-center gap-2 border-b border-sky-100 pb-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-600"><Users size={14} /></span>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-sky-800">Party &amp; Purpose</h4>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide">
                    Customer <span className="text-rose-500">*</span>
                  </label>
                  {customers.length > 0 && (
                    <span className="text-[10px] bg-sky-100/80 text-sky-800 px-2 py-0.5 rounded-md font-extrabold border border-sky-200/50">
                      {customers.length} Available
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={fetchCustomersList}
                    disabled={loadingCustomers}
                    className="inline-flex items-center gap-1 text-[10px] font-black text-sky-600 hover:text-sky-800 transition-colors bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100 shadow-2xs"
                    title="Refresh customers from database"
                  >
                    <RefreshCw size={10} className={loadingCustomers ? 'animate-spin' : ''} />
                    <span>{loadingCustomers ? 'Loading...' : 'Refresh'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(true)}
                    className="inline-flex items-center gap-1 text-[10px] font-black text-sky-600 hover:text-sky-800 transition-colors bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100 shadow-2xs"
                  >
                    <UserPlus size={11} />
                    <span>+ Quick Add</span>
                  </button>
                </div>
              </div>

              {customers.length > 3 && (
                <div className="relative mb-1.5">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={customerSearchFilter}
                    onChange={(e) => setCustomerSearchFilter(e.target.value)}
                    placeholder="Search by customer name, phone, or sarafi..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-sky-100 bg-white/50 text-xs text-sky-900 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              )}

              <select
                name="customer_id"
                className="w-full rounded-xl border border-sky-100 bg-white/60 px-3.5 py-2 text-sm font-semibold text-sky-900 transition-all focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                value={form.customer_id}
                onChange={(e) => {
                  const customer = customers.find((item) => String(item.id) === e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    customer_id: e.target.value,
                    customer_name: customer?.name || '',
                  }));
                }}
                required
              >
                <option value="">Select a customer ({filteredCustomerOptions.length})</option>
                {filteredCustomerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.phone ? `(${customer.phone})` : ''} {customer.entity_type && customer.entity_type !== 'customer' ? `[${customer.entity_type}]` : ''}
                  </option>
                ))}
              </select>
              {customers.length === 0 && (
                <div className="mt-1.5 p-2 rounded-xl bg-amber-50/90 border border-amber-200/80 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-amber-800">No customers found.</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={fetchCustomersList}
                      className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 text-[10px] font-bold hover:bg-amber-200 transition-colors"
                    >
                      Retry Load
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomerModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[10px] font-black hover:bg-amber-700 shadow-xs transition-colors"
                    >
                      + Create Customer
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                Company Name
              </label>
              <input
                type="text"
                name="company_name"
                className="w-full px-3.5 py-2 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 text-sm transition-all font-semibold"
                placeholder="Customer company or account name"
                value={form.company_name}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                Subject / Purpose <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="subject"
                className="w-full px-3.5 py-2 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 text-sm transition-all font-semibold"
                placeholder="Hawala settlement, Invoice payment"
                value={form.subject}
                onChange={handleChange}
                required
              />
            </div>

            <div className="md:col-span-2 mt-1 flex items-center gap-2 border-b border-sky-100 pb-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-600"><Wallet size={14} /></span>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-sky-800">Payment Details</h4>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                Amount <span className="text-rose-500">*</span>
              </label>
              <div className="flex overflow-hidden rounded-xl border border-sky-100 bg-white/40 transition-all focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20">
                <div className="flex items-center pl-4 text-sky-400">
                  <DollarSign size={15} strokeWidth={2.5} />
                </div>
                <input
                  type="number"
                  step="any"
                  name="amount"
                  className="w-full min-w-0 flex-1 bg-transparent px-2 py-2 text-sky-900 text-sm font-semibold outline-none"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={handleChange}
                  required
                />
                <select
                  name="currency"
                  className="shrink-0 border-l border-sky-100 bg-sky-50/60 px-2.5 py-2 text-sky-900 font-bold text-xs outline-none"
                  value={form.currency}
                  onChange={handleChange}
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide">
                  Equivalent Amount
                </label>
                {form.amount && (
                  <button
                    type="button"
                    onClick={() => {
                      const calculated = calculateEquivalent(form.amount, form.currency, form.equivalent_currency, customRate);
                      setForm((prev) => ({ ...prev, equivalent_amount: calculated }));
                    }}
                    className="text-[10px] font-extrabold text-sky-600 hover:text-sky-800 bg-sky-100/70 hover:bg-sky-200/70 px-2 py-0.5 rounded-md transition-colors"
                  >
                    ⚡ Auto Convert
                  </button>
                )}
              </div>
              <div className="flex overflow-hidden rounded-xl border border-sky-100 bg-white/40 transition-all focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20">
                <div className="flex items-center pl-4 text-sky-400">
                  <ArrowRightLeft size={15} strokeWidth={2.5} />
                </div>
                <input
                  type="number"
                  step="any"
                  name="equivalent_amount"
                  className="w-full min-w-0 flex-1 bg-transparent px-2 py-2 text-sky-900 text-sm font-semibold outline-none"
                  placeholder="0.00"
                  value={form.equivalent_amount}
                  onChange={handleChange}
                />
                <select
                  name="equivalent_currency"
                  className="shrink-0 border-l border-sky-100 bg-sky-50/60 px-2.5 py-2 text-sky-900 font-bold text-xs outline-none"
                  value={form.equivalent_currency}
                  onChange={handleChange}
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                Payment Method
              </label>
              <select
                name="payment_method"
                className="w-full px-3.5 py-2 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 text-sm transition-all font-semibold"
                value={form.payment_method}
                onChange={handleChange}
              >
                {methods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                Bank Account
              </label>
              <select
                name="bank_account_id"
                className="w-full px-3.5 py-2 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 text-sm transition-all font-semibold"
                value={form.bank_account_id}
                onChange={handleChange}
              >
                <option value="">-- {t('transaction.no_bank_account')} --</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.account_name} ({b.bank_name} - {b.account_number})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 mt-1 flex items-center gap-2 border-b border-sky-100 pb-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-600"><UserCheck size={14} /></span>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-sky-800">Recipient &amp; Status</h4>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                Receiver / Beneficiary Name
              </label>
              <input
                type="text"
                name="receiver_name"
                className="w-full px-3.5 py-2 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 text-sm transition-all font-semibold"
                placeholder="Finance Dept, Cashier office"
                value={form.receiver_name}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Status
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
                {[
                  { value: 'Completed', icon: CheckCircle2, active: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 border-emerald-600' },
                  { value: 'Pending', icon: Clock3, active: 'bg-amber-500 text-white shadow-md shadow-amber-500/20 border-amber-500' },
                  { value: 'Cancelled', icon: XCircle, active: 'bg-rose-600 text-white shadow-md shadow-rose-600/20 border-rose-600' },
                ].map(({ value, icon: Icon, active }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, status: value }))}
                    aria-pressed={form.status === value}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-all ${
                      form.status === value ? active : 'border-sky-100 bg-white/40 text-sky-700 hover:bg-sky-50'
                    }`}
                  >
                    <Icon size={13} strokeWidth={2.5} />
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 mt-1 flex items-center gap-2 border-b border-sky-100 pb-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-600"><StickyNote size={14} /></span>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-sky-800">Notes &amp; Attachments</h4>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                Description / Notes
              </label>
              <textarea
                name="description"
                rows="3"
                className="w-full px-3.5 py-2 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 text-sm transition-all font-semibold"
                placeholder="Add receipt confirmation, exchange rate details, etc."
                value={form.description}
                onChange={handleChange}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                Upload Receipt Slip (PDF/Image)
              </label>
              <div className="mt-1 flex justify-center rounded-2xl border-2 border-dashed border-sky-100 bg-white/30 px-5 pb-4 pt-4">
                <div className="space-y-1 text-center">
                  <div className="flex text-sm text-sky-600 justify-center">
                    <label className="relative cursor-pointer bg-white/40 rounded-md font-bold text-sky-500 hover:text-sky-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-sky-500/20 px-2 py-1 border border-sky-100">
                      <span>{t('transaction.upload_file')}</span>
                      <input
                        type="file"
                        className="sr-only"
                        accept=".pdf,image/*"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-sky-400 font-bold">{t('transaction.upload_desc')}</p>
                  {uploadingFile && (
                    <div className="flex items-center gap-1.5 text-xs text-sky-600 font-bold bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-100/50 mt-3 inline-flex">
                      <FileCheck size={14} className="text-emerald-500" />
                      <span className="truncate max-w-[200px]">{uploadingFile.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="md:col-span-2 flex items-start gap-3 rounded-xl border border-rose-200 border-l-4 border-l-rose-500 bg-rose-50 p-4 text-xs font-semibold leading-relaxed text-rose-700">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="md:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-40 max-md:bg-white/90 max-md:backdrop-blur-xl max-md:border-t max-md:border-sky-100 max-md:px-4 max-md:pt-3 max-md:pb-[calc(12px+env(safe-area-inset-bottom))] max-md:flex-row max-md:gap-2 max-md:shadow-[0_-4px_24px_rgba(15,32,60,0.08)]">
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-sm font-extrabold text-white shadow-lg shadow-sky-500/20 transition-all hover:from-sky-700 hover:to-blue-700 disabled:opacity-50 ios-button-tap"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>
                  <span className="hidden xs:inline">{t('transaction.save_transaction')}</span>
                  <span className="xs:hidden">{t('transaction.save')}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={handleSaveAndPrint}
                disabled={loading}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-sky-100 bg-white/70 text-sm font-extrabold text-sky-800 shadow-md transition-all hover:bg-sky-50 disabled:opacity-50 ios-button-tap"
              >
                <Printer size={16} />
                <span>
                  <span className="hidden xs:inline">{t('transaction.save_and_print')}</span>
                  <span className="xs:hidden">{t('transaction.print')}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={loading}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-sky-100 bg-white/70 text-sm font-extrabold text-sky-800 shadow-md transition-all hover:bg-sky-50 disabled:opacity-50 ios-button-tap"
              >
                <Download size={16} />
                <span>
                  <span className="hidden xs:inline">{t('transaction.download_pdf')}</span>
                  <span className="xs:hidden">{t('transaction.pdf')}</span>
                </span>
              </button>
            </div>

          </form>
        </GlassCard>

        <div className="min-w-0 space-y-3 lg:sticky lg:top-6 lg:self-start">
          {/* Live Preview Header Card */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-sky-100 p-3 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Sparkles size={13} />
                </span>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <span>{t('transaction.live_receipt_preview')}</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
                  </h3>
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    Real-time official document sync
                  </span>
                </div>
              </div>

              {/* Quick Actions (Copy, Print, PDF, Fullscreen) */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className={`p-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                    copiedSummary 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                      : 'border-slate-200 bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700'
                  }`}
                  title="Copy Hawala WhatsApp / SMS Summary"
                >
                  {copiedSummary ? <Check size={13} className="text-white" /> : <Copy size={13} />}
                  <span className="text-[10px] font-black hidden sm:inline">{copiedSummary ? 'Copied!' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectPrintDraft}
                  className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 transition-colors"
                  title="Print Preview Document"
                >
                  <Printer size={13} />
                </button>

                <button
                  type="button"
                  onClick={handleDirectDownloadDraftPDF}
                  className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 transition-colors"
                  title="Download Preview PDF"
                >
                  <Download size={13} />
                </button>

                <button
                  type="button"
                  onClick={() => setShowFullscreenModal(true)}
                  className="p-1.5 rounded-xl bg-sky-600 text-white hover:bg-sky-700 shadow-xs transition-colors ml-0.5"
                  title="Expand Fullscreen"
                >
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>

            {/* Sub-toolbar: Watermark Landmark, Language, and Zoom Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
              
              {/* Landmark Watermark Switcher */}
              <div className="flex items-center gap-1 bg-slate-50/90 p-1 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-500 pl-1 flex items-center gap-1">
                  <ImageIcon size={11} className="text-sky-500" />
                </span>
                <select
                  value={previewWatermark}
                  onChange={(e) => {
                    setPreviewWatermark(e.target.value);
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem('sky_receipt_bg', e.target.value);
                    }
                  }}
                  className="text-[10px] font-bold bg-transparent text-slate-700 outline-none cursor-pointer pr-1"
                  title="Select Afghan Landmark Watermark"
                >
                  {LANDMARK_OPTIONS.map((bg) => (
                    <option key={bg.id} value={bg.id}>
                      {bg.name} ({bg.location})
                    </option>
                  ))}
                </select>
              </div>

              {/* Language Switcher */}
              <div className="flex items-center gap-0.5 bg-slate-50/90 p-0.5 rounded-xl border border-slate-200/80">
                {[
                  { code: 'en', label: 'EN' },
                  { code: 'fa', label: 'دری' },
                  { code: 'ps', label: 'پښتو' },
                ].map(({ code, label }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setPreviewLanguage(code)}
                    className={`px-1.5 py-0.5 rounded-lg text-[10px] font-black transition-all ${
                      previewLanguage === code
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-sky-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-slate-50/90 p-0.5 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setPreviewZoom((z) => Math.max(0.30, parseFloat((z - 0.05).toFixed(2))))}
                  className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-sky-700 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut size={12} />
                </button>
                <span className="text-[10px] font-black text-slate-700 min-w-[30px] text-center">
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewZoom((z) => Math.min(1.2, parseFloat((z + 0.05).toFixed(2))))}
                  className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-sky-700 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn size={12} />
                </button>
                <div className="w-[1px] h-3 bg-slate-300 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setPreviewZoom(0.42)}
                  className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-black transition-all ${
                    previewZoom === 0.42 ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-sky-700'
                  }`}
                  title="Fit 1-Page"
                >
                  Fit
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(0.70)}
                  className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-bold transition-all ${
                    previewZoom === 0.70 ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-sky-700'
                  }`}
                  title="Large 70%"
                >
                  70%
                </button>
              </div>

            </div>
          </div>

          {/* 1-Page Full Receipt View Stage Container */}
          <div className="relative rounded-[24px] bg-gradient-to-br from-slate-100 via-sky-50/40 to-slate-200/50 border border-slate-200/80 p-2.5 flex justify-center items-start shadow-[inset_0_2px_12px_rgba(0,0,0,0.04)] overflow-y-auto max-h-[calc(100vh-140px)] min-h-[480px]">
            <div className="receipt-preview-scroll flex justify-center items-start w-full p-1">
              <div
                style={{
                  width: `${Math.round(733 * previewZoom)}px`,
                  height: `${Math.round(1020 * previewZoom)}px`,
                }}
                className="relative shrink-0 transition-all duration-200 ease-out shadow-2xl rounded-xl border border-slate-300/70 bg-white"
              >
                <div
                  className="transition-transform duration-200"
                  style={{
                    width: '733px',
                    minHeight: '1020px',
                    transform: `scale(${previewZoom})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <ReceiptDocument
                    transaction={form}
                    bankAccount={selectedBank}
                    settings={effectiveSettings}
                    language={previewLanguage}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Full Screen Live Receipt Modal */}
      {showFullscreenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-t-2xl border-b border-slate-800 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="font-black text-sm uppercase tracking-wider text-sky-400">Official Money Receipt Preview</span>
              <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                {form.receipt_no || 'LIVE DRAFT'}
              </span>
              <span className="text-[11px] font-extrabold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-0.5 rounded-full">
                {form.amount ? `${Number(form.amount).toLocaleString('en-US')} ${form.currency}` : '0.00 USD'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Landmark Watermark inside Fullscreen Modal */}
              <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700 text-xs">
                <ImageIcon size={12} className="text-sky-400" />
                <select
                  value={previewWatermark}
                  onChange={(e) => {
                    setPreviewWatermark(e.target.value);
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem('sky_receipt_bg', e.target.value);
                    }
                  }}
                  className="text-[11px] font-bold bg-transparent text-slate-200 outline-none cursor-pointer"
                >
                  {LANDMARK_OPTIONS.map((bg) => (
                    <option key={bg.id} value={bg.id} className="bg-slate-900 text-white">
                      {bg.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Language toggle inside Fullscreen Modal */}
              <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-xl border border-slate-700">
                {[
                  { code: 'en', label: 'EN' },
                  { code: 'fa', label: 'دری' },
                  { code: 'ps', label: 'پښتو' },
                ].map(({ code, label }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setPreviewLanguage(code)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all ${
                      previewLanguage === code
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Copy Hawala Summary */}
              <button
                type="button"
                onClick={handleCopySummary}
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
                onClick={handleDirectPrintDraft}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all"
              >
                <Printer size={14} /> Print
              </button>
              
              <button
                type="button"
                onClick={handleDirectDownloadDraftPDF}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all"
              >
                <Download size={14} /> Download PDF
              </button>
              
              <button
                type="button"
                onClick={() => setShowFullscreenModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors ml-1"
                title="Close Modal"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="w-full max-w-5xl bg-slate-200/90 p-4 sm:p-8 rounded-b-2xl max-h-[85vh] overflow-y-auto flex justify-center shadow-2xl custom-scrollbar">
            <ReceiptDocument
              transaction={form}
              bankAccount={selectedBank}
              settings={effectiveSettings}
              language={previewLanguage}
            />
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-sky-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                  <UserPlus size={16} />
                </span>
                <h3 className="text-base font-black text-slate-900">Add New Customer</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="p-1 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickAddCustomer} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Customer / Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="e.g. Ahmad Shah Trading or John Doe"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="e.g. +93 799 123456"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Entity Type
                </label>
                <select
                  value={newCustomerType}
                  onChange={(e) => setNewCustomerType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                >
                  <option value="customer">Customer / Individual</option>
                  <option value="sarafi">Sarafi / Exchange Market</option>
                  <option value="company">Company / Transport Firm</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCustomer || !newCustomerName.trim()}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creatingCustomer ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Plus size={13} /> Save &amp; Select
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

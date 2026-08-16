import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { transactionAPI, bankAPI, customerAPI, settingsAPI } from '../api/client';
import GlassCard from '../components/GlassCard';
import { useTranslation } from 'react-i18next';
import ReceiptDocument from '../components/ReceiptDocument';
import { downloadReceiptPdf, printReceipt } from '../utils/receiptExport';

const currencies = ['USD', 'Toman', 'Dirham', 'Afghani'];
const methods = ['Bank Transfer', 'Cash', 'Hawala'];
const statuses = ['Completed', 'Pending', 'Cancelled'];
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
    // Load banks & settings
    const loadPrerequisites = async () => {
      try {
        const [bankRes, customerRes, settingsRes] = await Promise.all([
          bankAPI.list(),
          customerAPI.list(),
          settingsAPI.get(),
        ]);
        setBanks(Array.isArray(bankRes.data) ? bankRes.data : []);
        setCustomers(Array.isArray(customerRes.data) ? customerRes.data : []);
        setSettings(settingsRes.data && typeof settingsRes.data === 'object' ? settingsRes.data : null);

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
          try {
            const nextRes = await settingsAPI.getNextReceiptNo(form.currency || 'USD');
            setForm((prev) => ({
              ...prev,
            receipt_no: nextRes.data?.receipt_no || `TX-${Date.now().toString().slice(-6)}`,
            }));
          } catch (nextErr) {
            console.error(nextErr);
            setForm((prev) => ({
              ...prev,
              receipt_no: `TX-${Date.now().toString().slice(-6)}`,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load transaction prerequisites', err);
      }
    };
    loadPrerequisites();
  }, [id, location.state]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Re-fetch receipt number when currency changes (only for new transactions, not editing)
  useEffect(() => {
    if (id || !form.currency) return;
    let cancelled = false;
    const fetchNewReceiptNo = async () => {
      try {
        const nextRes = await settingsAPI.getNextReceiptNo(form.currency);
        if (!cancelled && nextRes.data?.receipt_no) {
          setForm((prev) => ({ ...prev, receipt_no: nextRes.data.receipt_no }));
        }
      } catch (err) {
        console.error('Failed to fetch receipt number for currency', form.currency, err);
      }
    };
    fetchNewReceiptNo();
    return () => { cancelled = true; };
  }, [form.currency, id]);

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
              <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                Receipt No / Payment No <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="receipt_no"
                className="w-full px-3.5 py-2 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 text-sm transition-all font-semibold"
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
              <label className="block text-[11px] font-bold text-sky-900/60 uppercase tracking-wide mb-1">
                Customer <span className="text-rose-500">*</span>
              </label>
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
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
              {customers.length === 0 && (
                <p className="mt-1 text-[10px] font-semibold text-amber-600">No customers are available. Create a customer first.</p>
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

        <div className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <h3 className="pl-1 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500 flex items-center justify-between">
            {t('transaction.live_receipt_preview')}
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
          </h3>
          <div className="relative rounded-[28px] bg-gradient-to-br from-slate-100 to-sky-50/50 border border-white/80 p-4 md:p-5 flex justify-center items-start overflow-hidden shadow-[inset_0_2px_20px_rgba(0,0,0,0.03)] min-h-[380px]">
            <div className="receipt-preview-scroll w-full h-full">
              <ReceiptDocument
                transaction={form}
                bankAccount={selectedBank}
                settings={settings}
                language={i18n.resolvedLanguage}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

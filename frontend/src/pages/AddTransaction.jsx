import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Save, Printer, Download, ArrowLeft, Loader2, FileCheck } from 'lucide-react';
import { transactionAPI, bankAPI, settingsAPI } from '../api/client';
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
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  useEffect(() => {
    // Load banks & settings
    const loadPrerequisites = async () => {
      try {
        const [bankRes, settingsRes] = await Promise.all([
          bankAPI.list(),
          settingsAPI.get(),
        ]);
        setBanks(Array.isArray(bankRes.data) ? bankRes.data : []);
        setSettings(settingsRes.data && typeof settingsRes.data === 'object' ? settingsRes.data : null);

        // Check if editing
        if (id) {
          const txRes = await transactionAPI.get(id);
          const tx = txRes.data;
          setForm({
            receipt_no: tx.receipt_no || '',
            date: tx.date || new Date().toISOString().slice(0, 10),
            type: tx.type || 'Received',
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
        } else if (location.state && location.state.ocrData) {
          // If we redirected from OCR page with extracted fields
          const ocr = location.state.ocrData;
          setForm((prev) => ({
            ...prev,
            ...ocr,
            receipt_no: ocr.receipt_no || prev.receipt_no,
            date: ocr.date || prev.date,
          }));
        } else {
          try {
            const nextRes = await settingsAPI.getNextReceiptNo();
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

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadingFile(e.target.files[0]);
    }
  };

  const saveTransaction = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMessage('');

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
    <div className="mx-auto w-full max-w-[1640px] space-y-5">
      
      {/* Header bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-100 bg-white/70 text-sky-700 shadow-sm transition-all hover:bg-sky-50"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-black leading-tight text-slate-900 md:text-3xl">
            {id ? 'Edit Transaction Details' : 'Record New Transaction'}
          </h1>
          <p className="mt-1 text-[12px] font-bold uppercase tracking-wider text-sky-600/70">
            Input money transaction, Hawala slips, or paid bank statements
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:gap-8 xl:grid-cols-[minmax(0,1fr)_480px] 2xl:grid-cols-[minmax(0,1fr)_560px]">
        
        {/* Form panel */}
        <GlassCard className="p-5 md:p-6">
          <form 
            className="transaction-form grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 pb-20 md:pb-0"
            onSubmit={(e) => { e.preventDefault(); handleSave(e); }}
          >
            
            <div>
              <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Receipt No / Payment No
              </label>
              <input
                type="text"
                name="receipt_no"
                className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
                value={form.receipt_no}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Date
              </label>
              <input
                type="date"
                name="date"
                className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
                value={form.date}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Transaction Direction
              </label>
              <select
                name="type"
                className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
                value={form.type}
                onChange={handleChange}
              >
                <option value="Received">{t('transaction.received_inflow')}</option>
                <option value="Paid">{t('transaction.paid_outflow')}</option>
                <option value="Import">{t('transaction.import_payment')}</option>
                <option value="Export">{t('transaction.export_receipt')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Customer Name
              </label>
              <input
                type="text"
                name="customer_name"
                className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
                placeholder="Ariana Transport, etc."
                value={form.customer_name}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Company Name
              </label>
              <input
                type="text"
                name="company_name"
                className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
                placeholder="Customer company or account name"
                value={form.company_name}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Subject / Purpose
              </label>
              <input
                type="text"
                name="subject"
                className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
                placeholder="Hawala settlement, Invoice payment"
                value={form.subject}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
              <div>
                <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                  Amount
                </label>
                <input
                  type="number"
                  step="any"
                  name="amount"
                  className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                  Currency
                </label>
                <select
                  name="currency"
                  className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
                  value={form.currency}
                  onChange={handleChange}
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
              <div>
                <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                  Equivalent Amount
                </label>
                <input
                  type="number"
                  step="any"
                  name="equivalent_amount"
                  className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
                  placeholder="0.00"
                  value={form.equivalent_amount}
                  onChange={handleChange}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                  Currency
                </label>
                <select
                  name="equivalent_currency"
                  className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
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
              <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Payment Method
              </label>
              <select
                name="payment_method"
                className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
                value={form.payment_method}
                onChange={handleChange}
              >
                {methods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Bank Account
              </label>
              <select
                name="bank_account_id"
                className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
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

            <div>
              <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Receiver / Beneficiary Name
              </label>
              <input
                type="text"
                name="receiver_name"
                className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
                placeholder="Finance Dept, Cashier office"
                value={form.receiver_name}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Status
              </label>
              <select
                name="status"
                className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
                value={form.status}
                onChange={handleChange}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Description / Notes
              </label>
              <textarea
                name="description"
                rows="3"
                className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sky-900 transition-all font-semibold"
                placeholder="Add receipt confirmation, exchange rate details, etc."
                value={form.description}
                onChange={handleChange}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-sky-900/60 uppercase tracking-wide mb-1.5">
                Upload Receipt Slip (PDF/Image)
              </label>
              <div className="mt-1 flex justify-center rounded-2xl border-2 border-dashed border-sky-100 bg-white/30 px-6 pb-5 pt-5">
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
              <div className="md:col-span-2 p-4 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600 leading-relaxed">
                {errorMessage}
              </div>
            )}

            {/* Action buttons */}
            <div className="md:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-40 max-md:bg-white/90 max-md:backdrop-blur-xl max-md:border-t max-md:border-sky-100 max-md:px-4 max-md:pt-3 max-md:pb-[calc(12px+env(safe-area-inset-bottom))] max-md:flex-row max-md:gap-2 max-md:shadow-[0_-4px_24px_rgba(15,32,60,0.08)]">
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-sm font-extrabold text-white shadow-lg shadow-sky-500/20 transition-all hover:from-sky-700 hover:to-blue-700 disabled:opacity-50 ios-button-tap"
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
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-sky-100 bg-white/70 text-sm font-extrabold text-sky-800 shadow-md transition-all hover:bg-sky-50 disabled:opacity-50 ios-button-tap"
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
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-sky-100 bg-white/70 text-sm font-extrabold text-sky-800 shadow-md transition-all hover:bg-sky-50 disabled:opacity-50 ios-button-tap"
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

        <div className="min-w-0 space-y-4">
          <h3 className="pl-1 text-sm font-extrabold uppercase tracking-[0.14em] text-slate-500 flex items-center justify-between">
            {t('transaction.live_receipt_preview')}
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
          </h3>
          <div className="relative rounded-[32px] bg-gradient-to-br from-slate-100 to-sky-50/50 border border-white/80 p-6 md:p-8 flex justify-center items-start overflow-hidden shadow-[inset_0_2px_20px_rgba(0,0,0,0.03)] min-h-[500px]">
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

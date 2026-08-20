import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Calendar,
  FileText,
  User,
  Building,
  Paperclip,
  Download,
  ExternalLink,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  Receipt,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Copy,
  Check,
  Sparkles,
  X,
} from 'lucide-react';
import { transactionAPI, bankAPI, settingsAPI } from '../api/client';
import GlassCard from '../components/GlassCard';
import { formatCurrency } from '../utils/formatters';
import ReceiptDocument from '../components/ReceiptDocument';
import { printReceipt, downloadReceiptPdf, formatHawalaSummary } from '../utils/receiptExport';
import { useTranslation } from 'react-i18next';

const safeFilename = (value) =>
  String(value || 'receipt-attachment')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [transaction, setTransaction] = useState(null);
  const [banks, setBanks] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attachmentObjectUrl, setAttachmentObjectUrl] = useState('');
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState('receipt'); // 'receipt' | 'attachment'
  const [previewZoom, setPreviewZoom] = useState(0.42);
  const [showFullscreenModal, setShowFullscreenModal] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  useEffect(() => {
    const fetchPrerequisites = async () => {
      try {
        setLoading(true);
        const [txRes, bankRes, setRes] = Promise.allSettled([
          transactionAPI.get(id),
          bankAPI.list(),
          settingsAPI.get(),
        ]);

        const [txSettled, bankSettled, setSettled] = await txRes;
        
        if (txSettled.status === 'fulfilled') {
          setTransaction(txSettled.value.data);
          if (txSettled.value.data?.attachment_path) {
            // If attachment exists, user can toggle, default to receipt
          }
        } else {
          setError('Failed to fetch transaction details. Verify the record exists.');
        }

        if (bankSettled.status === 'fulfilled') {
          const rawBanks = bankSettled.value.data;
          setBanks(Array.isArray(rawBanks) ? rawBanks : rawBanks?.data || []);
        }

        if (setSettled.status === 'fulfilled') {
          setSettings(setSettled.value.data);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to fetch transaction details. Verify the record exists.');
      } finally {
        setLoading(false);
      }
    };
    fetchPrerequisites();
  }, [id]);

  useEffect(() => {
    if (!transaction?.attachment_path) {
      setAttachmentObjectUrl('');
      return undefined;
    }

    let objectUrl = '';
    let cancelled = false;
    setAttachmentLoading(true);

    transactionAPI.getAttachmentBlobUrl(transaction.id)
      .then((url) => {
        objectUrl = url;
        if (!cancelled) setAttachmentObjectUrl(url);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setAttachmentObjectUrl('');
      })
      .finally(() => {
        if (!cancelled) setAttachmentLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [transaction]);

  const selectedBank = banks.find((b) => b.id === Number(transaction?.bank_account_id));

  const handleCopySummary = async () => {
    if (!transaction) return;
    try {
      const text = formatHawalaSummary({
        transaction,
        bankAccount: selectedBank,
        settings,
      });
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2200);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handlePrintDocument = () => {
    if (!transaction) return;
    printReceipt({
      transaction,
      bankAccount: selectedBank,
      settings,
      language: i18n.resolvedLanguage,
    });
  };

  const handleDownloadPDF = async () => {
    if (!transaction) return;
    try {
      await downloadReceiptPdf({
        transaction,
        bankAccount: selectedBank,
        settings,
        language: i18n.resolvedLanguage,
      });
    } catch (err) {
      console.error('Failed to download PDF', err);
      alert('Failed to download receipt PDF: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24">
        <GlassCard className="p-12 flex flex-col items-center justify-center space-y-4 max-w-md mx-auto text-center">
          <Loader2 className="animate-spin text-sky-500 mb-2" size={44} />
          <p className="text-sky-700 font-black text-xs uppercase tracking-wider animate-pulse">
            Loading transaction archive...
          </p>
        </GlassCard>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto py-12">
        <GlassCard className="p-8 text-center border-rose-100">
          <div className="text-rose-500 font-black uppercase tracking-wide text-lg mb-3">Error Loading Receipt</div>
          <p className="text-sky-900/70 text-sm mb-6">{error || 'Record not found.'}</p>
          <button
            onClick={() => navigate('/transactions')}
            className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md shadow-sky-500/20 transition-all active:scale-95"
          >
            Back to Archive
          </button>
        </GlassCard>
      </div>
    );
  }

  const isPDF = transaction.attachment_path?.toLowerCase().endsWith('.pdf');
  const attachmentFilename = transaction.attachment_path?.split(/[\\/]/).pop() || `${transaction.receipt_no}-attachment`;

  const handleViewAttachment = async () => {
    if (attachmentObjectUrl) {
      const opened = window.open(attachmentObjectUrl, '_blank');
      if (!opened) alert('Please allow popups to view the receipt attachment.');
      return;
    }

    try {
      await transactionAPI.openAttachment(transaction.id, attachmentFilename);
    } catch (err) {
      console.error(err);
      alert('Failed to open receipt attachment.');
    }
  };

  const handleDownloadAttachment = async () => {
    try {
      await transactionAPI.downloadAttachment(transaction.id, safeFilename(attachmentFilename));
    } catch (err) {
      console.error(err);
      alert('Failed to download receipt attachment.');
    }
  };

  const isInflow = transaction.type === 'Received' || transaction.type === 'Import';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Navigation & Status Header */}
      <div className="flex items-center justify-between border-b border-sky-100/50 pb-4">
        <button
          onClick={() => navigate('/transactions')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-sky-50/80 border border-sky-100 rounded-2xl text-xs font-black uppercase tracking-wider text-sky-700 shadow-xs transition-all hover:scale-[1.01] active:scale-95"
        >
          <ArrowLeft size={16} className="text-sky-600" />
          <span>Back to Archive</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleCopySummary}
            className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              copiedSummary
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white/80 hover:bg-sky-50 text-slate-700 border-sky-100'
            }`}
            title="Copy Hawala WhatsApp Text Summary"
          >
            {copiedSummary ? <Check size={14} /> : <Copy size={14} />}
            <span className="hidden sm:inline">{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintDocument}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            title="Print Official Money Receipt"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Print Receipt</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            title="Download PDF"
          >
            <Download size={14} />
            <span className="hidden sm:inline">PDF</span>
          </button>

          <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-2xs ${
            transaction.status === 'Completed'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
              : transaction.status === 'Pending'
              ? 'bg-amber-50 text-amber-700 border-amber-200/80'
              : 'bg-rose-50 text-rose-700 border-rose-200/80'
          }`}>
            {transaction.status === 'Completed' && <CheckCircle2 size={14} className="text-emerald-600" />}
            {transaction.status === 'Pending' && <Clock size={14} className="text-amber-600" />}
            {transaction.status !== 'Completed' && transaction.status !== 'Pending' && <XCircle size={14} className="text-rose-600" />}
            {transaction.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Transaction Details (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Main Hero Summary Card */}
          <GlassCard className={`p-6 md:p-8 space-y-6 border-l-4 ${isInflow ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-sky-100/60">
              <div className="flex items-center gap-3.5">
                <div className={`p-3 rounded-2xl border ${
                  isInflow 
                    ? 'bg-emerald-50 border-emerald-200/60 text-emerald-600' 
                    : 'bg-rose-50 border-rose-200/60 text-rose-600'
                }`}>
                  {isInflow ? <ArrowDownLeft size={26} /> : <ArrowUpRight size={26} />}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-500 block">Receipt Details</span>
                  <h1 className="text-2xl md:text-3xl font-black text-sky-950 mt-0.5 tracking-tight">{transaction.receipt_no}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-sky-50/60 border border-sky-100/80 rounded-2xl px-3.5 py-2 w-fit">
                <Calendar size={15} className="text-sky-500" />
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-sky-500/80 block">Transaction Date</span>
                  <strong className="text-sky-900 text-xs md:text-sm font-extrabold">{transaction.date}</strong>
                </div>
              </div>
            </div>

            {/* Core Amount Hero Display */}
            <div className={`p-5 md:p-6 rounded-2xl border ${
              isInflow
                ? 'bg-emerald-50/40 border-emerald-200/60'
                : 'bg-rose-50/40 border-rose-200/60'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Principal Amount
                </span>
                <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  isInflow
                    ? 'bg-emerald-100/80 text-emerald-800 border-emerald-300/60'
                    : 'bg-rose-100/80 text-rose-800 border-rose-300/60'
                }`}>
                  {isInflow ? 'Inflow (+)' : 'Outflow (-)'}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <h2 className={`text-3xl md:text-4xl font-black tracking-tight ${
                  isInflow ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {isInflow ? '+' : '-'}{formatCurrency(transaction.amount, transaction.currency)}
                </h2>
              </div>

              {/* Equivalent Amount if present */}
              {Number(transaction.equivalent_amount || 0) > 0 && (
                <div className="mt-3 pt-3 border-t border-sky-100/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    Equivalent Currency
                  </span>
                  <strong className="text-sky-900 font-black text-sm">
                    {formatCurrency(transaction.equivalent_amount, transaction.equivalent_currency)}
                  </strong>
                </div>
              )}
            </div>

            {/* Grid of Key Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Customer */}
              <div className="p-4 bg-sky-50/40 border border-sky-100/50 rounded-2xl transition-all hover:bg-sky-50/70">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-600/80 mb-1">
                  <User size={13} className="text-sky-500" />
                  Customer / Account
                </span>
                <strong className="text-sky-950 text-sm font-extrabold block mt-1">
                  {transaction.customer_name || transaction.customer || '-'}
                </strong>
                {transaction.customer_id && (
                  <span className="text-[11px] text-sky-600/70 font-semibold block mt-1">
                    Customer ID: #{transaction.customer_id}
                  </span>
                )}
              </div>

              {/* Company */}
              <div className="p-4 bg-sky-50/40 border border-sky-100/50 rounded-2xl transition-all hover:bg-sky-50/70">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-600/80 mb-1">
                  <Building size={13} className="text-sky-500" />
                  Company / Organization
                </span>
                <strong className="text-sky-950 text-sm font-extrabold block mt-1">
                  {transaction.company_name || '-'}
                </strong>
              </div>

              {/* Payment Method */}
              <div className="p-4 bg-sky-50/40 border border-sky-100/50 rounded-2xl transition-all hover:bg-sky-50/70">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-600/80 mb-1">
                  <CreditCard size={13} className="text-sky-500" />
                  Payment Method
                </span>
                <strong className="text-sky-950 text-sm font-extrabold block mt-1">
                  {transaction.payment_method || '-'}
                </strong>
              </div>

              {/* Linked Bank */}
              <div className="p-4 bg-sky-50/40 border border-sky-100/50 rounded-2xl transition-all hover:bg-sky-50/70">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-600/80 mb-1">
                  <Building size={13} className="text-sky-500" />
                  Linked Bank
                </span>
                <strong className="text-sky-950 text-sm font-extrabold block mt-1">
                  {selectedBank ? `${selectedBank.bank_name} (${selectedBank.account_name})` : transaction.bank_account_id ? `Bank #${transaction.bank_account_id}` : 'No Account Linked'}
                </strong>
                {selectedBank?.account_number && (
                  <span className="text-[11px] text-sky-600/70 font-semibold block mt-1">
                    Acc: {selectedBank.account_number}
                  </span>
                )}
              </div>

              {/* Subject / Invoice Title */}
              <div className="p-4 bg-sky-50/40 border border-sky-100/50 rounded-2xl transition-all hover:bg-sky-50/70 sm:col-span-2">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-600/80 mb-1">
                  <FileText size={13} className="text-sky-500" />
                  Subject / Invoice Title
                </span>
                <strong className="text-sky-950 text-sm font-extrabold block mt-1">
                  {transaction.subject || '-'}
                </strong>
              </div>

              {/* Receiver / Beneficiary Name */}
              {transaction.receiver_name && (
                <div className="p-4 bg-sky-50/40 border border-sky-100/50 rounded-2xl transition-all hover:bg-sky-50/70 sm:col-span-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-600/80 mb-1">
                    <User size={13} className="text-sky-500" />
                    Receiver / Beneficiary Name
                  </span>
                  <strong className="text-sky-950 text-sm font-extrabold block mt-1">
                    {transaction.receiver_name}
                  </strong>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Description Notes Card */}
          {transaction.description && (
            <GlassCard className="p-6 md:p-8 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-sky-100/60">
                <FileText size={16} className="text-sky-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-sky-800">
                  Description / Office Notes
                </h3>
              </div>
              <div className="p-4 bg-white/60 border border-sky-100/50 rounded-2xl text-xs font-semibold text-sky-950/80 whitespace-pre-line leading-relaxed shadow-xs">
                {transaction.description}
              </div>
            </GlassCard>
          )}

          {/* Audit Banner */}
          <GlassCard className="p-4 flex items-center gap-2.5 bg-emerald-50/40 border-emerald-100 text-emerald-700">
            <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider">
              Audit Logged and Recalculated
            </span>
          </GlassCard>

        </div>

        {/* Right Side: Document Viewer with Tab Switcher (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <GlassCard className="p-5 flex flex-col h-full min-h-[520px]">
            {/* Tab Switcher Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100/60 pb-3 mb-3">
              <div className="flex items-center gap-1 bg-sky-50/80 p-1 rounded-xl border border-sky-100">
                <button
                  type="button"
                  onClick={() => setActiveDocTab('receipt')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    activeDocTab === 'receipt'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-sky-800 hover:bg-white'
                  }`}
                >
                  <Receipt size={13} />
                  <span>Official Receipt</span>
                </button>

                {transaction.attachment_path && (
                  <button
                    type="button"
                    onClick={() => setActiveDocTab('attachment')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                      activeDocTab === 'attachment'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-sky-800 hover:bg-white'
                    }`}
                  >
                    <Paperclip size={13} />
                    <span>Scanned Attachment</span>
                  </button>
                )}
              </div>

              {activeDocTab === 'receipt' ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom((z) => Math.max(0.30, parseFloat((z - 0.05).toFixed(2))))}
                    className="p-1 hover:bg-sky-50 rounded-lg text-slate-600 transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut size={13} />
                  </button>
                  <span className="text-[10px] font-black text-slate-700 min-w-[28px] text-center">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom((z) => Math.min(1.2, parseFloat((z + 0.05).toFixed(2))))}
                    className="p-1 hover:bg-sky-50 rounded-lg text-slate-600 transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFullscreenModal(true)}
                    className="p-1 hover:bg-sky-100 bg-sky-50 text-sky-700 rounded-lg transition-colors ml-0.5"
                    title="Expand Fullscreen"
                  >
                    <Maximize2 size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleViewAttachment}
                    className="px-2.5 py-1 text-sky-600 hover:bg-sky-50 rounded-xl transition-all flex items-center gap-1 text-xs font-black uppercase tracking-wider border border-sky-100"
                    title="Open in new tab"
                  >
                    <ExternalLink size={12} />
                    <span>View</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAttachment}
                    className="px-2.5 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded-xl transition-all flex items-center gap-1 text-xs font-black uppercase tracking-wider shadow-xs"
                    title="Download document"
                  >
                    <Download size={12} />
                    <span>Download</span>
                  </button>
                </div>
              )}
            </div>

            {/* Tab 1: Official Money Receipt Live Preview */}
            {activeDocTab === 'receipt' && (
              <div className="flex-1 rounded-2xl bg-gradient-to-br from-slate-100 via-sky-50/30 to-slate-200/40 border border-slate-200/80 p-2 flex justify-center items-start shadow-[inset_0_2px_12px_rgba(0,0,0,0.03)] overflow-y-auto max-h-[600px] min-h-[460px]">
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
                        transaction={transaction}
                        bankAccount={selectedBank}
                        settings={settings}
                        language={i18n.resolvedLanguage}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Scanned Attachment Viewer */}
            {activeDocTab === 'attachment' && (
              <div className="flex-1">
                {transaction.attachment_path ? (
                  <div className="h-full border border-sky-100 bg-sky-50/10 rounded-2xl overflow-hidden flex items-center justify-center p-2 min-h-[440px]">
                    {attachmentLoading ? (
                      <div className="flex flex-col items-center gap-3 text-sky-500 font-bold text-sm">
                        <Loader2 className="animate-spin text-sky-500" size={28} />
                        <span className="text-xs font-black uppercase tracking-wider">Loading secured attachment...</span>
                      </div>
                    ) : !attachmentObjectUrl ? (
                      <div className="text-center text-sky-500 font-bold text-xs uppercase tracking-wider px-4">
                        Attachment preview is unavailable. Use Download to retry with authentication.
                      </div>
                    ) : isPDF ? (
                      <iframe
                        src={`${attachmentObjectUrl}#toolbar=0`}
                        className="w-full h-full min-h-[440px] border-0 rounded-xl"
                        title="Receipt PDF Preview"
                      />
                    ) : (
                      <img
                        src={attachmentObjectUrl}
                        alt="Receipt Attachment"
                        className="max-w-full max-h-[440px] object-contain rounded-xl shadow-lg border border-sky-100/50"
                      />
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-sky-100 bg-white/20 rounded-2xl p-8 text-center text-sky-400 font-semibold min-h-[400px]">
                    <FileText size={48} className="text-sky-200 mb-3 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-sky-600/80">No scan attachment uploaded</span>
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Full Screen Live Receipt Modal */}
      {showFullscreenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="w-full max-w-5xl flex items-center justify-between bg-slate-900 text-white p-4 rounded-t-2xl border-b border-slate-800 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="font-black text-sm uppercase tracking-wider text-sky-400">Official Money Receipt Document</span>
              <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                {transaction.receipt_no}
              </span>
            </div>
            <div className="flex items-center gap-2">
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
                onClick={handlePrintDocument}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all"
              >
                <Printer size={14} /> Print
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all"
              >
                <Download size={14} /> Download PDF
              </button>
              <button
                type="button"
                onClick={() => setShowFullscreenModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors ml-1"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="w-full max-w-5xl bg-slate-200/90 p-4 sm:p-8 rounded-b-2xl max-h-[85vh] overflow-y-auto flex justify-center shadow-2xl custom-scrollbar">
            <ReceiptDocument
              transaction={transaction}
              bankAccount={selectedBank}
              settings={settings}
              language={i18n.resolvedLanguage}
            />
          </div>
        </div>
      )}
    </div>
  );
}

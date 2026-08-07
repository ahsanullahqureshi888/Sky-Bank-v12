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
} from 'lucide-react';
import { transactionAPI } from '../api/client';
import GlassCard from '../components/GlassCard';
import { formatCurrency } from '../utils/formatters';

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
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attachmentObjectUrl, setAttachmentObjectUrl] = useState('');
  const [attachmentLoading, setAttachmentLoading] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await transactionAPI.get(id);
        setTransaction(res.data);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch transaction details. Verify the record exists.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
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

        <div className="flex items-center gap-3">
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
                <span className={`text-3xl md:text-4xl font-black ${
                  isInflow ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {isInflow ? '+' : '-'}{formatCurrency(transaction.amount, transaction.currency)}
                </span>
              </div>

              {transaction.equivalent_amount > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Equivalent Exchange Amount
                  </span>
                  <strong className="text-sky-900 text-base md:text-lg font-black">
                    {formatCurrency(transaction.equivalent_amount, transaction.equivalent_currency)}
                  </strong>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Breakdown Fields Grid Card */}
          <GlassCard className="p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-sky-100/60">
              <Receipt size={18} className="text-sky-500" />
              <h2 className="text-xs font-black uppercase tracking-wider text-sky-800">
                Transaction Breakdown
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Entry Type */}
              <div className="p-4 bg-sky-50/40 border border-sky-100/50 rounded-2xl transition-all hover:bg-sky-50/70">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-600/80 mb-1">
                  {isInflow ? <ArrowDownLeft size={13} className="text-emerald-500" /> : <ArrowUpRight size={13} className="text-rose-500" />}
                  Entry Type
                </span>
                <strong className={`text-sm font-extrabold block mt-1 ${
                  isInflow ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {transaction.type === 'Received' ? 'Money Received' : transaction.type === 'Paid' ? 'Money Paid' : transaction.type}
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

              {/* Customer Account */}
              <div className="p-4 bg-sky-50/40 border border-sky-100/50 rounded-2xl transition-all hover:bg-sky-50/70">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-600/80 mb-1">
                  <User size={13} className="text-sky-500" />
                  Customer Account
                </span>
                <strong className="text-sky-950 text-sm font-extrabold block mt-1">
                  {transaction.customer_name || '-'}
                </strong>
                {transaction.company_name && (
                  <span className="text-[11px] text-sky-600/70 font-semibold block mt-1">
                    Company: {transaction.company_name}
                  </span>
                )}
              </div>

              {/* Bank Ledger Account */}
              <div className="p-4 bg-sky-50/40 border border-sky-100/50 rounded-2xl transition-all hover:bg-sky-50/70">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-600/80 mb-1">
                  <Building size={13} className="text-sky-500" />
                  Bank Ledger Account
                </span>
                <strong className="text-sky-950 text-sm font-extrabold block mt-1">
                  {transaction.bank_account_id ? 'Linked Bank Account' : 'No Account Linked'}
                </strong>
                {transaction.bank_account_id && (
                  <span className="text-[11px] text-sky-600/70 font-semibold block mt-1">
                    Account ID: {transaction.bank_account_id}
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

        {/* Right Side: Document Viewer (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <GlassCard className="p-6 flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between border-b border-sky-100/60 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Paperclip size={18} className="text-sky-500" />
                <h2 className="text-xs font-black uppercase tracking-wider text-sky-800">Receipt Attachment</h2>
              </div>
              
              {transaction.attachment_path && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleViewAttachment}
                    className="px-3 py-1.5 text-sky-600 hover:bg-sky-50 rounded-xl transition-all flex items-center gap-1.5 text-xs font-black uppercase tracking-wider border border-sky-100"
                    title="Open in new tab"
                  >
                    <ExternalLink size={13} />
                    <span>View</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAttachment}
                    className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl transition-all flex items-center gap-1.5 text-xs font-black uppercase tracking-wider shadow-sm shadow-sky-500/20 active:scale-95"
                    title="Download document"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>
                </div>
              )}
            </div>

            {transaction.attachment_path ? (
              <div className="flex-1 border border-sky-100 bg-sky-50/10 rounded-2xl overflow-hidden flex items-center justify-center p-2 min-h-[400px]">
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
                    className="w-full h-full min-h-[450px] border-0 rounded-xl"
                    title="Receipt PDF Preview"
                  />
                ) : (
                  <img
                    src={attachmentObjectUrl}
                    alt="Receipt Attachment"
                    className="max-w-full max-h-[450px] object-contain rounded-xl shadow-lg border border-sky-100/50"
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-sky-100 bg-white/20 rounded-2xl p-8 text-center text-sky-400 font-semibold min-h-[400px]">
                <FileText size={48} className="text-sky-200 mb-3 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-sky-600/80">No scan attachment uploaded</span>
                <p className="text-[10px] text-sky-500/60 max-w-[200px] font-medium mt-1">
                  You can upload files using the edit button in the Archive menu.
                </p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

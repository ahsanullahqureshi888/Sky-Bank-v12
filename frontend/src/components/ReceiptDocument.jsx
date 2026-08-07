import React, { useEffect } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Clock3,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import i18n from '../i18n';
import { useReceiptStyles } from '../hooks/useReceiptStyles';

const TYPE_BADGES = {
  Received: { icon: ArrowDownLeft, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', label: 'RECEIVED' },
  Paid: { icon: ArrowUpRight, color: '#e11d48', bg: '#fff1f2', border: '#fecdd3', label: 'PAID' },
  Import: { icon: ArrowDownCircle, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'IMPORT' },
  Export: { icon: ArrowUpCircle, color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'EXPORT' },
};

// Money direction is a separate concern from transaction "type" branding above (which uses 4
// distinct colors to differentiate Received/Paid/Import/Export). For the headline amount, we
// always want a single unambiguous 2-color signal - green in, rose out - matching the same
// convention used across the rest of the app (Transaction Detail, Ledger tables).
const INFLOW_TYPES = new Set(['Received', 'Import']);
const isInflowType = (type) => INFLOW_TYPES.has(type);
const DIRECTION_COLORS = {
  in: { color: '#059669', icon: ArrowDownLeft },
  out: { color: '#e11d48', icon: ArrowUpRight },
};

const STATUS_BADGES = {
  Completed: { icon: CheckCircle2, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  Pending: { icon: Clock3, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  Cancelled: { icon: XCircle, color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
};

const CURRENCY_SEALS = {
  USD: { color: '#059669', bg: '#ecfdf5', symbol: '$' },
  Toman: { color: '#2563eb', bg: '#eff6ff', symbol: 'T' },
  Dirham: { color: '#7c3aed', bg: '#f5f3ff', symbol: 'Dhs' },
  Afghani: { color: '#d97706', bg: '#fffbeb', symbol: 'Afs' },
};

const FALLBACK_LOGO = '/sky-bbb-logo.png';
const DEFAULT_COMPANY = 'Sky Ariana Limited';
const DEFAULT_SUBTITLE = 'Money Transaction & Hawala Receipt Management System';

const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';

const safeText = (value, fallback = '—') => {
  if (!hasValue(value)) return fallback;
  if (typeof value === 'object') return fallback;
  return String(value);
};

const formatReceiptAmount = (value) => {
  if (!hasValue(value)) return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  
  const hasDecimals = amount % 1 !== 0;
  
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  });
};

const formatReceiptDate = (value) => {
  if (!hasValue(value)) return '—';
  const text = String(value).slice(0, 10);
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) return safeText(value);
  
  const gregorian = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  const persian = new Intl.DateTimeFormat('fa-AF', {
    calendar: 'persian',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  return (
    <div className="flex flex-col text-right">
      <span className="text-[14px] font-bold">{gregorian}</span>
      <span className="text-[16px] text-sky-700 font-black mt-1" dir="rtl">{persian}</span>
    </div>
  );
};

const getLogoUrl = (settings) => {
  const candidate = settings?.logo_url || settings?.logo_path;
  if (typeof candidate === 'string' && /^(data:|blob:|https?:\/\/)/i.test(candidate)) {
    return candidate;
  }
  if (typeof candidate === 'string' && /^\/(api|uploads|assets)\//i.test(candidate)) {
    return new URL(candidate, window.location.origin).href;
  }
  return new URL(FALLBACK_LOGO, window.location.origin).href;
};

function ReceiptLabel({ labelKey, tEn, tSecondary, className = '' }) {
  return (
    <span className={`receipt-label-stack ${className}`}>
      <span>{tEn(labelKey, { defaultValue: labelKey.split('.').pop() })}</span>
      <span dir="rtl" lang={tSecondary.language || 'fa'}>
        {tSecondary(labelKey, { defaultValue: tEn(labelKey) })}
      </span>
    </span>
  );
}

function DetailRow({ labelKey, value, tEn, tSecondary }) {
  return (
    <div className="receipt-detail-row">
      <dt><ReceiptLabel labelKey={labelKey} tEn={tEn} tSecondary={tSecondary} /></dt>
      <dd dir="auto">{safeText(value)}</dd>
    </div>
  );
}

function SignatureBox({ labelKey, helperKey, stamp = false, defaultName, tEn, tSecondary }) {
  return (
    <div className="receipt-signature-box">
      {stamp ? (
        <div className="receipt-stamp-mark">
          <ReceiptLabel labelKey={labelKey} tEn={tEn} tSecondary={tSecondary} />
        </div>
      ) : (
        <div className="receipt-signature-space">
          {defaultName && <span className="receipt-signature-name">{defaultName}</span>}
        </div>
      )}
      <ReceiptLabel labelKey={labelKey} tEn={tEn} tSecondary={tSecondary} />
      <span className="receipt-signature-helper">{tEn(helperKey)}</span>
    </div>
  );
}

function TypeBadge({ type }) {
  const config = TYPE_BADGES[type] || TYPE_BADGES.Received;
  const Icon = config.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '1mm',
      padding: '1.5mm 3mm', borderRadius: '6px', fontSize: '8pt', fontWeight: 900,
      letterSpacing: '0.08em', color: config.color, background: config.bg,
      border: `1px solid ${config.border}`, textTransform: 'uppercase',
    }}>
      <Icon size={11} strokeWidth={2.5} />
      {config.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const config = STATUS_BADGES[status] || STATUS_BADGES.Pending;
  const Icon = config.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '1mm',
      padding: '1mm 2.5mm', borderRadius: '5px', fontSize: '7.5pt', fontWeight: 900,
      letterSpacing: '0.05em', color: config.color, background: config.bg,
      border: `1px solid ${config.border}`,
    }}>
      <Icon size={10} strokeWidth={2.5} />
      {status}
    </span>
  );
}

function CurrencySeal({ currency }) {
  const config = CURRENCY_SEALS[currency] || { color: '#0f2a4a', bg: '#f1f5f9', symbol: currency?.slice(0, 2) || '?' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '14mm', height: '14mm', borderRadius: '50%',
      fontSize: '12pt', fontWeight: 900, color: config.color,
      background: config.bg, border: `2px solid ${config.color}`,
      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
      flexShrink: 0,
    }}>
      {config.symbol}
    </span>
  );
}

function DirectionIcon({ inflow }) {
  const { color, icon: Icon } = inflow ? DIRECTION_COLORS.in : DIRECTION_COLORS.out;
  return <Icon size={14} strokeWidth={3} color={color} style={{ flexShrink: 0 }} />;
}

function ReceiptNumberBar({ receiptNo }) {
  if (!receiptNo || receiptNo === '—') return null;
  const digits = receiptNo.replace(/[^0-9]/g, '');
  const letters = receiptNo.replace(/[^A-Za-z]/g, '');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '1.5mm',
      fontFamily: '"Courier New", monospace',
    }}>
      <span style={{ fontSize: '7pt', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {letters}
      </span>
      <span style={{ fontSize: '10pt', fontWeight: 900, color: '#0f2a4a', letterSpacing: '0.15em' }}>
        {digits}
      </span>
    </div>
  );
}

export default function ReceiptDocument({
  transaction = {},
  bankAccount = null,
  settings = null,
  language = i18n.resolvedLanguage || i18n.language || 'en',
}) {
  // Dynamically load receipt print styles on demand
  useReceiptStyles();
  
  const secondaryLanguage = String(language).toLowerCase().startsWith('ps') ? 'ps' : 'fa';
  const tEn = i18n.getFixedT('en');
  const tSecondary = i18n.getFixedT(secondaryLanguage);
  tSecondary.language = secondaryLanguage;

  const companyName = DEFAULT_COMPANY;
  const companySubtitle = DEFAULT_SUBTITLE;
  const receiptNo = safeText(transaction.receipt_no);
  const equivalent = Number(transaction.equivalent_amount || 0) > 0
    ? (
        <>
          {formatReceiptAmount(transaction.equivalent_amount)}{' '}
          <span className="receipt-currency text-slate-500 font-bold ml-0.5 text-[0.8em]">{safeText(transaction.equivalent_currency, '')}</span>
        </>
      )
    : '—';
  const bankLabel = bankAccount
    ? [bankAccount.account_name, bankAccount.bank_name, bankAccount.account_number]
        .filter(hasValue)
        .join(' - ')
    : safeText(transaction.bank_account_name || transaction.bank_account, tEn('receipt.no_bank_account'));

  return (
    <article id="receipt-print-area" className="receipt-sheet relative overflow-hidden" aria-label={tEn('receipt.document_title')}>
      <div className="receipt-watermark" aria-hidden="true">
        <img src={getLogoUrl(settings)} alt="" crossOrigin="anonymous" />
      </div>
      <header className="receipt-brand-header">
        <div className="receipt-brand-rule" />
        <div className="receipt-brand-content">
          <div className="receipt-brand-identity">
            <div className="receipt-logo-shell">
              <img
                src={getLogoUrl(settings)}
                alt={companyName}
                crossOrigin="anonymous"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                  event.currentTarget.nextElementSibling.hidden = false;
                }}
              />
              <span className="receipt-logo-fallback" hidden>SA</span>
            </div>
            <div>
              <h1>{companyName}</h1>
              <p>{companySubtitle}</p>
            </div>
          </div>

          <dl className="receipt-meta-card">
            <div><dt><ReceiptLabel labelKey="receipt.receipt_no" tEn={tEn} tSecondary={tSecondary} /></dt><dd><ReceiptNumberBar receiptNo={receiptNo} /></dd></div>
            <div><dt><ReceiptLabel labelKey="receipt.date" tEn={tEn} tSecondary={tSecondary} /></dt><dd>{formatReceiptDate(transaction.date)}</dd></div>
            <div><dt><ReceiptLabel labelKey="receipt.status" tEn={tEn} tSecondary={tSecondary} /></dt><dd className="receipt-status-value"><StatusBadge status={safeText(transaction.status)} /></dd></div>
          </dl>
        </div>
      </header>

      <section className="receipt-title-band">
        <h2>{tEn('receipt.document_title')}</h2>
        <p dir="rtl" lang="fa">{i18n.getFixedT('fa')('receipt.document_title')}</p>
        <p dir="rtl" lang="ps">{i18n.getFixedT('ps')('receipt.document_title')}</p>
        <div>{tEn('receipt.document_subtitle')}</div>
        <small dir="rtl" lang="fa">{i18n.getFixedT('fa')('receipt.document_subtitle')}</small>
        <small dir="rtl" lang="ps">{i18n.getFixedT('ps')('receipt.document_subtitle')}</small>
      </section>

      <section className="receipt-summary-grid" aria-label={tEn('receipt.transaction_summary')}>
        <div className="receipt-summary-main receipt-summary-amount">
          <ReceiptLabel labelKey="receipt.amount" tEn={tEn} tSecondary={tSecondary} />
          <div className="receipt-amount-display" style={{ display: 'flex', alignItems: 'center', gap: '2mm', marginTop: '2mm' }}>
            <CurrencySeal currency={safeText(transaction.currency, '')} />
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '1mm' }}>
              <DirectionIcon inflow={isInflowType(transaction.type)} />
              <strong style={{ fontSize: '15pt', color: isInflowType(transaction.type) ? DIRECTION_COLORS.in.color : DIRECTION_COLORS.out.color }}>
                {isInflowType(transaction.type) ? '+' : '-'}{formatReceiptAmount(transaction.amount)}
              </strong>
            </span>
            <span className="receipt-currency text-sky-700/70 font-bold ml-1 text-[0.75em] tracking-wide">{safeText(transaction.currency, '')}</span>
          </div>
          {transaction.type && <div style={{ marginTop: '2mm' }}><TypeBadge type={transaction.type} /></div>}
        </div>
        <div>
          <ReceiptLabel labelKey="receipt.equivalent" tEn={tEn} tSecondary={tSecondary} />
          <strong>{equivalent}</strong>
        </div>
        <div>
          <ReceiptLabel labelKey="receipt.payment_method" tEn={tEn} tSecondary={tSecondary} />
          <strong>{safeText(transaction.payment_method)}</strong>
        </div>
        <div>
          <ReceiptLabel labelKey="receipt.status" tEn={tEn} tSecondary={tSecondary} />
          <strong className="receipt-status-cell"><StatusBadge status={safeText(transaction.status)} /></strong>
        </div>
      </section>

      <section className="receipt-section">
        <div className="receipt-section-heading receipt-section-heading-dark">
          <ReceiptLabel labelKey="receipt.party_details" tEn={tEn} tSecondary={tSecondary} />
        </div>
        <dl>
          <DetailRow labelKey="receipt.customer" value={transaction.customer_name} tEn={tEn} tSecondary={tSecondary} />
          <DetailRow labelKey="receipt.company" value={transaction.company_name} tEn={tEn} tSecondary={tSecondary} />
          <DetailRow labelKey="receipt.subject" value={transaction.subject} tEn={tEn} tSecondary={tSecondary} />
          {transaction.type && (
            <DetailRow labelKey="receipt.type" value={transaction.type.toUpperCase()} tEn={tEn} tSecondary={tSecondary} />
          )}
          <DetailRow labelKey="receipt.receiver" value={transaction.receiver_name} tEn={tEn} tSecondary={tSecondary} />
        </dl>
      </section>

      <section className="receipt-section">
        <div className="receipt-section-heading">
          <ReceiptLabel labelKey="receipt.payment_information" tEn={tEn} tSecondary={tSecondary} />
        </div>
        <dl>
          <DetailRow labelKey="receipt.payment_method" value={transaction.payment_method} tEn={tEn} tSecondary={tSecondary} />
          <DetailRow labelKey="receipt.bank_account" value={bankLabel} tEn={tEn} tSecondary={tSecondary} />
          <DetailRow labelKey="receipt.currency" value={transaction.currency} tEn={tEn} tSecondary={tSecondary} />
          {Number(transaction.equivalent_amount || 0) > 0 && (
            <DetailRow labelKey="receipt.equivalent_currency" value={transaction.equivalent_currency} tEn={tEn} tSecondary={tSecondary} />
          )}
        </dl>
      </section>

      <section className="receipt-notes-box">
        <ReceiptLabel labelKey="receipt.description_notes" tEn={tEn} tSecondary={tSecondary} />
        <p dir="auto">{safeText(transaction.description, tEn('receipt.no_description'))}</p>
      </section>

      <section className="receipt-authorization">
        <div className="receipt-authorization-title">
          <ReceiptLabel labelKey="receipt.authorization" tEn={tEn} tSecondary={tSecondary} />
          {transaction.status === 'Completed' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1mm', marginLeft: '3mm', fontSize: '7.5pt', fontWeight: 900, color: '#059669' }}>
              <ShieldCheck size={12} strokeWidth={2.5} />
              VERIFIED
            </span>
          )}
        </div>
        <div className="receipt-signature-grid">
          <SignatureBox labelKey="receipt.authorized_signature" helperKey="receipt.date_line" defaultName="Ahsanullah Qureshi" tEn={tEn} tSecondary={tSecondary} />
          <SignatureBox labelKey="receipt.company_stamp" helperKey="receipt.official_seal" stamp tEn={tEn} tSecondary={tSecondary} />
        </div>
      </section>

      <footer className="receipt-document-footer">
        <p>{tEn('receipt.system_note')}</p>
        <p dir="rtl" lang="fa">{i18n.getFixedT('fa')('receipt.system_note')}</p>
        <p dir="rtl" lang="ps">{i18n.getFixedT('ps')('receipt.system_note')}</p>
        <div>
          <span>{tEn('receipt.generated_by', { company: companyName })}</span>
          <span>{tEn('receipt.page_one')}</span>
        </div>
      </footer>
    </article>
  );
}

export { formatReceiptAmount, formatReceiptDate, safeText };

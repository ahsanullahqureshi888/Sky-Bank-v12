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
  Received: { icon: ArrowDownLeft, className: 'receipt-type-received', label: 'RECEIVED' },
  Paid: { icon: ArrowUpRight, className: 'receipt-type-paid', label: 'PAID' },
  Import: { icon: ArrowDownCircle, className: 'receipt-type-import', label: 'IMPORT' },
  Export: { icon: ArrowUpCircle, className: 'receipt-type-export', label: 'EXPORT' },
};

// Money direction is a separate concern from transaction "type" branding above (which uses 4
// distinct colors to differentiate Received/Paid/Import/Export). For the headline amount, we
// always want a single unambiguous 2-color signal - green in, rose out - matching the same
// convention used across the rest of the app (Transaction Detail, Ledger tables).
const INFLOW_TYPES = new Set(['Received', 'Import']);
const isInflowType = (type) => INFLOW_TYPES.has(type);
const DIRECTION_ICONS = {
  in: ArrowDownLeft,
  out: ArrowUpRight,
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
        <>
          <div className="receipt-signature-space">
            {defaultName && <span className="receipt-signature-name">{defaultName}</span>}
          </div>
          <ReceiptLabel labelKey={labelKey} tEn={tEn} tSecondary={tSecondary} />
        </>
      )}
      <span className="receipt-signature-helper">{tEn(helperKey)}</span>
    </div>
  );
}

function TypeBadge({ type }) {
  const config = TYPE_BADGES[type] || TYPE_BADGES.Received;
  const Icon = config.icon;
  return (
    <span className={`receipt-type-badge ${config.className}`}>
      <Icon size={11} strokeWidth={2.5} />
      {config.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const config = {
    Completed: { icon: CheckCircle2, className: 'receipt-status-completed' },
    Pending: { icon: Clock3, className: 'receipt-status-pending' },
    Cancelled: { icon: XCircle, className: 'receipt-status-cancelled' },
  }[status] || { icon: Clock3, className: 'receipt-status-pending' };
  const Icon = config.icon;
  return (
    <span className={`receipt-status-badge ${config.className}`}>
      <Icon size={11} strokeWidth={2.5} className="shrink-0" />
      <span className="whitespace-nowrap">{status ? String(status).toUpperCase() : 'COMPLETED'}</span>
    </span>
  );
}

function CurrencySeal({ currency }) {
  const sealClass = {
    USD: 'receipt-currency-usd',
    Toman: 'receipt-currency-toman',
    Dirham: 'receipt-currency-dirham',
    Afghani: 'receipt-currency-afghani',
  }[currency] || 'receipt-currency-default';
  const symbol = { USD: '$', Toman: 'T', Dirham: 'Dhs', Afghani: 'Afs' }[currency] || currency?.slice(0, 2) || '?';
  return <span className={`receipt-currency-seal ${sealClass}`}>{symbol}</span>;
}

function DirectionIcon({ inflow }) {
  const Icon = inflow ? DIRECTION_ICONS.in : DIRECTION_ICONS.out;
  return <Icon className={`receipt-direction-icon ${inflow ? 'receipt-direction-in' : 'receipt-direction-out'}`} size={14} strokeWidth={3} />;
}

function ReceiptNumberBar({ receiptNo }) {
  if (!receiptNo || receiptNo === '—') return null;
  const digits = receiptNo.replace(/[^0-9]/g, '');
  const letters = receiptNo.replace(/[^A-Za-z]/g, '');
  return (
    <div className="receipt-number-bar">
      <span className="receipt-number-prefix">{letters}</span>
      <span className="receipt-number-digits">{digits}</span>
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
      {/* Inner Security Micro-Guilloche Frame */}
      <div className="receipt-security-frame" aria-hidden="true" />

      {/* Afghan Banknote Landmark Security Watermark Layer */}
      <div className="receipt-landmark-bg" aria-hidden="true">
        <img
          src={settings?.receipt_background || (typeof window !== 'undefined' && window.localStorage.getItem('sky_receipt_bg')) || '/afghan-blue-mosque.jpg'}
          alt=""
          onError={(e) => {
            if (!e.target.src.endsWith('/afghan-blue-mosque.jpg')) {
              e.target.src = '/afghan-blue-mosque.jpg';
            }
          }}
        />
      </div>
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
          <div className={`receipt-amount-display ${isInflowType(transaction.type) ? 'receipt-amount-in' : 'receipt-amount-out'}`}>
            <CurrencySeal currency={safeText(transaction.currency, '')} />
            <span className="receipt-amount-value">
              <DirectionIcon inflow={isInflowType(transaction.type)} />
              <strong>{isInflowType(transaction.type) ? '+' : '-'}{formatReceiptAmount(transaction.amount)}</strong>
            </span>
            <span className="receipt-currency">{safeText(transaction.currency, '')}</span>
          </div>
          {transaction.type && <div className="receipt-type-badge-wrap"><TypeBadge type={transaction.type} /></div>}
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
            <span className="receipt-verified-badge">
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

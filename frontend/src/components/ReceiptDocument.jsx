import React from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Clock3,
  XCircle,
  ShieldCheck,
  Building2,
  User,
  CreditCard,
  FileText,
  Phone,
  Mail,
  MapPin,
  Landmark,
} from 'lucide-react';
import i18n from '../i18n';
import { useReceiptStyles } from '../hooks/useReceiptStyles';

const TYPE_BADGES = {
  Received: { icon: ArrowDownLeft, className: 'receipt-type-received', label: 'RECEIVED' },
  Paid: { icon: ArrowUpRight, className: 'receipt-type-paid', label: 'PAID' },
  Import: { icon: ArrowDownCircle, className: 'receipt-type-import', label: 'IMPORT' },
  Export: { icon: ArrowUpCircle, className: 'receipt-type-export', label: 'EXPORT' },
};

const INFLOW_TYPES = new Set(['Received', 'Import']);
const isInflowType = (type) => INFLOW_TYPES.has(type);
const DIRECTION_ICONS = {
  in: ArrowDownLeft,
  out: ArrowUpRight,
};

const FALLBACK_LOGO = '/logo.png';
const DEFAULT_COMPANY = 'SKY ARIANA GROUP OF COMPANIES';
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
  
  const gregorian = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
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
      <span className="text-[12px] font-bold text-slate-800 tracking-tight">{gregorian}</span>
      <span className="text-[13px] text-sky-800 font-black mt-0.5" dir="rtl">{persian}</span>
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
      <span dir="rtl" lang={tSecondary?.language || 'fa'}>
        {tSecondary ? tSecondary(labelKey, { defaultValue: tEn(labelKey) }) : ''}
      </span>
    </span>
  );
}

function DetailRow({ labelKey, value, tEn, tSecondary, icon: Icon }) {
  return (
    <div className="receipt-detail-row">
      <dt>
        <div className="flex items-center gap-1.5">
          {Icon && <Icon size={11} className="text-sky-500 shrink-0 opacity-80" />}
          <ReceiptLabel labelKey={labelKey} tEn={tEn} tSecondary={tSecondary} />
        </div>
      </dt>
      <dd dir="auto">{safeText(value)}</dd>
    </div>
  );
}

function SignatureBox({ labelKey, helperKey, defaultName, tEn, tSecondary }) {
  return (
    <div className="receipt-signature-box">
      <div className="receipt-signature-space">
        {defaultName && <span className="receipt-signature-name">{defaultName}</span>}
      </div>
      <ReceiptLabel labelKey={labelKey} tEn={tEn} tSecondary={tSecondary} />
      <span className="receipt-signature-helper">{tEn(helperKey)}</span>
    </div>
  );
}

function TypeBadge({ type }) {
  const config = TYPE_BADGES[type] || TYPE_BADGES.Received;
  const Icon = config.icon;
  return (
    <span className={`receipt-type-badge ${config.className}`}>
      <Icon size={10} strokeWidth={2.5} />
      {config.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const config = {
    Completed: { icon: CheckCircle2, className: 'receipt-status-completed' },
    Pending: { icon: Clock3, className: 'receipt-status-pending' },
    Cancelled: { icon: XCircle, className: 'receipt-status-cancelled' },
  }[status] || { icon: CheckCircle2, className: 'receipt-status-completed' };
  const Icon = config.icon;
  return (
    <span className={`receipt-status-badge ${config.className}`}>
      <Icon size={10} strokeWidth={2.5} className="shrink-0" />
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
  const symbol = { USD: '$', Toman: 'T', Dirham: 'Dhs', Afghani: '؋' }[currency] || currency?.slice(0, 2) || '$';
  return <span className={`receipt-currency-seal ${sealClass}`}>{symbol}</span>;
}

function DirectionIcon({ inflow }) {
  const Icon = inflow ? DIRECTION_ICONS.in : DIRECTION_ICONS.out;
  return <Icon className={`receipt-direction-icon ${inflow ? 'receipt-direction-in' : 'receipt-direction-out'}`} size={13} strokeWidth={3} />;
}

function ReceiptNumberBar({ receiptNo }) {
  if (!receiptNo || receiptNo === '—') return <span className="font-mono text-xs font-bold text-slate-400">DRAFT-TX</span>;
  const digits = receiptNo.replace(/[^0-9]/g, '');
  const letters = receiptNo.replace(/[^A-Za-z]/g, '');
  return (
    <div className="receipt-number-bar">
      {letters && <span className="receipt-number-prefix">{letters}</span>}
      <span className="receipt-number-digits">{digits || receiptNo}</span>
    </div>
  );
}

export default function ReceiptDocument({
  transaction = {},
  bankAccount = null,
  settings = null,
  language = i18n.resolvedLanguage || i18n.language || 'en',
}) {
  useReceiptStyles();
  
  const secondaryLanguage = String(language).toLowerCase().startsWith('ps') ? 'ps' : 'fa';
  const tEn = i18n.getFixedT('en');
  const tSecondary = i18n.getFixedT(secondaryLanguage);
  tSecondary.language = secondaryLanguage;

  const companyName = settings?.company_name || DEFAULT_COMPANY;
  const companySubtitle = settings?.company_desc || settings?.company_subtitle || DEFAULT_SUBTITLE;
  const receiptNo = safeText(transaction.receipt_no);
  
  // Calculate exchange rate representation if equivalent amount exists
  const hasEquivalent = Number(transaction.equivalent_amount || 0) > 0;
  const exchangeRateInfo = hasEquivalent && Number(transaction.amount || 0) > 0
    ? `(1 ${transaction.currency} ≈ ${(Number(transaction.equivalent_amount) / Number(transaction.amount)).toFixed(2)} ${transaction.equivalent_currency})`
    : '';

  const equivalentDisplay = hasEquivalent
    ? (
        <div className="flex flex-col">
          <span>
            {formatReceiptAmount(transaction.equivalent_amount)}{' '}
            <span className="receipt-currency text-slate-500 font-bold ml-0.5 text-[0.8em]">
              {safeText(transaction.equivalent_currency, '')}
            </span>
          </span>
          {exchangeRateInfo && (
            <span className="text-[7pt] text-slate-400 font-semibold">{exchangeRateInfo}</span>
          )}
        </div>
      )
    : '—';

  const bankLabel = bankAccount
    ? [bankAccount.bank_name, bankAccount.account_name, bankAccount.account_number]
        .filter(hasValue)
        .join(' - ')
    : safeText(transaction.bank_account_name || transaction.bank_account, tEn('receipt.no_bank_account'));

  const customerDisplay = safeText(
    transaction.customer_name || transaction.customer,
    '—'
  );

  return (
    <article id="receipt-print-area" className="receipt-sheet relative overflow-hidden" aria-label={tEn('receipt.document_title')}>
      {/* Holographic Security Strip */}
      <div className="receipt-hologram-strip" aria-hidden="true" />

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

      {/* Security Microtext Ribbon */}
      <div className="receipt-microtext-ribbon" aria-hidden="true">
        SKY ARIANA OFFICIAL FINANCIAL RECORD • SECURE TRANSACTION RECORD • HAWALA &amp; BANKING ARCHIVE • VERIFIED AUTHENTIC
      </div>

      {/* Brand Header */}
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
                  if (event.currentTarget.nextElementSibling) {
                    event.currentTarget.nextElementSibling.hidden = false;
                  }
                }}
              />
              <span className="receipt-logo-fallback" hidden>SA</span>
            </div>
            <div>
              <h1>{companyName}</h1>
              <p>{companySubtitle}</p>
              {(settings?.phone || settings?.email || settings?.address) && (
                <div className="receipt-brand-contact">
                  {settings?.phone && <span><Phone size={9} /> {settings.phone}</span>}
                  {settings?.email && <span><Mail size={9} /> {settings.email}</span>}
                  {settings?.address && <span><MapPin size={9} /> {settings.address}</span>}
                </div>
              )}
            </div>
          </div>

          <dl className="receipt-meta-card">
            <div>
              <dt><ReceiptLabel labelKey="receipt.receipt_no" tEn={tEn} tSecondary={tSecondary} /></dt>
              <dd><ReceiptNumberBar receiptNo={receiptNo} /></dd>
            </div>
            <div>
              <dt><ReceiptLabel labelKey="receipt.date" tEn={tEn} tSecondary={tSecondary} /></dt>
              <dd>{formatReceiptDate(transaction.date)}</dd>
            </div>
            <div>
              <dt><ReceiptLabel labelKey="receipt.status" tEn={tEn} tSecondary={tSecondary} /></dt>
              <dd className="receipt-status-value"><StatusBadge status={safeText(transaction.status, 'Completed')} /></dd>
            </div>
          </dl>
        </div>
      </header>

      {/* Document Title Band */}
      <section className="receipt-title-band">
        <h2>{tEn('receipt.document_title')}</h2>
        <div className="receipt-title-band-translations">
          <p dir="rtl" lang="fa">{i18n.getFixedT('fa')('receipt.document_title')}</p>
          <span className="text-amber-500/60 font-bold">•</span>
          <p dir="rtl" lang="ps">{i18n.getFixedT('ps')('receipt.document_title')}</p>
        </div>
        <div>{tEn('receipt.document_subtitle')}</div>
      </section>

      {/* Transaction Summary Grid */}
      <section className="receipt-summary-grid" aria-label={tEn('receipt.transaction_summary')}>
        <div className="receipt-summary-main receipt-summary-amount">
          <ReceiptLabel labelKey="receipt.amount" tEn={tEn} tSecondary={tSecondary} />
          <div className={`receipt-amount-display ${isInflowType(transaction.type) ? 'receipt-amount-in' : 'receipt-amount-out'}`}>
            <CurrencySeal currency={safeText(transaction.currency, 'USD')} />
            <span className="receipt-amount-value">
              <DirectionIcon inflow={isInflowType(transaction.type)} />
              <strong>{isInflowType(transaction.type) ? '+' : '-'}{formatReceiptAmount(transaction.amount)}</strong>
            </span>
            <span className="receipt-currency">{safeText(transaction.currency, 'USD')}</span>
          </div>
          {transaction.type && <div className="receipt-type-badge-wrap"><TypeBadge type={transaction.type} /></div>}
        </div>
        <div>
          <ReceiptLabel labelKey="receipt.equivalent" tEn={tEn} tSecondary={tSecondary} />
          <strong>{equivalentDisplay}</strong>
        </div>
        <div>
          <ReceiptLabel labelKey="receipt.payment_method" tEn={tEn} tSecondary={tSecondary} />
          <strong>{safeText(transaction.payment_method, 'Bank Transfer')}</strong>
        </div>
        <div>
          <ReceiptLabel labelKey="receipt.status" tEn={tEn} tSecondary={tSecondary} />
          <strong className="receipt-status-cell"><StatusBadge status={safeText(transaction.status, 'Completed')} /></strong>
        </div>
      </section>

      {/* Two-Column Grid: Party Details & Payment Details */}
      <div className="receipt-grid-sections">
        {/* Party & Purpose Details */}
        <section className="receipt-section">
          <div className="receipt-section-heading receipt-section-heading-dark">
            <ReceiptLabel labelKey="receipt.party_details" tEn={tEn} tSecondary={tSecondary} />
          </div>
          <dl>
            <DetailRow
              labelKey="receipt.customer"
              value={customerDisplay}
              tEn={tEn}
              tSecondary={tSecondary}
              icon={User}
            />
            {hasValue(transaction.company_name) && (
              <DetailRow
                labelKey="receipt.company"
                value={transaction.company_name}
                tEn={tEn}
                tSecondary={tSecondary}
                icon={Building2}
              />
            )}
            <DetailRow
              labelKey="receipt.subject"
              value={transaction.subject || '—'}
              tEn={tEn}
              tSecondary={tSecondary}
              icon={FileText}
            />
            {hasValue(transaction.receiver_name) && (
              <DetailRow
                labelKey="receipt.receiver"
                value={transaction.receiver_name}
                tEn={tEn}
                tSecondary={tSecondary}
                icon={User}
              />
            )}
          </dl>
        </section>

        {/* Payment & Banking Information */}
        <section className="receipt-section">
          <div className="receipt-section-heading">
            <ReceiptLabel labelKey="receipt.payment_information" tEn={tEn} tSecondary={tSecondary} />
          </div>
          <dl>
            <DetailRow
              labelKey="receipt.payment_method"
              value={transaction.payment_method || 'Bank Transfer'}
              tEn={tEn}
              tSecondary={tSecondary}
              icon={CreditCard}
            />
            <DetailRow
              labelKey="receipt.bank_account"
              value={bankLabel}
              tEn={tEn}
              tSecondary={tSecondary}
              icon={Landmark}
            />
            <DetailRow
              labelKey="receipt.currency"
              value={transaction.currency || 'USD'}
              tEn={tEn}
              tSecondary={tSecondary}
            />
            {hasEquivalent && (
              <DetailRow
                labelKey="receipt.equivalent_currency"
                value={`${transaction.equivalent_currency || 'Afghani'} (${formatReceiptAmount(transaction.equivalent_amount)})`}
                tEn={tEn}
                tSecondary={tSecondary}
              />
            )}
          </dl>
        </section>
      </div>

      {/* Notes & Description Box */}
      <section className="receipt-notes-box">
        <ReceiptLabel labelKey="receipt.description_notes" tEn={tEn} tSecondary={tSecondary} />
        <p dir="auto">{safeText(transaction.description, tEn('receipt.no_description'))}</p>
      </section>

      {/* Authorization & Signatures Grid */}
      <section className="receipt-authorization">
        <div className="receipt-authorization-title flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ReceiptLabel labelKey="receipt.authorization" tEn={tEn} tSecondary={tSecondary} />
            {transaction.status === 'Completed' && (
              <span className="receipt-verified-badge">
                <ShieldCheck size={11} strokeWidth={2.5} />
                VERIFIED
              </span>
            )}
          </div>
          <span className="text-[6.5pt] font-mono font-bold text-slate-400">
            REF-{safeText(transaction.receipt_no, 'TX-DRAFT')}
          </span>
        </div>
        
        <div className="receipt-signature-grid">
          <SignatureBox
            labelKey="receipt.prepared_by"
            helperKey="receipt.date_line"
            defaultName="Ahsanullah Qureshi"
            tEn={tEn}
            tSecondary={tSecondary}
          />
          <SignatureBox
            labelKey="receipt.received_by"
            helperKey="receipt.date_line"
            defaultName={transaction.receiver_name || transaction.customer_name || ''}
            tEn={tEn}
            tSecondary={tSecondary}
          />
          <div className="receipt-official-stamp-card">
            <div className="receipt-official-seal">
              <div className="receipt-seal-inner">
                <div className="text-[4pt] font-black text-rose-700">★ ★ ★</div>
                <div className="receipt-seal-org">{companyName}</div>
                <div className="receipt-seal-badge">OFFICIAL SEAL</div>
                <div className="receipt-seal-date">{transaction.date || new Date().toISOString().slice(0, 10)}</div>
              </div>
            </div>
            <ReceiptLabel labelKey="receipt.company_stamp" tEn={tEn} tSecondary={tSecondary} className="mt-1 text-center" />
          </div>
        </div>
      </section>

      {/* Security Barcode & Audit Hash Bar */}
      <div className="receipt-security-footer-bar" aria-hidden="true">
        <div className="flex items-center gap-1.5 font-mono">
          <span className="receipt-barcode-simulation">||| | |||| | || ||| || |||| |</span>
          <span className="font-bold text-slate-700">{receiptNo !== '—' ? receiptNo : 'TX-SECURE'}</span>
        </div>
        <div className="flex items-center gap-3 text-[5.5pt] font-mono text-slate-500">
          <span>VERIFIED RECORD</span>
          <span>SEC-HASH: #{String(Math.abs((transaction.receipt_no || 'SKY').split('').reduce((a,c)=>a+c.charCodeAt(0), 1024))).padStart(6, '0')}</span>
          <span>{transaction.date || new Date().toISOString().slice(0, 10)}</span>
        </div>
      </div>

      {/* Document Footer */}
      <footer className="receipt-document-footer">
        {settings?.receipt_footer && (
          <p className="font-bold text-slate-700 mb-0.5 block">{settings.receipt_footer}</p>
        )}
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

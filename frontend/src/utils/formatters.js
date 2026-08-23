export function formatCurrency(value, currency = 'USD') {
  const number = Number(value || 0);

  if (currency === 'Toman') {
    return `${number.toLocaleString(undefined, { maximumFractionDigits: 0 })} Toman`;
  }
  if (currency === 'Afghani') {
    return `${number.toLocaleString(undefined, { maximumFractionDigits: 2 })} AFN`;
  }
  if (currency === 'Dirham') {
    return `${number.toLocaleString(undefined, { maximumFractionDigits: 2 })} AED`;
  }

  // Fallback to general formatting
  return `${number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function safeGetStoredItem(key, fallback = null) {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw === 'undefined' || raw === 'null' || raw.trim() === '') return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function safeGetStoredUser() {
  const user = safeGetStoredItem('sky_banking_user', {});
  return (user && typeof user === 'object' && !Array.isArray(user)) ? user : {};
}


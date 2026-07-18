// Arabic-locale formatting helpers (money, numbers, dates, percentages).

const AR = "ar-OM";

// Default currency symbol: Omani Rial (ر.ع.). OMR is subdivided into 1000 baisa,
// so amounts are shown with up to 3 decimal places.
export const CURRENCY_SYMBOL = "ر.ع.";

export function formatMoney(value, currency = CURRENCY_SYMBOL) {
  const num = Number(value || 0);
  return `${num.toLocaleString(AR, { maximumFractionDigits: 3 })} ${currency}`;
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString(AR);
}

export function formatPercent(value) {
  return `${Math.round(Number(value || 0))}٪`;
}

export function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(AR, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

export function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(AR, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

export function clampPercent(n) {
  return Math.max(0, Math.min(100, Number(n || 0)));
}

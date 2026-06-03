
/**
 * Utility for safe formatting of currency, numbers and dates
 * Prevents React crashes due to undefined/null values
 */

/**
 * Safely format a number as currency (INR)
 */
export const formatCurrency = (amount: any, minimumFractionDigits = 2): string => {
  const num = Number(amount);
  if (isNaN(num)) return '₹0.00';
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits,
    maximumFractionDigits: minimumFractionDigits
  })}`;
};

/**
 * Safely format a number
 */
export const formatNumber = (value: any, fractionDigits = 0): string => {
  const num = Number(value);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
};

/**
 * Safely format a date
 */
export const formatDate = (date: any, options: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
}): string => {
  if (!date) return '--';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-IN', options);
};

/**
 * Safely format a date and time
 */
export const formatDateTime = (date: any): string => {
  if (!date) return '--';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

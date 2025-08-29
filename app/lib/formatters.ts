/**
 * Format a numeric value to a currency string
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a percentage value
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format a large number with K/M/B suffixes
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  } else if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  } else {
    return value.toString();
  }
}

/**
 * Format a number with thousands separators (commas)
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Parse a formatted number string back to a number
 * Removes commas, dollar signs, and other formatting
 */
export function parseFormattedNumber(value: string): number {
  const cleanValue = value.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format input value with thousands separators as user types
 */
export function formatInputNumber(value: string): string {
  // Remove all non-numeric characters except decimal point
  const cleanValue = value.replace(/[^0-9.]/g, '');
  
  // Handle empty string
  if (!cleanValue) return '';
  
  // Split by decimal point
  const parts = cleanValue.split('.');
  
  // Format the integer part with commas
  parts[0] = parseInt(parts[0]).toLocaleString('en-US');
  
  // Rejoin with decimal if it exists
  return parts.join('.');
} 
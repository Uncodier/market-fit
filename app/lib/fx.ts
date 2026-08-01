export function formatDisplayCurrency(amount: number, currency: string): string {
  const zeroDecimalCurrencies = [
    'JPY', 'BIF', 'CLP', 'DJF', 'GNF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
  ];
  const isZeroDecimal = zeroDecimalCurrencies.includes(currency.toUpperCase());

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  }).format(amount);
}

export function convertAmount(amount: number, fromCurrency: string, toCurrency: string, rates: Record<string, number>): number | null {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  
  if (from === to) return amount;
  if (!rates || Object.keys(rates).length === 0) return null;

  // Assuming rates are base USD
  const rateFrom = from === 'USD' ? 1 : rates[from];
  const rateTo = to === 'USD' ? 1 : rates[to];

  if (rateFrom === undefined || rateTo === undefined) return null;

  // Convert from -> USD -> to
  const amountInUsd = amount / rateFrom;
  return amountInUsd * rateTo;
}

import { COMMON_CURRENCIES } from '@/app/lib/currencies'

export const REPORT_CURRENCIES = typeof Intl.supportedValuesOf === 'function'
  ? Intl.supportedValuesOf('currency')
  : COMMON_CURRENCIES.map(({ code }) => code)

export function reportCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const currency = value.trim().toUpperCase()
  return REPORT_CURRENCIES.includes(currency) ? currency : null
}
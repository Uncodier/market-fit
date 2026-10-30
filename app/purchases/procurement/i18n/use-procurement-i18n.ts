'use client'

import { useCallback } from 'react'
import { useLocalization } from '@/app/context/LocalizationContext'
import { localeMessages } from '@/app/context/locale-catalog'
import { normalizeLocale } from '@/app/context/locale-preferences'
import { procurementMessage, procurementValueLabel } from './messages'
import { formatProcurementDate } from './format-date'

export function useProcurementI18n() {
  const context = useLocalization()
  const translate = context.t
  const locale = normalizeLocale(context.locale) ?? 'en'
  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const result = translate(key, params)
    if (result !== key) return result
    const raw = localeMessages[locale][key] ?? localeMessages.en[key] ?? key
    return Object.entries(params ?? {}).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)), raw)
  }, [translate, locale])
  const message = useCallback((value: string | null | undefined) => procurementMessage(value ?? '', locale), [locale])
  const valueLabel = useCallback((value: string | null | undefined) => procurementValueLabel(value ?? '', locale), [locale])
  const formatNumber = useCallback((value: number | string) => new Intl.NumberFormat(locale).format(Number(value)), [locale])
  const formatMoney = useCallback((minor: number | string, currency: string) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(minor) / 100), [locale])
  const formatDate = useCallback((value: string | Date, options?: Intl.DateTimeFormatOptions) => formatProcurementDate(locale, value, options), [locale])
  return { t, locale, message, valueLabel, formatNumber, formatMoney, formatDate }
}
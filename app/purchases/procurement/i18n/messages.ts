import { localeMessages } from '@/app/context/locale-catalog'
import type { SupportedLocale } from '@/app/context/locale-preferences'
import { errorKeys } from './error-keys'

const localizedDiagnostics = new Map<SupportedLocale, { exact: Set<string>; templates: RegExp[] }>()
function alreadyLocalized(value: string, locale: SupportedLocale) {
  let entries = localizedDiagnostics.get(locale)
  if (!entries) {
    const values = Object.entries(localeMessages[locale]).filter(([key]) => key.startsWith('procurement.')).map(([, translated]) => translated)
    entries = { exact: new Set(values), templates: values.filter(text => text.includes('{{')).map(text => {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`^${escaped.replace(/\\\{\\\{\s*\w+\s*\\\}\\\}/g, '.+?')}$`)
    }) }
    localizedDiagnostics.set(locale, entries)
  }
  return entries.exact.has(value) || entries.templates.some(pattern => pattern.test(value))
}

const targetKeys: [RegExp, string][] = [
  [/supplier activity/, 'supplierActivity'], [/supplier references/, 'supplierReferences'],
  [/supplier offer|saved offer/, 'offer'], [/suppliers/, 'suppliers'], [/supplier/, 'supplier'],
  [/replenishment.*(?:references|status)/, 'workerStatus'], [/replenishment.*cases|replenishment case/, 'cases'],
  [/replenishment/, 'replenishment'], [/request history/, 'requestHistory'], [/request lines/, 'requestLines'],
  [/request.*policy|request and policy/, 'requestPolicy'], [/requests/, 'requests'], [/request/, 'request'],
  [/tender portal/, 'portal'], [/tender.*policy/, 'policy'], [/tenders/, 'tenders'], [/tender/, 'tender'],
  [/workspace references|reference response|reference search/, 'references'], [/workspace taxes/, 'taxes'],
  [/workspace|access/, 'workspace'], [/procurement capability|capability/, 'capability'], [/sourcing/, 'sourcing'],
  [/configuration|policy/, 'configuration'], [/procurement/, 'procurement'], [/participants/, 'participants'],
  [/approvals/, 'approvals'], [/approval/, 'approval'], [/decision/, 'decision'], [/credentials/, 'credentials'],
  [/representatives/, 'representatives'], [/representation/, 'representation'], [/participation/, 'participation'],
  [/evidence/, 'evidence'], [/item/, 'item'], [/filters/, 'filters'], [/body/, 'body'], [/choices/, 'choices'],
]

function text(locale: SupportedLocale, key: string, params?: Record<string, string | number>) {
  const raw = localeMessages[locale][key] ?? localeMessages.en[key] ?? key
  return Object.entries(params ?? {}).reduce((result, [name, value]) => result.replaceAll(`{{${name}}}`, String(value)), raw)
}

export function procurementValueLabel(value: string, locale: SupportedLocale) {
  return localeMessages[locale][`procurement.values.${value}`] ?? value.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase())
}

/** Translate only application-owned diagnostics, never supplier names or free text. */
export function procurementMessage(value: string, locale: SupportedLocale): string {
  if (!value || locale === 'en') return value
  if (alreadyLocalized(value, locale)) return value
  const key = errorKeys[value]
  if (key) return text(locale, key)
  const tokens = value.split(/\s*·\s*|;\s*/)
  if (tokens.length > 1) return tokens.map(token => procurementMessage(token, locale)).join(' · ')
  const stringBound = /^String must contain at (least|most) (\d+) character/.exec(value)
  if (stringBound) return text(locale, `procurement.errors.${stringBound[1] === 'least' ? 'minLength' : 'maxLength'}`, { count: stringBound[2] })
  const numberBound = /^Number must be (greater|less) than( or equal to)? (-?[\d.]+)/.exec(value)
  if (numberBound) return text(locale, `procurement.errors.${numberBound[1] === 'greater' ? 'minimum' : 'maximum'}${numberBound[2] ? 'Inclusive' : 'Exclusive'}`, { limit: new Intl.NumberFormat(locale).format(Number(numberBound[3])) })
  const itemsBound = /^Array must contain at (least|most) (\d+) element/.exec(value)
  if (itemsBound) return text(locale, `procurement.errors.${itemsBound[1] === 'least' ? 'minimumItems' : 'maximumItems'}`, { limit: itemsBound[2] })
  if (value === 'Required') return text(locale, 'procurement.errors.requiredField')
  if (/Expected integer/.test(value)) return text(locale, 'procurement.errors.wholeNumber')
  if (/finite|Expected number/.test(value)) return text(locale, 'procurement.errors.finiteNumber')
  if (/Invalid email/.test(value)) return text(locale, 'procurement.errors.invalidEmail')
  if (/Invalid uuid/.test(value)) return text(locale, 'procurement.errors.invalidId')
  if (/Invalid (?:date|datetime)/.test(value)) return text(locale, 'procurement.errors.invalidDate')
  if (/^(?:Invalid|Expected|Unrecognized|Number must|Array must)/.test(value)) return text(locale, 'procurement.errors.invalidValue')
  const field = /^([a-zA-Z_][\w.[\]]*): (.+)$/.exec(value)
  if (field) return text(locale, 'procurement.errors.fieldProblem', { field: field[1], message: procurementMessage(field[2], locale) })
  const verb = /^(?:Unable|Could not|Failed|Cannot) to (load|save|update|verify)/.exec(value)
  const target = targetKeys.find(([pattern]) => pattern.test(value.toLowerCase()))
  if (verb && target) return text(locale, `procurement.errors.${verb[1]}`, { target: text(locale, `procurement.errorTargets.${target[1]}`) })
  if (target && /^Invalid|^A valid|^Expected|^Missing|^Unexpected/.test(value)) return text(locale, 'procurement.errors.invalidTarget', { target: text(locale, `procurement.errorTargets.${target[1]}`) })
  return text(locale, 'procurement.common.unknownError')
}
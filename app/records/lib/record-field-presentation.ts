export const currencyDisplays = { symbol: "Symbol", code: "Currency code", name: "Currency name" } as const

export type RecordCurrency = { code: string; display: keyof typeof currencyDisplays }
export const defaultRecordCurrency: RecordCurrency = { code: "USD", display: "symbol" }

export function isRecordCurrency(value: unknown): value is RecordCurrency {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.keys(value).length === 2 && "code" in value && "display" in value
    && typeof value.code === "string" && /^[A-Z]{3}$/.test(value.code)
    && (typeof Intl.supportedValuesOf !== "function" || Intl.supportedValuesOf("currency").includes(value.code))
    && typeof value.display === "string" && Object.hasOwn(currencyDisplays, value.display)
}

export function formatRecordCurrency(value: unknown, metadata: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || !isRecordCurrency(metadata)) return undefined
  return new Intl.NumberFormat(undefined, { style: "currency", currency: metadata.code, currencyDisplay: metadata.display }).format(value)
}

export function recordFieldPresentation(field: { type: string; relationTarget?: string; currency?: RecordCurrency }) {
  if (field.type === "relation" && field.relationTarget === "team_member") return "team_member"
  if (field.type === "number" && field.currency) return "currency"
  return field.type
}

export function recordFieldTypeSettings(presentation: string, currency = defaultRecordCurrency) {
  return {
    type: presentation === "team_member" ? "relation" : presentation === "currency" ? "number" : presentation,
    ...(presentation === "team_member" && { relationTarget: "team_member" }),
    ...(presentation === "currency" && { currency }),
  }
}
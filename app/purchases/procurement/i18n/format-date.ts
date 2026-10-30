/** Avoid runtime-dependent date/time connectors (for example, comma versus "at"). */
export function formatProcurementDate(locale: string, value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'

  const settings = options ?? { dateStyle: 'medium', timeStyle: 'short' }
  if (settings.dateStyle && settings.timeStyle) {
    const { dateStyle, timeStyle, ...shared } = settings
    const dateText = new Intl.DateTimeFormat(locale, { ...shared, dateStyle }).format(date)
    const timeText = new Intl.DateTimeFormat(locale, { ...shared, timeStyle }).format(date)
    return `${dateText}, ${timeText}`
  }
  return new Intl.DateTimeFormat(locale, settings).format(date)
}
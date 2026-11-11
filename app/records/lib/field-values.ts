/** Date-only values are calendar dates, not UTC instants. Legacy timestamps remain readable. */
export function recordFieldDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    const date = new Date(0)
    date.setFullYear(year, month - 1, day)
    date.setHours(0, 0, 0, 0)
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date : undefined
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export function serializeRecordFieldDate(date: Date | undefined): string | null {
  if (!date || Number.isNaN(date.getTime())) return null
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function recordFieldLabel(field: { name: string; label?: string }): string {
  return field.label?.trim() || field.name
}
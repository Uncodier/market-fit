export function coerceDate(value: Date | string | number | null | undefined): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (value == null || value === '') {
    return new Date(0)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed
}

/** Accounting dates use UTC calendar days, independent of the browser timezone. */
export function accountingDate(value: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
    throw new Error('A valid accounting date is required')
  }
  const dateOnly = value.slice(0, 10)
  const parsed = new Date(`${dateOnly}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateOnly) {
    throw new Error('A valid accounting date is required')
  }
  if (value.length > 10) {
    const timestamp = new Date(value)
    if (!Number.isFinite(timestamp.getTime())) throw new Error('Invalid accounting timestamp')
    return timestamp.toISOString().slice(0, 10)
  }
  return dateOnly
}

export function accountingDateRange(fromDate: string, toDate: string) {
  const from = accountingDate(fromDate)
  const to = accountingDate(toDate)
  if (from > to) throw new Error('The start date must not be after the end date')
  const end = new Date(`${to}T00:00:00.000Z`)
  end.setUTCDate(end.getUTCDate() + 1)
  return { from: `${from}T00:00:00.000Z`, toExclusive: end.toISOString() }
}
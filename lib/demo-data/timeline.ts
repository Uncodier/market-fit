const WINDOW_DAYS = 150

function parseTime(value: unknown): number | null {
  if (!value) return null
  const time = Date.parse(String(value))
  return Number.isNaN(time) ? null : time
}

function collectTimes(data: Record<string, any>): number[] {
  const times: number[] = []
  for (const sale of data.sales || []) {
    const time = parseTime(sale.sale_date || sale.created_at)
    if (time != null) times.push(time)
  }
  for (const tx of data.transactions || []) {
    const time = parseTime(tx.date || tx.created_at)
    if (time != null) times.push(time)
  }
  return times
}

function shiftValue(value: unknown, min: number, max: number, windowStart: number, windowEnd: number) {
  const time = parseTime(value)
  if (time == null) return value
  const ratio = max === min ? 1 : (time - min) / (max - min)
  const next = new Date(windowStart + ratio * (windowEnd - windowStart))
  const raw = String(value)
  return raw.length <= 10 ? next.toISOString().slice(0, 10) : next.toISOString()
}

function shiftRow(row: any, fields: string[], min: number, max: number, windowStart: number, windowEnd: number) {
  const next = { ...row }
  for (const field of fields) {
    if (next[field] != null) {
      next[field] = shiftValue(next[field], min, max, windowStart, windowEnd)
    }
  }
  return next
}

/** Stretch historical demo dates into a window ending today so last-month reports have rows. */
export function applyDemoTimeline(data: Record<string, any>, now = new Date()): Record<string, any> {
  const times = collectTimes(data)
  if (times.length === 0) return data

  const min = Math.min(...times)
  const max = Math.max(...times)
  const windowEnd = now.getTime()
  const windowStart = windowEnd - WINDOW_DAYS * 86400000

  return {
    ...data,
    sales: (data.sales || []).map((row: any) =>
      shiftRow(row, ["sale_date", "created_at", "updated_at"], min, max, windowStart, windowEnd)
    ),
    transactions: (data.transactions || []).map((row: any) =>
      shiftRow(row, ["date", "created_at", "updated_at"], min, max, windowStart, windowEnd)
    ),
  }
}

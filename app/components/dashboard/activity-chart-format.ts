const countFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

export function compactActivityCount(value: number) {
  return countFormatter.format(value)
}

export function activityDate(value: string, full = false) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", ...(full ? { year: "numeric" as const } : {}), timeZone: "UTC",
  })
}
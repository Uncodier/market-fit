const PENDING_STATUSES = new Set(["new", "pending"])
const PRODUCTION_STATUSES = new Set([
  "new",
  "pending",
  "preparing",
  "in_progress",
])

export function isPendingOrderLine(status?: string | null): boolean {
  return PENDING_STATUSES.has(status || "draft")
}

export function isProductionOrderLine(status?: string | null): boolean {
  return PRODUCTION_STATUSES.has(status || "draft")
}

export function shouldTickOrderLineClock({
  lineStatus,
  orderStatus,
  shipmentStatus,
}: {
  lineStatus?: string | null
  orderStatus?: string | null
  shipmentStatus?: string | null
}): boolean {
  if (["completed", "cancelled"].includes(orderStatus || "")) return false
  return (
    PRODUCTION_STATUSES.has(lineStatus || "draft") ||
    Boolean(
      shipmentStatus &&
        !["delivered", "cancelled", "failed"].includes(shipmentStatus),
    )
  )
}

export function formatOrderLineDuration(
  createdAt: string,
  now: number = Date.now(),
): string {
  const createdAtMs = new Date(createdAt).getTime()
  if (!Number.isFinite(createdAtMs)) return "—"

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - createdAtMs) / 1_000),
  )
  if (elapsedSeconds < 60) return `${elapsedSeconds}s`

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  const remainingSeconds = elapsedSeconds % 60
  if (elapsedMinutes < 60) {
    return remainingSeconds
      ? `${elapsedMinutes}m ${remainingSeconds}s`
      : `${elapsedMinutes}m`
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  const remainingMinutes = elapsedMinutes % 60
  if (elapsedHours < 24) {
    return remainingMinutes
      ? `${elapsedHours}h ${remainingMinutes}m`
      : `${elapsedHours}h`
  }

  const elapsedDays = Math.floor(elapsedHours / 24)
  const remainingHours = elapsedHours % 24
  return remainingHours
    ? `${elapsedDays}d ${remainingHours}h`
    : `${elapsedDays}d`
}

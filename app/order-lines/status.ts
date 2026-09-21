export const ORDER_LINE_FILTERS = [
  "all",
  "pending",
  "preparing",
  "completed",
  "returned",
  "cancelled",
] as const

export type OrderLineFilter = (typeof ORDER_LINE_FILTERS)[number]

export const ORDER_LINE_ACTION_STATUSES = [
  "preparing",
  "completed",
  "returned",
  "cancelled",
] as const

export type OrderLineActionStatus =
  (typeof ORDER_LINE_ACTION_STATUSES)[number]

const ORDER_LINE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  new: "Pending",
  pending: "Pending",
  preparing: "In Progress",
  completed: "Ready",
  returned: "Returned",
  cancelled: "Cancelled",
}

export function isOrderLineFilter(value: string): value is OrderLineFilter {
  return ORDER_LINE_FILTERS.includes(value as OrderLineFilter)
}

export function isOrderLineActionStatus(
  value: string,
): value is OrderLineActionStatus {
  return ORDER_LINE_ACTION_STATUSES.includes(value as OrderLineActionStatus)
}

export function orderLineStatusesForFilter(
  filter: OrderLineFilter,
): string[] | null {
  if (filter === "all") return null
  if (filter === "pending") return ["new", "pending"]
  if (filter === "preparing") return ["preparing", "in_progress"]
  if (filter === "completed") return ["completed", "ready"]
  return [filter]
}

export function orderLineStatusLabel(status?: string | null): string {
  const normalized = status || "draft"
  return (
    ORDER_LINE_STATUS_LABELS[normalized] ||
    normalized.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    )
  )
}

export function nextOrderLineStatus(
  status?: string | null,
): Exclude<OrderLineActionStatus, "cancelled"> | null {
  switch (status || "draft") {
    case "draft":
    case "new":
    case "pending":
      return "preparing"
    case "preparing":
    case "in_progress":
      return "completed"
    case "completed":
    case "ready":
      return "returned"
    default:
      return null
  }
}

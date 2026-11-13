import type { TransferLine, TransferOrder } from "./order-types"

export const transferStatuses = ["draft", "requested", "approved", "in_transit", "partially_received", "received", "cancelled"] as const
export const transferLabel = (status: string) => ({ in_transit: "In transit", partially_received: "Partially received", written_off: "Written off" }[status] || status.charAt(0).toUpperCase() + status.slice(1).replaceAll("_", " "))
export const transferTitle = (order: Pick<TransferOrder, "id">) => `Transfer ${order.id.startsWith("demo-") ? order.id.replace("demo-transfer-", "") : order.id.slice(0, 8)}`
export const outstanding = (line: TransferLine) => Math.max(0, line.dispatched_quantity - line.received_quantity - line.returned_quantity - line.written_off_quantity)
export function lineStatus(line: TransferLine) {
  if (line.returned_quantity || line.written_off_quantity) return outstanding(line) ? "Discrepancy · in transit" : "Reconciled discrepancy"
  if (line.dispatched_quantity && outstanding(line) === 0) return line.dispatched_quantity < line.requested_quantity ? "Received · short dispatch" : "Received"
  if (line.received_quantity) return "Partially received · in transit"
  if (line.dispatched_quantity) return "In transit"
  return "Not dispatched"
}
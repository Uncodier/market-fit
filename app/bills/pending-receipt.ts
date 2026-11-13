import { billInventoryReceiptSchema, type BillInventoryReceiptInput } from "./receipt-schema"

export const pendingReceiptChangedEvent = "inventory:pending-bill-receipt-changed"

export const pendingReceiptKey = (actorId: string, siteId: string, purchaseId: string) =>
  `inventory:pending-bill-receipt:v1:${actorId}:${siteId}:${purchaseId}`

export function readPendingReceipt(key: string, siteId: string, purchaseId: string) {
  const raw = sessionStorage.getItem(key)
  if (!raw) return null
  const input = billInventoryReceiptSchema.parse(JSON.parse(raw))
  if (input.siteId !== siteId || input.purchaseId !== purchaseId) throw new Error("Invalid pending receipt")
  return input
}

// Discovery is read-only; the dialog still validates storage before any submission.
export function hasPendingReceipt(actorId: string | undefined, siteId: string | undefined, purchaseId: string | undefined) {
  if (!actorId || !siteId || !purchaseId) return false
  try {
    return !!readPendingReceipt(pendingReceiptKey(actorId, siteId, purchaseId), siteId, purchaseId)
  } catch {
    return false
  }
}

// Persist the entire immutable payload before dispatch; storage failure blocks mutation.
export function writePendingReceipt(key: string, input: BillInventoryReceiptInput) {
  const raw = JSON.stringify(input)
  sessionStorage.setItem(key, raw)
  if (sessionStorage.getItem(key) !== raw) throw new Error("Pending receipt could not be saved")
  window.dispatchEvent(new Event(pendingReceiptChangedEvent))
}

export function clearPendingReceipt(key: string) {
  sessionStorage.removeItem(key)
  if (sessionStorage.getItem(key) !== null) throw new Error("Pending receipt could not be cleared")
  window.dispatchEvent(new Event(pendingReceiptChangedEvent))
}

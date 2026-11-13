import type { TransferTransitionInput } from "./order-schema"
import { transferTransitionSchema } from "./order-schema"

export const pendingTransitionKey = (actor: string, site: string, order: string) => `inventory:pending-transfer:v1:${actor}:${site}:${order}`
export function readPendingTransition(key: string, actor: string, site: string, order: string): TransferTransitionInput | null {
  const raw = sessionStorage.getItem(key)
  if (!raw) return null
  const stored = JSON.parse(raw)
  const parsed = transferTransitionSchema.safeParse(stored.payload)
  if (stored.actorId !== actor || !parsed.success || parsed.data.siteId !== site || parsed.data.orderId !== order) throw new Error("Invalid pending transfer operation")
  return parsed.data
}
export function writePendingTransition(key: string, actorId: string, payload: TransferTransitionInput) {
  const raw = JSON.stringify({ actorId, payload })
  sessionStorage.setItem(key, raw)
  if (sessionStorage.getItem(key) !== raw) throw new Error("Pending transfer could not be saved")
}
export function clearPendingTransition(key: string) {
  sessionStorage.removeItem(key)
  if (sessionStorage.getItem(key) !== null) throw new Error("Pending transfer could not be cleared")
}
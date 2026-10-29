import { v4 as uuidv4 } from "uuid"
import { enqueueCheckout, listOutbox } from "@/app/pos/local/outbox"
import type { CheckoutOutboxPayload } from "@/app/pos/local/types"
import { fetchActivePaymentRegister } from "../operation-client"
import { withRegisterPaymentLock } from "./queue-guard"
import { requirePosPermission, isPosPermissionCurrent } from "../local/location-permission-state"
import { getCheckoutCartSession } from "../local/checkout-attempt-storage"
import { throwPaymentRegisterError } from "./payment-register-required"
import { assertPosRemotePermission } from "../local/remote-permission"

function paymentFingerprint(data: CheckoutOutboxPayload, sameAttempt = false) {
  // Queue-only metadata must not make an unchanged UI payment look like a new collection.
  return JSON.stringify(data, (key, value) =>
    (["clientMutationId", "registerSessionId", "paymentId", "posOperationIdentity"].includes(key) ||
      (sameAttempt && ["leadId", "localLeadId"].includes(key))) ? undefined : value)
}

/** Persist receipt identities before dispatch. Optimistic callers must observe server confirmation separately. */
export async function enqueueRegisteredCheckout(siteId: string, payload: CheckoutOutboxPayload, onReceipt?: (id: string) => void,
  isCurrent: () => boolean = () => true, options: { waitForConfirmation?: boolean } = {}) {
  const permission = requirePosPermission(siteId)
  if (!payload.payments?.length) return enqueueCheckout(siteId, payload)
  assertPosRemotePermission(permission)
  const cartSessionId = getCheckoutCartSession(siteId)
  const assertSelection = () => {
    if (!isCurrent() || getCheckoutCartSession(siteId) !== cartSessionId) {
      throw new Error("The active cart changed. Confirm the selected order again.")
    }
  }
  const queued = await withRegisterPaymentLock(siteId, async () => {
    assertPosRemotePermission(permission)
    assertSelection()
    const rows = await listOutbox(siteId)
    if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
    assertSelection()
    const previous = rows.find((row) => row.payload.kind === "checkout" && row.payload.data.userId === payload.userId &&
      row.recoveryState !== "rejected" &&
      (row.clientMutationId === payload.clientMutationId ||
        (row.checkoutCartSessionId ? row.checkoutCartSessionId === cartSessionId : !cartSessionId.startsWith("new:"))) &&
      (row.recoveryState !== "payment_recorded" || row.clientMutationId === payload.clientMutationId ||
        !!payload.existingOrderId && (row.payload.data.existingOrderId === payload.existingOrderId || row.recoveryOrderId === payload.existingOrderId)) &&
      ((row.clientMutationId === payload.clientMutationId && row.status === "synced") ||
      (row.status !== "synced" && paymentFingerprint(row.payload.data, row.clientMutationId === payload.clientMutationId) === paymentFingerprint({
        ...payload, originLocationId: payload.originLocationId || row.payload.data.originLocationId,
      }, row.clientMutationId === payload.clientMutationId))))
    if (!previous) {
      // Isolate unresolved money to its own order/attempt, never to the whole POS.
      const unresolved = rows.filter((row) => row.status !== "synced" && row.payload.kind === "checkout" && row.payload.data.payments?.length)
      if (unresolved.some((row) => row.recoveryState !== "rejected" &&
        (row.clientMutationId === payload.clientMutationId ||
          !!payload.existingOrderId && (row.payload.kind === "checkout" && row.payload.data.existingOrderId === payload.existingOrderId ||
            row.recoveryOrderId === payload.existingOrderId || row.resultOrderId === payload.existingOrderId) ||
          !payload.existingOrderId && row.payload.kind === "checkout" && !row.payload.data.existingOrderId &&
            (row.checkoutCartSessionId ? row.checkoutCartSessionId === cartSessionId : !cartSessionId.startsWith("new:"))))) {
        throw new Error("This order has an unresolved payment. Check payment status before collecting it again. Other orders can still be paid.")
      }
      // A rejected identity must remain in the audit trail; a reviewed reattempt
      // receives new IDs rather than enqueueCheckout returning the obsolete row.
      if (rows.some((row) => row.clientMutationId === payload.clientMutationId && row.recoveryState === "rejected")) {
        payload = { ...payload, clientMutationId: uuidv4() }
        onReceipt?.(payload.clientMutationId)
      }
      assertPosRemotePermission(permission)
      const result = await fetchActivePaymentRegister({
        siteId, ...(payload.originLocationId ? { locationId: payload.originLocationId } : {}),
      })
      assertPosRemotePermission(permission)
      if (result.error !== undefined) throwPaymentRegisterError(result)
      assertSelection()
      return enqueueCheckout(siteId, {
        ...payload, originLocationId: result.data.location_id, registerSessionId: result.data.id,
        payments: payload.payments!.map((payment) => ({ ...payment, paymentId: uuidv4() })),
      }, cartSessionId, () => { assertSelection(); assertPosRemotePermission(permission) })
    }
    return previous
  })
  // The durable pending row prevents closure and duplicate collection. Network
  // confirmation owns only its row, not the whole site's register lock.
  const mutationId = queued.clientMutationId
  onReceipt?.(mutationId)
  if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
  // The durable row still blocks duplicate payment and register closing. Returning
  // it is local acceptance, not proof of a paid or completed order.
  if (options.waitForConfirmation === false) return queued
  if (queued.status === "synced") return queued
  const { syncPosCheckout } = await import("@/app/pos/local/sync-engine")
  if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
  await syncPosCheckout(siteId, mutationId)
  if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
  const stored = (await listOutbox(siteId)).find((row) => row.clientMutationId === mutationId)
  if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
  if (stored?.status !== "synced") {
    throw new Error(stored?.recoveryMessage || "Payment is not confirmed. Check payment status before collecting again. Use New Order to serve another customer; this attempt remains saved.")
  }
  return stored
}
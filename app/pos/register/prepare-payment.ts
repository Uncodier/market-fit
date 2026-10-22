import { v4 as uuidv4 } from "uuid"
import { enqueueCheckout, listOutbox } from "@/app/pos/local/outbox"
import type { CheckoutOutboxPayload } from "@/app/pos/local/types"
import { getActiveRegisterForPayment } from "./actions"
import { withRegisterPaymentLock } from "./queue-guard"
import { requirePosPermission, isPosPermissionCurrent } from "../local/location-permission-state"
import { isPosPaymentIsolated } from "../local/checkout-recovery"

function paymentFingerprint(data: CheckoutOutboxPayload, sameAttempt = false) {
  return JSON.stringify(data, (key, value) =>
    (["clientMutationId", "registerSessionId", "paymentId"].includes(key) ||
      (sameAttempt && ["leadId", "localLeadId"].includes(key))) ? undefined : value)
}

/** Collect only after the register receipt has reached the server, preserving retry IDs. */
export async function enqueueRegisteredCheckout(siteId: string, payload: CheckoutOutboxPayload, onReceipt?: (id: string) => void) {
  const permission = requirePosPermission(siteId)
  if (!payload.payments?.length) return enqueueCheckout(siteId, payload)
  return withRegisterPaymentLock(siteId, async () => {
    if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
    const rows = await listOutbox(siteId)
    if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
    const previous = rows.find((row) => row.payload.kind === "checkout" &&
      row.recoveryState !== "rejected" &&
      (row.recoveryState !== "payment_recorded" || row.clientMutationId === payload.clientMutationId ||
        !!payload.existingOrderId && (row.payload.data.existingOrderId === payload.existingOrderId || row.recoveryOrderId === payload.existingOrderId)) &&
      row.payload.data.registerSessionId && ((row.clientMutationId === payload.clientMutationId && row.status === "synced") ||
      (row.status !== "synced" && paymentFingerprint(row.payload.data, row.clientMutationId === payload.clientMutationId) === paymentFingerprint({
        ...payload, originLocationId: payload.originLocationId || row.payload.data.originLocationId,
      }, row.clientMutationId === payload.clientMutationId))))
    if (!previous) {
      const unresolved = rows.filter((row) => row.status !== "synced" && row.payload.kind === "checkout" && row.payload.data.payments?.length)
      if (unresolved.some((row) => row.recoveryState !== "rejected" &&
        (row.payload.kind === "checkout" && !!payload.existingOrderId && row.payload.data.existingOrderId === payload.existingOrderId ||
          !!payload.existingOrderId && row.recoveryOrderId === payload.existingOrderId))) {
        throw new Error("This order has an unresolved payment. Check payment status before collecting it again.")
      }
      if (unresolved.some((row) => !isPosPaymentIsolated(row))) {
        throw new Error("Another payment is unresolved on this device. Synchronize or review it before collecting a different payment.")
      }
      // A rejected identity must remain in the audit trail; a reviewed reattempt
      // receives new IDs rather than enqueueCheckout returning the obsolete row.
      if (rows.some((row) => row.clientMutationId === payload.clientMutationId && row.recoveryState === "rejected")) {
        payload = { ...payload, clientMutationId: uuidv4() }
        onReceipt?.(payload.clientMutationId)
      }
      const result = await getActiveRegisterForPayment({
        siteId, ...(payload.originLocationId ? { locationId: payload.originLocationId } : {}),
      })
      if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
      if (!result.data) throw new Error(result.error)
      await enqueueCheckout(siteId, {
        ...payload, originLocationId: result.data.location_id, registerSessionId: result.data.id,
        payments: payload.payments!.map((payment) => ({ ...payment, paymentId: uuidv4() })),
      })
      if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
    }
    const mutationId = previous?.clientMutationId || payload.clientMutationId
    // Persist a recovered legacy receipt identity before sync can suspend/remount.
    onReceipt?.(mutationId)
    if (previous?.status === "synced") return previous
    const { drainPosOutbox } = await import("@/app/pos/local/sync-engine")
    if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
    await drainPosOutbox(siteId)
    if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
    const stored = (await listOutbox(siteId)).find((row) => row.clientMutationId === mutationId)
    if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
    if (stored?.status !== "synced") {
      throw new Error(stored?.recoveryMessage || "Payment is not confirmed. Keep this order open and check payment status before collecting again.")
    }
    return stored
  })
}
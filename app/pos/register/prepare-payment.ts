import { v4 as uuidv4 } from "uuid"
import { enqueueCheckout, listOutbox } from "@/app/pos/local/outbox"
import type { CheckoutOutboxPayload } from "@/app/pos/local/types"
import { getActiveRegisterForPayment } from "./actions"
import { withRegisterPaymentLock } from "./queue-guard"

function paymentFingerprint(data: CheckoutOutboxPayload) {
  return JSON.stringify(data, (key, value) =>
    ["clientMutationId", "registerSessionId", "paymentId"].includes(key) ? undefined : value)
}

/** Collect only after the register receipt has reached the server, preserving retry IDs. */
export async function enqueueRegisteredCheckout(siteId: string, payload: CheckoutOutboxPayload) {
  if (!payload.payments?.length) return enqueueCheckout(siteId, payload)
  return withRegisterPaymentLock(siteId, async () => {
    const rows = await listOutbox(siteId)
    const previous = rows.find((row) => row.payload.kind === "checkout" &&
      (row.status !== "synced" || row.clientMutationId === payload.clientMutationId) &&
      row.payload.data.registerSessionId && paymentFingerprint(row.payload.data) === paymentFingerprint({
        ...payload, originLocationId: payload.originLocationId || row.payload.data.originLocationId,
      }))
    if (!previous) {
      if (rows.some((row) => row.status !== "synced" && row.payload.kind === "checkout" && row.payload.data.payments?.length)) {
        throw new Error("Another payment is unresolved on this device. Synchronize or review it before collecting a different payment.")
      }
      const result = await getActiveRegisterForPayment({
        siteId, ...(payload.originLocationId ? { locationId: payload.originLocationId } : {}),
      })
      if (!result.data) throw new Error(result.error)
      await enqueueCheckout(siteId, {
        ...payload, originLocationId: result.data.location_id, registerSessionId: result.data.id,
        payments: payload.payments!.map((payment) => ({ ...payment, paymentId: uuidv4() })),
      })
    }
    const mutationId = previous?.clientMutationId || payload.clientMutationId
    if (previous?.status === "synced") return previous
    const { drainPosOutbox } = await import("@/app/pos/local/sync-engine")
    await drainPosOutbox(siteId)
    const stored = (await listOutbox(siteId)).find((row) => row.clientMutationId === mutationId)
    if (stored?.status !== "synced") {
      throw new Error("Payment is not confirmed. Keep this order open and retry synchronization before collecting again.")
    }
    return stored
  })
}
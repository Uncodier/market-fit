import { listOutbox } from "@/app/pos/local/outbox"

export function requireRegisterOnline() {
  if (typeof navigator === "undefined" || !navigator.onLine) {
    throw new Error("Connect to the internet to open, collect payment, or close a register.")
  }
}

export async function withRegisterPaymentLock<T>(siteId: string, operation: () => Promise<T>): Promise<T> {
  requireRegisterOnline()
  if (!navigator.locks) {
    throw new Error("This browser does not support safe register locking. Use an up-to-date browser.")
  }
  return navigator.locks.request(`pos-register:${siteId}`, { mode: "exclusive" }, async () => {
    requireRegisterOnline()
    return operation()
  })
}

export async function assertRegisterQueueSettled(siteId: string) {
  requireRegisterOnline()
  const { drainPosOutbox } = await import("@/app/pos/local/sync-engine")
  await drainPosOutbox(siteId)
  const rows = await listOutbox(siteId)
  const unresolved = rows.some((row) => row.status !== "synced" && row.payload.kind === "checkout" &&
    Boolean(row.payload.data.payments?.length) && row.recoveryState !== "rejected")
  if (unresolved) {
    throw new Error("There are unsynchronized payments on this device. Resolve them before closing the register.")
  }
}

export async function withRegisterCloseLock<T>(siteId: string, operation: () => Promise<T>): Promise<T> {
  return withRegisterPaymentLock(siteId, async () => {
    await assertRegisterQueueSettled(siteId)
    return operation()
  })
}
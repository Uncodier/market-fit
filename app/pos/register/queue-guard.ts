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
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const waiting = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error("The register is busy. No new payment was submitted. Try again shortly."))
      controller.abort()
    }, 8_000)
  })
  // Cancel only admission. Never release an acquired lock while a write may commit.
  const request = navigator.locks.request(`pos-register:${siteId}`, { mode: "exclusive", signal: controller.signal }, async () => {
    if (controller.signal.aborted) throw new Error("Register lock request expired")
    clearTimeout(timer)
    requireRegisterOnline()
    return operation()
  })
  try { return await Promise.race([request, waiting]) }
  finally { clearTimeout(timer) }
}

export async function assertRegisterQueueSettled(siteId: string) {
  requireRegisterOnline()
  // Closing must not hold the register lock while unrelated background sync runs.
  // Pending receipts already fence closure; recovery remains an explicit action.
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
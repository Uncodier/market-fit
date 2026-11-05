type UsbSessionDevice = {
  vendorId: number
  productId: number
  opened: boolean
  close: () => Promise<void>
}

const pending = new Map<string, Promise<void>>()

/** Include probes, reconnects and whole writes in the same exclusive session. */
export async function withUsbSession<T>(device: UsbSessionDevice, operation: () => Promise<T>): Promise<T> {
  // Model-level locking also coordinates legacy bindings without serial numbers.
  const key = `printer-usb:${device.vendorId}:${device.productId}`
  const previous = pending.get(key) || Promise.resolve()
  const run = async () => {
    try {
      return await operation()
    } finally {
      if (device.opened) {
        try {
          // close releases claimed interfaces but preserves browser permission.
          await device.close()
        } catch (err) {
          // Do not turn completed output into a retryable failed print.
          console.warn("Could not close the USB printer connection", err)
        }
      }
    }
  }
  const flight = previous.then(async () => {
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined
    if (!locks) return run()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      return await locks.request(key, { mode: "exclusive", signal: controller.signal }, async () => {
        clearTimeout(timeout)
        return run()
      })
    } finally {
      clearTimeout(timeout)
    }
  })
  const settled = flight.then(() => {}, () => {})
  pending.set(key, settled)
  try {
    return await flight
  } finally {
    if (pending.get(key) === settled) pending.delete(key)
  }
}
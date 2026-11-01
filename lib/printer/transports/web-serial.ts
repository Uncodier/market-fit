import { isWebUsbSupported, requestWebUsbPrinter } from "./web-usb"

type SerialPortLike = {
  open: (options: { baudRate: number }) => Promise<void>
  close: () => Promise<void>
  writable: WritableStream<Uint8Array> | null
  getInfo?: () => { usbVendorId?: number; usbProductId?: number }
}

type SerialApi = {
  requestPort: (options?: { filters?: { usbVendorId: number }[] }) => Promise<SerialPortLike>
  getPorts: () => Promise<SerialPortLike[]>
}

const DEFAULT_BAUD = 9600
let openSession: { port: SerialPortLike; baudRate: number } | null = null

function getSerial(): SerialApi | null {
  if (typeof navigator === "undefined") return null
  return (navigator as Navigator & { serial?: SerialApi }).serial || null
}

export function isWebSerialSupported(): boolean {
  return Boolean(getSerial())
}

function isUserCancel(err: unknown): boolean {
  const name = err instanceof DOMException ? err.name : ""
  const message = err instanceof Error ? err.message : String(err ?? "")
  return (
    name === "NotFoundError" ||
    message.toLowerCase().includes("no port selected") ||
    message.toLowerCase().includes("no device selected")
  )
}

async function ensureOpen(port: SerialPortLike, baudRate: number): Promise<void> {
  if (
    openSession?.port === port &&
    openSession.baudRate === baudRate &&
    port.writable
  ) {
    return
  }
  if (openSession?.port === port) {
    openSession = null
    try {
      await port.close()
    } catch {
      // The browser may already consider a disconnected port closed.
    }
  }
  if (openSession) {
    try {
      await openSession.port.close()
    } catch {
      // ignore
    }
    openSession = null
  }
  try {
    await port.open({ baudRate })
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
    if (!message.includes("already open")) throw err
  }
  openSession = { port, baudRate }
}

async function findPort(vendorId?: number, productId?: number): Promise<SerialPortLike | null> {
  const serial = getSerial()
  if (!serial) return null
  const ports = await serial.getPorts()
  if (!ports.length) return null
  const candidates = ports.filter((p) => {
    const info = p.getInfo?.() || {}
    if (vendorId != null && info.usbVendorId !== vendorId) return false
    if (productId != null && info.usbProductId !== productId) return false
    return true
  })
  // Web Serial exposes model IDs, not a stable per-device serial number.
  if (candidates.length > 1) {
    throw new Error("Multiple serial printers match this binding. Connect only the intended printer and bind it again.")
  }
  return candidates[0] || null
}

export async function requestUsbPrinter(): Promise<{
  kind: "serial" | "webusb"
  vendorId?: number
  productId?: number
  serialNumber?: string
  baudRate?: number
} | null> {
  let usbError: unknown = null
  
  if (isWebUsbSupported()) {
    try {
      return await requestWebUsbPrinter()
    } catch (err) {
      if (isUserCancel(err)) throw err
      usbError = err
    }
  }

  const serial = getSerial()
  if (serial) {
    try {
      const port = await serial.requestPort()
      const info = port.getInfo?.() || {}
      await ensureOpen(port, DEFAULT_BAUD)
      return {
        kind: "serial",
        vendorId: info.usbVendorId,
        productId: info.usbProductId,
        baudRate: DEFAULT_BAUD,
      }
    } catch (err) {
      if (!isUserCancel(err)) {
         throw usbError || err
      }
    }
  }
  
  if (!isWebUsbSupported() && !serial) {
    throw new Error("USB printing needs Chrome or Edge")
  }
  
  if (usbError) throw usbError
  return null
}

export async function warmUsbPrinter(
  vendorId?: number,
  productId?: number,
  baudRate?: number,
): Promise<boolean> {
  const port = await findPort(vendorId, productId)
  if (!port) return false
  await ensureOpen(port, baudRate || DEFAULT_BAUD)
  return true
}

export async function writeUsbBytes(
  data: Uint8Array,
  vendorId?: number,
  productId?: number,
  options?: { allowPrompt?: boolean; baudRate?: number; serialNumber?: string; allowWebUsbFallback?: boolean },
): Promise<void> {
  const serial = getSerial()
  if (!serial) {
    if (options?.allowWebUsbFallback !== false && isWebUsbSupported()) {
      const { writeWebUsbBytes } = await import("./web-usb")
      return writeWebUsbBytes(data, vendorId, productId, options?.serialNumber, { allowPrompt: options?.allowPrompt })
    }
    throw new Error("USB printing is not supported in this browser")
  }

  // Attempt Web Serial first.
  let port = await findPort(vendorId, productId)
  
  // Try an existing WebUSB permission before prompting for Serial again.
  if (!port && options?.allowWebUsbFallback !== false && isWebUsbSupported()) {
    const { writeWebUsbBytes } = await import("./web-usb")
    return writeWebUsbBytes(data, vendorId, productId, options?.serialNumber, { allowPrompt: false })
  }

  if (!port) {
    if (options?.allowPrompt === false) {
      throw new Error("USB printer is not connected on this station")
    }
    port = await serial.requestPort()
  }

  await ensureOpen(port, options?.baudRate || DEFAULT_BAUD)
  if (!port.writable) throw new Error("Printer port is not writable")
  const writer = port.writable.getWriter()
  let failed = false
  try {
    await writer.write(data)
  } catch (err) {
    failed = true
    throw err
  } finally {
    writer.releaseLock()
    if (failed && openSession?.port === port) {
      openSession = null
      try {
        await port.close()
      } catch {
        // A disconnected port may reject close; the next print will reopen it.
      }
    }
  }
}

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
  if (openSession?.port === port) return
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
  if (vendorId == null && productId == null) return ports[0]
  return (
    ports.find((p) => {
      const info = p.getInfo?.() || {}
      if (vendorId != null && info.usbVendorId !== vendorId) return false
      if (productId != null && info.usbProductId !== productId) return false
      return true
    }) || null
  )
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
      if (isUserCancel(err)) throw err // Si canceló, no seguimos preguntando
      usbError = err // Guardamos el error para fallback
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
  options?: { allowPrompt?: boolean; baudRate?: number },
): Promise<void> {
  const serial = getSerial()
  if (!serial) throw new Error("Web Serial is not supported in this browser")
  let port = await findPort(vendorId, productId)
  if (!port) {
    if (options?.allowPrompt === false) {
      throw new Error("USB printer is not connected on this station")
    }
    port = await serial.requestPort()
  }
  await ensureOpen(port, options?.baudRate || DEFAULT_BAUD)
  if (!port.writable) throw new Error("Printer port is not writable")
  const writer = port.writable.getWriter()
  try {
    await writer.write(data)
  } finally {
    writer.releaseLock()
  }
}

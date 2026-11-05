import { withUsbSession } from "./usb-session"

type UsbDeviceLike = {
  vendorId: number
  productId: number
  serialNumber?: string
  opened: boolean
  configuration?: { interfaces: UsbInterfaceLike[] } | null
  configurations?: { configurationValue: number }[]
  open: () => Promise<void>
  close: () => Promise<void>
  selectConfiguration: (value: number) => Promise<void>
  claimInterface: (n: number) => Promise<void>
  selectAlternateInterface?: (interfaceNumber: number, alternateSetting: number) => Promise<void>
  transferOut: (endpointNumber: number, data: BufferSource) => Promise<{ status: string; bytesWritten: number }>
}

type UsbInterfaceLike = {
  claimed: boolean
  interfaceNumber: number
  alternate?: { alternateSetting: number }
  alternates: {
    alternateSetting?: number
    endpoints: { direction: string; endpointNumber: number; type: string }[]
  }[]
}

type UsbApi = {
  requestDevice: (options: { filters: object[] }) => Promise<UsbDeviceLike>
  getDevices: () => Promise<UsbDeviceLike[]>
}

const USB_FILTERS = [
  { classCode: 7 },
  { vendorId: 0x0483 },
  { vendorId: 0x1a86 },
  { vendorId: 0x0403 },
  { vendorId: 0x10c4 },
  { vendorId: 0x067b },
  { vendorId: 0x0525 },
  { vendorId: 0x0fe6 },
  { vendorId: 0x28e9 },
  { vendorId: 0x0416 },
  { vendorId: 0x6868 },
  {},
]

let cached: UsbDeviceLike | null = null

function getUsb(): UsbApi | null {
  if (typeof navigator === "undefined") return null
  return (navigator as Navigator & { usb?: UsbApi }).usb || null
}

export function isWebUsbSupported(): boolean {
  return Boolean(getUsb())
}

function matches(
  device: UsbDeviceLike,
  vendorId?: number,
  productId?: number,
  serialNumber?: string,
) {
  if (serialNumber && device.serialNumber !== serialNumber) return false
  if (vendorId != null && device.vendorId !== vendorId) return false
  if (productId != null && device.productId !== productId) return false
  return true
}

async function findDevice(
  vendorId?: number,
  productId?: number,
  serialNumber?: string,
): Promise<UsbDeviceLike | null> {
  const usb = getUsb()
  if (!usb) return null
  const devices = await usb.getDevices()
  const candidates = devices.filter((d) => matches(d, vendorId, productId, serialNumber))
  if (candidates.length > 1) {
    throw new Error("Multiple USB printers match this binding. Connect only the intended printer and bind it again.")
  }
  if (
    cached &&
    devices.includes(cached) &&
    matches(cached, vendorId, productId, serialNumber)
  ) {
    return cached
  }
  cached = null
  const found = candidates[0]
  if (found) cached = found
  return found
}

async function claimBulkOut(device: UsbDeviceLike): Promise<number> {
  if (!device.opened) await device.open()
  
  if (!device.configuration) {
    await device.selectConfiguration(device.configurations?.[0]?.configurationValue ?? 1)
  }

  const interfaces = device.configuration?.interfaces || []
  let connectionError: unknown
  
  // Prefer a bulk or interrupt output endpoint.
  for (const iface of interfaces) {
    for (const alternate of iface.alternates || []) {
      const endpoint = alternate.endpoints?.find(
        (e) => e.direction === "out" && (e.type === "bulk" || e.type === "interrupt"),
      )
      if (endpoint) {
        try {
          if (!iface.claimed) {
            await device.claimInterface(iface.interfaceNumber)
          }
          if (alternate.alternateSetting != null &&
              iface.alternate?.alternateSetting !== alternate.alternateSetting) {
            if (!device.selectAlternateInterface) throw new Error("USB alternate interface selection is unavailable")
            await device.selectAlternateInterface(iface.interfaceNumber, alternate.alternateSetting)
          }
          return endpoint.endpointNumber
        } catch (err) {
          connectionError = err
        }
      }
    }
  }

  if (connectionError) {
    const detail = connectionError instanceof Error ? connectionError.message : String(connectionError)
    throw new Error(`Could not access the USB printer interface: ${detail}`)
  }

  throw new Error("This device has no USB bulk or interrupt output endpoint. It may require a serial connection or the system printer driver.")
}

export async function requestWebUsbPrinter(binding?: {
  usbVendorId?: number
  usbProductId?: number
  usbSerialNumber?: string
}): Promise<{
  kind: "webusb"
  vendorId: number
  productId: number
  serialNumber?: string
}> {
  const usb = getUsb()
  if (!usb) throw new Error("WebUSB is not supported in this browser")
  const existing = binding
    ? await findDevice(binding.usbVendorId, binding.usbProductId, binding.usbSerialNumber)
    : null
  const device = existing || await usb.requestDevice({ filters: USB_FILTERS })
  cached = device
  try {
    await withUsbSession(device, () => claimBulkOut(device))
  } catch (err) {
    cached = null
    throw err
  }
  return {
    kind: "webusb",
    vendorId: device.vendorId,
    productId: device.productId,
    serialNumber: device.serialNumber,
  }
}

export async function warmWebUsbPrinter(
  vendorId?: number,
  productId?: number,
  serialNumber?: string,
): Promise<boolean> {
  const device = await findDevice(vendorId, productId, serialNumber)
  if (!device) return false
  try {
    await withUsbSession(device, () => claimBulkOut(device))
    return true
  } catch {
    if (cached === device) cached = null
    return false
  }
}

export async function writeWebUsbBytes(
  data: Uint8Array,
  vendorId?: number,
  productId?: number,
  serialNumber?: string,
  options?: { allowPrompt?: boolean },
): Promise<void> {
  const usb = getUsb()
  if (!usb) throw new Error("WebUSB is not supported in this browser")
  let device = await findDevice(vendorId, productId, serialNumber)
  if (!device) {
    if (options?.allowPrompt === false) {
      throw new Error("USB printer is not connected on this station")
    }
    device = await usb.requestDevice({ filters: USB_FILTERS })
    cached = device
  }
  const target = device
  try {
    await withUsbSession(target, async () => {
      const endpoint = await claimBulkOut(target)
      const chunkSize = 64
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize)
        const result = await target.transferOut(endpoint, chunk)
        if (result.status !== "ok" || result.bytesWritten !== chunk.length) {
          throw new Error("USB printer transfer failed or was incomplete")
        }
      }
    })
  } catch (err) {
    if (cached === device) cached = null
    throw err
  }
}

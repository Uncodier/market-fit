type UsbDeviceLike = {
  vendorId: number
  productId: number
  serialNumber?: string
  opened: boolean
  configuration?: { interfaces: UsbInterfaceLike[] } | null
  open: () => Promise<void>
  close: () => Promise<void>
  selectConfiguration: (value: number) => Promise<void>
  claimInterface: (n: number) => Promise<void>
  transferOut: (endpointNumber: number, data: BufferSource) => Promise<{ status: string }>
}

type UsbInterfaceLike = {
  claimed: boolean
  interfaceNumber: number
  alternates: {
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
  if (serialNumber && device.serialNumber && device.serialNumber !== serialNumber) return false
  if (vendorId != null && device.vendorId !== vendorId) return false
  if (productId != null && device.productId !== productId) return false
  return true
}

async function findDevice(
  vendorId?: number,
  productId?: number,
  serialNumber?: string,
): Promise<UsbDeviceLike | null> {
  if (cached && matches(cached, vendorId, productId, serialNumber)) return cached
  const usb = getUsb()
  if (!usb) return null
  const devices = await usb.getDevices()
  const found =
    devices.find((d) => matches(d, vendorId, productId, serialNumber)) || devices[0] || null
  if (found) cached = found
  return found
}

async function claimBulkOut(device: UsbDeviceLike): Promise<number> {
  if (!device.opened) await device.open()
  try {
    await device.selectConfiguration(1)
  } catch {
    // already configured
  }
  const interfaces = device.configuration?.interfaces || []
  for (const iface of interfaces) {
    const alternate = iface.alternates[0]
    const endpoint = alternate?.endpoints.find(
      (e) => e.direction === "out" && (e.type === "bulk" || e.type === "interrupt"),
    )
    if (!endpoint) continue
    if (!iface.claimed) {
      try {
        await device.claimInterface(iface.interfaceNumber)
      } catch {
        continue
      }
    }
    return endpoint.endpointNumber
  }
  throw new Error("No USB bulk endpoint found on this printer")
}

export async function requestWebUsbPrinter(): Promise<{
  kind: "webusb"
  vendorId: number
  productId: number
  serialNumber?: string
}> {
  const usb = getUsb()
  if (!usb) throw new Error("WebUSB is not supported in this browser")
  const device = await usb.requestDevice({ filters: USB_FILTERS })
  cached = device
  await claimBulkOut(device)
  return {
    kind: "webusb",
    vendorId: device.vendorId,
    productId: device.productId,
    serialNumber: device.serialNumber,
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
  const endpoint = await claimBulkOut(device)
  const chunkSize = 64
  for (let i = 0; i < data.length; i += chunkSize) {
    const result = await device.transferOut(endpoint, data.slice(i, i + chunkSize))
    if (result.status !== "ok") throw new Error("USB printer transfer failed")
  }
}

import { getPrinterBind } from "../core/bind-store"
import { hardwareFingerprint, stationOwnsPrinter } from "../core/station-claim"
import { isPrinterReadyOnStation } from "../core/station-status"
import type {
  PaperWidthMm,
  PrintJob,
  PrinterDevice,
  PrinterModule,
  PrintersSettings,
  WorkstationBind,
} from "../core/types"
import { printersForAutoPrint, printersForJob } from "../core/format"
import { encodeJob, htmlForJob } from "../templates"
import { printHtml } from "./browser-print"
import { warmWebUsbPrinter, writeWebUsbBytes } from "./web-usb"
import { warmUsbPrinter, writeUsbBytes } from "./web-serial"
import { warmBluetoothPrinter, writeBluetoothBytes } from "./web-bluetooth"

const automaticFlights = new Map<string, Promise<void>>()

/** Independent checkout/confirmation jobs must not interleave bytes on one device. */
async function printAutomatically(device: PrinterDevice, job: PrintJob): Promise<void> {
  const bind = getPrinterBind(device.id)
  const key = hardwareFingerprint(bind)
  const previous = automaticFlights.get(key) || Promise.resolve()
  const flight = previous.catch(() => {}).then(async () => {
    const current = getPrinterBind(device.id)
    if (!stationOwnsPrinter(device, current) || hardwareFingerprint(current) !== key) {
      throw new Error("Printer binding changed")
    }
    await printOnDevice(device, job, { allowPrompt: false })
  })
  automaticFlights.set(key, flight)
  try { await flight }
  finally { if (automaticFlights.get(key) === flight) automaticFlights.delete(key) }
}

async function writeUsb(bind: WorkstationBind | null, bytes: Uint8Array, allowPrompt: boolean) {
  if (bind?.usbKind === "webusb") {
    await writeWebUsbBytes(bytes, bind.usbVendorId, bind.usbProductId, bind.usbSerialNumber, {
      allowPrompt,
    })
    return
  }
  // Never replay a failed write via another driver: bytes may already be on paper.
  await writeUsbBytes(bytes, bind?.usbVendorId, bind?.usbProductId, {
    allowPrompt,
    baudRate: bind?.baudRate,
    serialNumber: bind?.usbSerialNumber,
    allowWebUsbFallback: bind?.usbKind !== "serial",
  })
}

export async function warmUsbPrinterConnection(
  bind: WorkstationBind | null | undefined,
): Promise<boolean> {
  if (bind?.usbKind === "webusb") {
    return warmWebUsbPrinter(
      bind.usbVendorId,
      bind.usbProductId,
      bind.usbSerialNumber,
    )
  }

  if (bind?.usbKind === "serial") {
    try {
      return await warmUsbPrinter(bind.usbVendorId, bind.usbProductId, bind.baudRate)
    } catch {
      return false
    }
  }

  try {
    const serialReady = await warmUsbPrinter(
      bind?.usbVendorId,
      bind?.usbProductId,
      bind?.baudRate,
    )
    if (serialReady) return true
  } catch {
    // Legacy bindings may have been created through WebUSB.
  }

  return warmWebUsbPrinter(
    bind?.usbVendorId,
    bind?.usbProductId,
    bind?.usbSerialNumber,
  )
}

export async function warmStationPrinters(settings: PrintersSettings | null | undefined): Promise<void> {
  for (const device of settings?.devices || []) {
    if (device.enabled === false) continue
    const bind = getPrinterBind(device.id)
    try {
      if (device.transport === "bluetooth") {
        await warmBluetoothPrinter(bind?.bluetoothDeviceId)
      } else if (device.transport === "usb") {
        await warmUsbPrinterConnection(bind)
      }
    } catch {
      // Keep going; print jobs will surface a real error.
    }
  }
}

export async function sendToDevice(
  device: PrinterDevice,
  bytes: Uint8Array,
  html: string,
  options?: { allowPrompt?: boolean },
): Promise<void> {
  const bind = getPrinterBind(device.id)
  const copies = Math.max(1, device.copies || 1)
  const allowPrompt = options?.allowPrompt !== false
  for (let i = 0; i < copies; i++) {
    if (device.transport === "usb") {
      await writeUsb(bind, bytes, allowPrompt)
    } else if (device.transport === "bluetooth") {
      await writeBluetoothBytes(bytes, bind?.bluetoothDeviceId, { allowPrompt })
    } else {
      await printHtml(html)
    }
  }
}

export async function printOnDevice(
  device: PrinterDevice,
  job: PrintJob,
  options?: { allowPrompt?: boolean },
): Promise<void> {
  const paper: PaperWidthMm = device.paperWidthMm || 80
  const bytes = encodeJob(job, paper)
  const html = htmlForJob(job, paper)
  await sendToDevice(device, bytes, html, options)
}

export async function printJobForSettings(
  settings: PrintersSettings | null | undefined,
  job: PrintJob,
  options?: {
    autoPrintFlag?: keyof PrinterDevice["autoPrint"]
    fallbackToSystem?: boolean
    allowPrompt?: boolean
    bestEffort?: boolean
  },
): Promise<boolean> {
  const devices = printersForJob(
    settings,
    job.module,
    job.template,
    options?.autoPrintFlag,
  ).filter((device) => {
    if (!options?.bestEffort) return isPrinterReadyOnStation(device)
    // Readiness can be stale; bound transports reconnect inside their write methods.
    return device.transport !== "system" && stationOwnsPrinter(device, getPrinterBind(device.id))
  })
  if (options?.bestEffort) {
    let allPrinted = devices.length > 0
    for (const device of devices) {
      try {
        // A binding may have changed while a previous device was printing.
        if (!stationOwnsPrinter(device, getPrinterBind(device.id))) {
          allPrinted = false
          continue
        }
        await printAutomatically(device, job)
      } catch {
        // Never replay a possibly partial write or fall back to another driver.
        allPrinted = false
      }
    }
    return allPrinted
  }
  if (devices.length === 0) {
    if (options?.fallbackToSystem === false) return false
    const paper: PaperWidthMm = 80
    await printHtml(htmlForJob(job, paper))
    return true
  }
  for (const device of devices) {
    await printOnDevice(device, job, { allowPrompt: options?.allowPrompt })
  }
  return true
}

export function autoPrintFlagForJob(
  job: PrintJob,
): keyof PrinterDevice["autoPrint"] | undefined {
  switch (job.template) {
    case "receipt":
      return "posReceipt"
    case "kitchen":
      return "kitchenTicket"
    case "kitchen-delta":
      return "orderDelta"
    case "inventory-label":
      return "inventoryLabel"
    default:
      return undefined
  }
}

export function shouldAutoPrint(
  settings: PrintersSettings | null | undefined,
  module: PrinterModule,
  flag: keyof PrinterDevice["autoPrint"],
): boolean {
  if (printersForAutoPrint(settings, module, flag).length > 0) return true
  if (flag === "kitchenTicket" || flag === "orderDelta") {
    return printersForJob(settings, "orders", "kitchen", flag).length > 0
  }
  return false
}

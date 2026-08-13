import { getPrinterBind } from "../core/bind-store"
import { isPrinterReadyOnStation } from "../core/station-status"
import type {
  PaperWidthMm,
  PrintJob,
  PrinterDevice,
  PrinterModule,
  PrintersSettings,
} from "../core/types"
import { printersForAutoPrint, printersForJob } from "../core/format"
import { encodeJob, htmlForJob } from "../templates"
import { printHtml } from "./browser-print"
import { isWebUsbSupported, writeWebUsbBytes } from "./web-usb"
import { warmUsbPrinter, writeUsbBytes } from "./web-serial"
import { warmBluetoothPrinter, writeBluetoothBytes } from "./web-bluetooth"

async function writeUsb(device: PrinterDevice, bytes: Uint8Array, allowPrompt: boolean) {
  const bind = getPrinterBind(device.id)
  if (bind?.usbKind === "webusb") {
    await writeWebUsbBytes(bytes, bind.usbVendorId, bind.usbProductId, bind.usbSerialNumber, {
      allowPrompt,
    })
    return
  }
  try {
    await writeUsbBytes(bytes, bind?.usbVendorId, bind?.usbProductId, {
      allowPrompt,
      baudRate: bind?.baudRate,
    })
  } catch (err) {
    if (!isWebUsbSupported()) throw err
    await writeWebUsbBytes(bytes, bind?.usbVendorId, bind?.usbProductId, bind?.usbSerialNumber, {
      allowPrompt,
    })
  }
}

export async function warmStationPrinters(settings: PrintersSettings | null | undefined): Promise<void> {
  for (const device of settings?.devices || []) {
    if (device.enabled === false) continue
    const bind = getPrinterBind(device.id)
    try {
      if (device.transport === "bluetooth") {
        await warmBluetoothPrinter(bind?.bluetoothDeviceId)
      } else if (device.transport === "usb") {
        await warmUsbPrinter(bind?.usbVendorId, bind?.usbProductId, bind?.baudRate)
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
      await writeUsb(device, bytes, allowPrompt)
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
  },
): Promise<boolean> {
  const devices = printersForJob(
    settings,
    job.module,
    job.template,
    options?.autoPrintFlag,
  ).filter(isPrinterReadyOnStation)
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

import { getPrinterBind } from "./bind-store"
import { stationOwnsPrinter } from "./station-claim"
import type { PrinterDevice, PrinterModule, PrintersSettings } from "./types"
import { printersForModule } from "./format"
import { isWebSerialSupported } from "../transports/web-serial"
import { isWebUsbSupported } from "../transports/web-usb"
import { isWebBluetoothSupported } from "../transports/web-bluetooth"

export type PrinterStationState =
  | "hidden"
  | "checking"
  | "ready"
  | "disconnected"
  | "unpaired"
  | "unsupported"

export type PrinterStationStatus = {
  state: PrinterStationState
  configured: number
  ready: number
}

export function isTransportSupported(device: PrinterDevice): boolean {
  if (device.transport === "usb") return isWebSerialSupported() || isWebUsbSupported()
  if (device.transport === "bluetooth") return isWebBluetoothSupported()
  return true
}

export function isPrinterReadyOnStation(device: PrinterDevice): boolean {
  if (device.enabled === false) return false
  if (device.transport === "system") return true
  return isTransportSupported(device) && stationOwnsPrinter(device, getPrinterBind(device.id))
}

export function printerStationStatus(
  settings: PrintersSettings | null | undefined,
  module: PrinterModule,
): PrinterStationStatus {
  const devices = printersForModule(settings, module)
  if (devices.length === 0) {
    return { state: "hidden", configured: 0, ready: 0 }
  }
  const ready = devices.filter(isPrinterReadyOnStation)
  if (ready.length > 0) {
    return { state: "ready", configured: devices.length, ready: ready.length }
  }
  const canPair = devices.some(
    (device) => device.transport === "system" || isTransportSupported(device),
  )
  return {
    state: canPair ? "unpaired" : "unsupported",
    configured: devices.length,
    ready: 0,
  }
}

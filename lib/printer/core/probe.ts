import { getPrinterBind } from "./bind-store"
import { printersForModule } from "./format"
import { isTransportSupported } from "./station-status"
import { stationOwnsPrinter } from "./station-claim"
import { getPrinterWorkstation } from "./workstation"
import type { PrinterDevice, PrinterModule, PrintersSettings, PrinterTransport } from "./types"
import { warmUsbPrinterConnection } from "../transports/dispatch"
import { warmBluetoothPrinter } from "../transports/web-bluetooth"

export type PrinterAidKind = "bluetooth" | "usb"

export type ProbeKind = "ok" | "unpaired" | "unsupported" | "fail"

export type ProbeRow = {
  kind: ProbeKind
  transport: PrinterTransport
  error?: string
}

export type ProbeOutcome = {
  state: "ready" | "disconnected" | "unpaired" | "unsupported"
  error?: string
  aid?: PrinterAidKind
}

export function classifyProbeRows(rows: ProbeRow[]): ProbeOutcome {
  const fail = rows.find((row) => row.kind === "fail")
  if (fail) {
    return {
      state: "disconnected",
      error: fail.error,
      aid: fail.transport === "usb" ? "usb" : "bluetooth",
    }
  }
  if (rows.some((row) => row.kind === "unpaired")) {
    const transport = rows.find((row) => row.kind === "unpaired")?.transport
    return {
      state: "unpaired",
      aid: transport === "usb" ? "usb" : "bluetooth",
    }
  }
  if (rows.length > 0 && rows.every((row) => row.kind === "unsupported")) {
    return { state: "unsupported" }
  }
  return { state: "ready" }
}

async function confirmDevice(
  device: PrinterDevice,
): Promise<void> {
  const bind = getPrinterBind(device.id)
  // Connection checks must never send a print job or consume paper.
  if (device.transport === "bluetooth") {
    const ok = await warmBluetoothPrinter(bind?.bluetoothDeviceId)
    if (!ok) throw new Error("Bluetooth printer is not connected on this computer")
  } else if (device.transport === "usb") {
    const ok = await warmUsbPrinterConnection(bind)
    if (!ok) throw new Error("USB printer is not connected on this computer")
  }
}

export async function probeModulePrinters(
  settings: PrintersSettings | null | undefined,
  module: PrinterModule,
): Promise<ProbeOutcome> {
  let devices = printersForModule(settings, module)
  
  // Filter out devices claimed by other workstations
  devices = devices.filter((device) => {
    const claim = device.station
    if (!claim?.workstationId) return true // Unclaimed
    return claim.workstationId === getPrinterWorkstation().id // Claimed by this workstation
  })

  const rows: ProbeRow[] = []
  for (const device of devices) {
    if (device.transport === "system") {
      rows.push({ kind: "ok", transport: device.transport })
      continue
    }
    if (!isTransportSupported(device)) {
      rows.push({ kind: "unsupported", transport: device.transport })
      continue
    }
    const bind = getPrinterBind(device.id)
    if (!stationOwnsPrinter(device, bind)) {
      rows.push({ kind: "unpaired", transport: device.transport })
      continue
    }
    try {
      await confirmDevice(device)
      rows.push({ kind: "ok", transport: device.transport })
    } catch (err) {
      rows.push({
        kind: "fail",
        transport: device.transport,
        error: err instanceof Error ? err.message : String(err ?? "Printer is not connected"),
      })
    }
  }
  return classifyProbeRows(rows)
}

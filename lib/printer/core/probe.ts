import { ticketCopy } from "./copy"
import { getPrinterBind } from "./bind-store"
import { printersForModule } from "./format"
import { isTransportSupported } from "./station-status"
import { printerSyncToken, stationOwnsPrinter } from "./station-claim"
import { getPrinterWorkstation } from "./workstation"
import type { PrinterDevice, PrinterModule, PrintersSettings, PrinterTransport } from "./types"
import { printOnDevice } from "../transports/dispatch"
import { warmBluetoothPrinter } from "../transports/web-bluetooth"
import { warmUsbPrinter } from "../transports/web-serial"

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

function syncKey(printerId: string, bind: ReturnType<typeof getPrinterBind>) {
  return `makinari-printer-sync:${printerSyncToken(printerId, bind)}`
}

function alreadySynced(printerId: string, bind: ReturnType<typeof getPrinterBind>) {
  if (typeof sessionStorage === "undefined") return false
  return sessionStorage.getItem(syncKey(printerId, bind)) === "ok"
}

function markSynced(printerId: string, bind: ReturnType<typeof getPrinterBind>) {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.setItem(syncKey(printerId, bind), "ok")
}

function clearSynced(printerId: string, bind: ReturnType<typeof getPrinterBind>) {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.removeItem(syncKey(printerId, bind))
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
  module: PrinterModule,
  locale?: string | null,
  forcePrint?: boolean,
): Promise<void> {
  const bind = getPrinterBind(device.id)
  const skipPaper = !forcePrint && alreadySynced(device.id, bind)
  if (skipPaper) {
    if (device.transport === "bluetooth") {
      const ok = await warmBluetoothPrinter(bind?.bluetoothDeviceId)
      if (!ok) throw new Error("Bluetooth printer is not connected on this computer")
      return
    }
    if (device.transport === "usb") {
      const ok = await warmUsbPrinter(bind?.usbVendorId, bind?.usbProductId, bind?.baudRate)
      if (!ok) throw new Error("USB printer is not connected on this computer")
      return
    }
    return
  }
  const copy = ticketCopy(locale)
  const station = getPrinterWorkstation()
  await printOnDevice(
    { ...device, copies: 1 },
    {
      id: `sync-${device.id}`,
      module,
      template: "test",
      payload: {
        printerName: device.name,
        locale,
        title: copy.stationSynced,
        stationName: device.station?.workstationName || station.name,
        hardwareName: device.station?.hardwareName || bind?.hardwareName || null,
      },
    },
    { allowPrompt: false },
  )
  markSynced(device.id, bind)
}

export async function probeModulePrinters(
  settings: PrintersSettings | null | undefined,
  module: PrinterModule,
  options?: { forcePrint?: boolean; locale?: string | null },
): Promise<ProbeOutcome> {
  const devices = printersForModule(settings, module)
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
      await confirmDevice(device, module, options?.locale, options?.forcePrint)
      rows.push({ kind: "ok", transport: device.transport })
    } catch (err) {
      clearSynced(device.id, bind)
      rows.push({
        kind: "fail",
        transport: device.transport,
        error: err instanceof Error ? err.message : String(err ?? "Printer is not connected"),
      })
    }
  }
  return classifyProbeRows(rows)
}

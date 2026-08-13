import type { PrinterDevice, PrinterStationClaim, WorkstationBind } from "./types"
import { getPrinterWorkstation } from "./workstation"

export function hardwareFingerprint(
  input: Pick<
    WorkstationBind,
    "bluetoothDeviceId" | "usbVendorId" | "usbProductId" | "usbSerialNumber"
  > | null | undefined,
): string {
  if (!input) return "none"
  if (input.bluetoothDeviceId) return `bt:${input.bluetoothDeviceId}`
  const usb = [
    input.usbVendorId ?? "",
    input.usbProductId ?? "",
    input.usbSerialNumber || "",
  ].join(":")
  return usb === "::" ? "none" : `usb:${usb}`
}

export function printerSyncToken(printerId: string, bind: WorkstationBind | null): string {
  const station = getPrinterWorkstation()
  return `${printerId}:${station.id}:${hardwareFingerprint(bind)}`
}

export function buildStationClaim(
  bind: WorkstationBind,
  extras?: { hardwareName?: string },
): PrinterStationClaim {
  const station = getPrinterWorkstation()
  return {
    workstationId: station.id,
    workstationName: station.name,
    hardwareName: extras?.hardwareName || bind.hardwareName,
    bluetoothDeviceId: bind.bluetoothDeviceId,
    usbVendorId: bind.usbVendorId,
    usbProductId: bind.usbProductId,
    usbKind: bind.usbKind,
    usbSerialNumber: bind.usbSerialNumber,
    boundAt: new Date().toISOString(),
  }
}

export function bindMatchesClaim(
  bind: WorkstationBind | null,
  claim?: PrinterStationClaim | null,
): boolean {
  if (!bind || !claim) return false
  if (claim.bluetoothDeviceId) {
    return Boolean(bind.bluetoothDeviceId) && bind.bluetoothDeviceId === claim.bluetoothDeviceId
  }
  if (claim.usbVendorId != null || claim.usbProductId != null) {
    return bind.usbVendorId === claim.usbVendorId && bind.usbProductId === claim.usbProductId
  }
  return hardwareFingerprint(bind) !== "none"
}

export function isClaimedByThisWorkstation(device: PrinterDevice): boolean {
  const claim = device.station
  if (!claim?.workstationId) return false
  return claim.workstationId === getPrinterWorkstation().id
}

export function stationOwnsPrinter(device: PrinterDevice, bind: WorkstationBind | null): boolean {
  if (device.transport === "system") return true
  if (!bind) return false
  if (!device.station?.workstationId) return hardwareFingerprint(bind) !== "none"
  return isClaimedByThisWorkstation(device) && bindMatchesClaim(bind, device.station)
}

export function claimNeedsUpdate(device: PrinterDevice, bind: WorkstationBind | null): boolean {
  if (!bind || device.transport === "system") return false
  const next = buildStationClaim(bind)
  const cur = device.station
  if (!cur?.workstationId) return true
  if (cur.workstationId !== next.workstationId) return true
  if ((cur.bluetoothDeviceId || "") !== (next.bluetoothDeviceId || "")) return true
  if ((cur.usbVendorId ?? null) !== (next.usbVendorId ?? null)) return true
  if ((cur.usbProductId ?? null) !== (next.usbProductId ?? null)) return true
  return false
}

export function withStationClaim(
  devices: PrinterDevice[],
  printerId: string,
  claim: PrinterStationClaim,
  extra?: Partial<PrinterDevice>,
): PrinterDevice[] {
  return devices.map((device) =>
    device.id === printerId ? { ...device, ...extra, station: claim } : device,
  )
}

export function renameClaimsForWorkstation(
  devices: PrinterDevice[],
  workstationId: string,
  workstationName: string,
): PrinterDevice[] {
  return devices.map((device) =>
    device.station?.workstationId === workstationId
      ? { ...device, station: { ...device.station, workstationName } }
      : device,
  )
}

export function usbHardwareName(vendorId?: number, productId?: number): string | undefined {
  if (vendorId == null && productId == null) return undefined
  const vid = vendorId != null ? vendorId.toString(16).padStart(4, "0") : "----"
  const pid = productId != null ? productId.toString(16).padStart(4, "0") : "----"
  return `USB ${vid}:${pid}`
}

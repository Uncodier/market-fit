import { createPrinterDevice } from "../../../lib/printer/core/types"
import {
  bindMatchesClaim,
  buildStationClaim,
  claimNeedsUpdate,
  hardwareFingerprint,
  printerSyncToken,
  stationOwnsPrinter,
} from "../../../lib/printer/core/station-claim"
import { setPrinterBind, clearPrinterBind } from "../../../lib/printer/core/bind-store"
import { printerStationStatus } from "../../../lib/printer/core/station-status"
import { encodeTestPrint } from "../../../lib/printer/templates/test"

const STATION_KEY = "makinari-printer-station"

describe("printer station claim", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem(STATION_KEY, JSON.stringify({ id: "ws-front", name: "Front counter" }))
    delete (navigator as { serial?: unknown }).serial
  })

  it("keeps station data when creating a printer from saved settings", () => {
    const device = createPrinterDevice({
      id: "p1",
      name: "Kitchen",
      station: {
        workstationId: "ws-front",
        workstationName: "Front counter",
        hardwareName: "TM-T20",
        bluetoothDeviceId: "bt-1",
      },
    })
    expect(device.station?.workstationId).toBe("ws-front")
    expect(device.station?.hardwareName).toBe("TM-T20")
  })

  it("builds a claim for this computer and hardware", () => {
    const claim = buildStationClaim({
      printerId: "p1",
      bluetoothDeviceId: "bt-1",
      hardwareName: "TM-T20",
    })
    expect(claim.workstationId).toBe("ws-front")
    expect(claim.workstationName).toBe("Front counter")
    expect(claim.bluetoothDeviceId).toBe("bt-1")
    expect(claim.hardwareName).toBe("TM-T20")
  })

  it("keys sync to this computer and the paired device", () => {
    const bind = { printerId: "p1", bluetoothDeviceId: "bt-1" }
    expect(printerSyncToken("p1", bind)).toBe("p1:ws-front:bt:bt-1")
    expect(hardwareFingerprint({ usbVendorId: 1, usbProductId: 2 })).toBe("usb:1:2:")
    expect(printerSyncToken("p1", { printerId: "p1", bluetoothDeviceId: "bt-2" })).not.toBe(
      printerSyncToken("p1", bind),
    )
  })

  it("does not treat another computer's printer as ready on this station", () => {
    Object.defineProperty(navigator, "serial", { configurable: true, value: {} })
    const usb = createPrinterDevice({
      id: "p-usb",
      transport: "usb",
      modules: { pos: true, orders: false, inventory: false },
      station: {
        workstationId: "ws-other",
        workstationName: "Kitchen PC",
        usbVendorId: 1,
        usbProductId: 2,
      },
    })
    setPrinterBind({ printerId: "p-usb", usbVendorId: 1, usbProductId: 2 })
    expect(stationOwnsPrinter(usb, { printerId: "p-usb", usbVendorId: 1, usbProductId: 2 })).toBe(false)
    expect(printerStationStatus({ devices: [usb] }, "pos").state).toBe("hidden")
    clearPrinterBind("p-usb")
  })

  it("owns the printer when this computer and hardware match", () => {
    const bind = { printerId: "p1", bluetoothDeviceId: "bt-1" }
    const device = createPrinterDevice({
      id: "p1",
      transport: "bluetooth",
      station: {
        workstationId: "ws-front",
        workstationName: "Front counter",
        bluetoothDeviceId: "bt-1",
      },
    })
    expect(bindMatchesClaim(bind, device.station)).toBe(true)
    expect(stationOwnsPrinter(device, bind)).toBe(true)
    expect(claimNeedsUpdate(device, bind)).toBe(false)
    expect(claimNeedsUpdate(device, { printerId: "p1", bluetoothDeviceId: "bt-2" })).toBe(true)
  })
})

describe("station sync ticket", () => {
  it("prints a translated confirm with computer and device", () => {
    const bytes = encodeTestPrint(
      {
        printerName: "Kitchen",
        locale: "es",
        stationName: "Caja principal",
        hardwareName: "TM-T20",
      },
      58,
    )
    const text = Buffer.from(bytes).toString("latin1")
    expect(text).toContain("Kitchen")
    expect(text).toContain("Vinculada a esta computadora")
    expect(text).toContain("Computadora")
    expect(text).toContain("Caja principal")
    expect(text).toContain("Dispositivo")
    expect(text).toContain("TM-T20")
    expect(text).toContain("Papel")
    expect(text).toContain("Lista para imprimir")
  })
})

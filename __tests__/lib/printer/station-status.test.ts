import { createPrinterDevice } from "../../../lib/printer/core/types"
import { printerStationStatus } from "../../../lib/printer/core/station-status"
import { printersForJob } from "../../../lib/printer/core/format"
import { classifyProbeRows } from "../../../lib/printer/core/probe"
import { setPrinterBind, clearPrinterBind } from "../../../lib/printer/core/bind-store"

describe("printerStationStatus", () => {
  beforeEach(() => {
    localStorage.clear()
    delete (navigator as { serial?: unknown }).serial
  })

  afterEach(() => {
    delete (navigator as { serial?: unknown }).serial
  })

  it("hides when no printer is assigned to the module", () => {
    const kitchen = createPrinterDevice({
      id: "p1",
      transport: "system",
      modules: { pos: false, orders: true, inventory: false },
    })
    expect(printerStationStatus({ devices: [kitchen] }, "pos").state).toBe("hidden")
  })

  it("is ready when a system printer is configured for the module", () => {
    const receipt = createPrinterDevice({
      id: "p1",
      transport: "system",
      modules: { pos: true, orders: false, inventory: false },
    })
    expect(printerStationStatus({ devices: [receipt] }, "pos")).toEqual({
      state: "ready",
      configured: 1,
      ready: 1,
    })
  })

  it("is unpaired when a USB printer is supported but not bound on this station", () => {
    Object.defineProperty(navigator, "serial", { configurable: true, value: {} })
    const usb = createPrinterDevice({
      id: "p-usb",
      transport: "usb",
      modules: { pos: true, orders: false, inventory: false },
    })
    expect(printerStationStatus({ devices: [usb] }, "pos").state).toBe("unpaired")
    setPrinterBind({ printerId: "p-usb", usbVendorId: 1, usbProductId: 2 })
    expect(printerStationStatus({ devices: [usb] }, "pos").state).toBe("ready")
    clearPrinterBind("p-usb")
  })

  it("is unsupported when USB or Bluetooth is not available in this browser", () => {
    const usb = createPrinterDevice({
      id: "p-usb",
      transport: "usb",
      modules: { pos: false, orders: false, inventory: true },
    })
    expect(printerStationStatus({ devices: [usb] }, "inventory").state).toBe("unsupported")
  })
})

describe("printersForJob", () => {
  it("falls back to orders printers for kitchen tickets when auto-print is off", () => {
    const kitchen = createPrinterDevice({
      id: "p1",
      transport: "system",
      modules: { pos: false, orders: true, inventory: false },
      autoPrint: {
        posReceipt: false,
        kitchenTicket: false,
        orderDelta: false,
        inventoryLabel: false,
      },
    })
    const settings = { devices: [kitchen] }
    expect(printersForJob(settings, "orders", "kitchen", "kitchenTicket")).toEqual([kitchen])
    expect(printersForJob(settings, "pos", "receipt", "posReceipt")).toEqual([])
  })
})

describe("classifyProbeRows", () => {
  it("marks a failed bluetooth probe as disconnected", () => {
    expect(
      classifyProbeRows([
        { kind: "fail", transport: "bluetooth", error: "Bluetooth printer is not connected on this station" },
      ]),
    ).toMatchObject({
      state: "disconnected",
      aid: "bluetooth",
    })
  })

  it("marks unpaired when the station has no bind", () => {
    expect(classifyProbeRows([{ kind: "unpaired", transport: "usb" }])).toMatchObject({
      state: "unpaired",
      aid: "usb",
    })
  })
})

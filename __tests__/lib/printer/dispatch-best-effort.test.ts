import { clearPrinterBind, setPrinterBind } from "@/lib/printer/core/bind-store"
import * as stationStatus from "@/lib/printer/core/station-status"
import { createPrinterDevice, type PrintJob, type PrinterDevice, type WorkstationBind } from "@/lib/printer/core/types"
import { printHtml } from "@/lib/printer/transports/browser-print"
import { printJobForSettings } from "@/lib/printer/transports/dispatch"

jest.mock("@/lib/printer/core/station-status", () => ({
  isPrinterReadyOnStation: jest.fn(),
}))
jest.mock("@/lib/printer/transports/browser-print", () => ({ printHtml: jest.fn() }))
jest.mock("@/lib/printer/templates", () => ({
  encodeJob: () => new Uint8Array([1, 2, 3, 4]),
  htmlForJob: () => "<p>Kitchen ticket</p>",
}))

const job: PrintJob = { id: "job", module: "orders", template: "kitchen", payload: { lines: [] } }
const usbBind: WorkstationBind = {
  printerId: "usb", workstationId: "front", usbVendorId: 1, usbProductId: 2,
  usbKind: "webusb", usbSerialNumber: "bound-usb",
}
const bluetoothBind: WorkstationBind = {
  printerId: "bluetooth", workstationId: "front", bluetoothDeviceId: "bound-bluetooth",
}
function printer(transport: PrinterDevice["transport"], overrides: Partial<PrinterDevice> = {}) {
  return createPrinterDevice({
    id: transport, transport, modules: { pos: false, orders: true, inventory: false },
    autoPrint: { posReceipt: false, kitchenTicket: true, orderDelta: false, inventoryLabel: false },
    ...overrides,
  })
}
const run = (devices: PrinterDevice[], options = {}) =>
  printJobForSettings({ devices }, job, { bestEffort: true, ...options })

function installUsb() {
  const device = {
    vendorId: 1, productId: 2, serialNumber: "bound-usb", opened: false,
    configuration: { interfaces: [{ claimed: false, interfaceNumber: 0,
      alternates: [{ endpoints: [{ direction: "out", endpointNumber: 1, type: "bulk" }] }],
    }] },
    open: jest.fn(async () => { device.opened = true }),
    close: jest.fn(async () => { device.opened = false }),
    selectConfiguration: jest.fn(), claimInterface: jest.fn(),
    transferOut: jest.fn(async (_endpoint: number, data: Uint8Array) => ({ status: "ok", bytesWritten: data.length })),
  }
  const api = { getDevices: jest.fn(async () => [device]), requestDevice: jest.fn() }
  Object.defineProperty(navigator, "usb", { configurable: true, value: api })
  return { device, api }
}
function installSerial() {
  const writer = { write: jest.fn<Promise<void>, [Uint8Array]>().mockResolvedValue(undefined), releaseLock: jest.fn() }
  const port = {
    getInfo: () => ({ usbVendorId: 1, usbProductId: 2 }),
    writable: null as { getWriter: () => typeof writer } | null,
    open: jest.fn(async () => { port.writable = { getWriter: () => writer } }),
    close: jest.fn(async () => { port.writable = null }),
  }
  const api = { getPorts: jest.fn(async () => [port]), requestPort: jest.fn() }
  Object.defineProperty(navigator, "serial", { configurable: true, value: api })
  return { port, writer, api }
}
function installBluetooth() {
  const write = jest.fn<Promise<void>, [ArrayBuffer]>().mockResolvedValue(undefined)
  const gatt = {
    connected: false, connect: jest.fn(), disconnect: jest.fn(),
    getPrimaryServices: async () => [{ getCharacteristics: async () => [{
      properties: { write: true }, writeValue: write,
    }] }],
  }
  gatt.connect.mockImplementation(async () => { gatt.connected = true; return gatt })
  const device = { id: "bound-bluetooth", gatt }
  const api = { getDevices: jest.fn(async () => [device]), requestDevice: jest.fn() }
  Object.defineProperty(navigator, "bluetooth", { configurable: true, value: api })
  return { gatt, write, api }
}
function removeApis() {
  for (const key of ["usb", "serial", "bluetooth"] as const) {
    delete (navigator as Navigator & { usb?: unknown; serial?: unknown; bluetooth?: unknown })[key]
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(stationStatus.isPrinterReadyOnStation).mockImplementation(
    jest.requireActual<typeof stationStatus>("@/lib/printer/core/station-status").isPrinterReadyOnStation,
  )
  localStorage.clear()
  localStorage.setItem("makinari-printer-station", JSON.stringify({ id: "front", name: "Front" }))
  removeApis()
})
afterEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
  removeApis()
})

it("serializes simultaneous automatic tickets on the same hardware", async () => {
  const { device } = installUsb()
  setPrinterBind(usbBind)
  let finish!: () => void
  device.transferOut.mockImplementationOnce(() => new Promise((resolve) => {
    finish = () => resolve({ status: "ok", bytesWritten: 4 })
  }))
  const first = run([printer("usb")])
  for (let i = 0; i < 15; i++) await Promise.resolve()
  const second = run([printer("usb")])
  for (let i = 0; i < 15; i++) await Promise.resolve()
  expect(device.transferOut).toHaveBeenCalledTimes(1)
  finish()
  await expect(first).resolves.toBe(true)
  await expect(second).resolves.toBe(true)
  expect(device.transferOut).toHaveBeenCalledTimes(2)
})


describe("binding changes during dispatch", () => {
  it("does not select arbitrary hardware if a later target loses its binding", async () => {
    const usb = installUsb()
    const bluetooth = installBluetooth()
    setPrinterBind(usbBind)
    setPrinterBind(bluetoothBind)
    usb.device.transferOut.mockImplementationOnce(async (_endpoint, data) => {
      clearPrinterBind("bluetooth")
      return { status: "ok", bytesWritten: data.length }
    })
    await expect(run([printer("usb"), printer("bluetooth")])).resolves.toBe(false)
    expect(bluetooth.api.getDevices).not.toHaveBeenCalled()
    expect(bluetooth.api.requestDevice).not.toHaveBeenCalled()
  })
})

describe("manual/default dispatch remains unchanged", () => {
  it.each([undefined, { bestEffort: false }])("retains readiness filtering and system fallback: %s", async (options) => {
    const usb = installUsb()
    setPrinterBind(usbBind)
    jest.mocked(stationStatus.isPrinterReadyOnStation).mockReturnValue(false)
    await expect(printJobForSettings({ devices: [printer("usb")] }, job, options)).resolves.toBe(true)
    expect(usb.device.transferOut).not.toHaveBeenCalled()
    expect(printHtml).toHaveBeenCalledTimes(1)
  })

  it("honors disabled fallback when no printers are ready", async () => {
    await expect(printJobForSettings(null, job, { fallbackToSystem: false })).resolves.toBe(false)
    expect(printHtml).not.toHaveBeenCalled()
  })

  it("still prints directly to a configured system printer", async () => {
    await expect(printJobForSettings({ devices: [printer("system")] }, job)).resolves.toBe(true)
    expect(printHtml).toHaveBeenCalledTimes(1)
  })

  it("still prompts for a missing bound device by default", async () => {
    const usb = installUsb()
    setPrinterBind(usbBind)
    usb.api.getDevices.mockResolvedValue([])
    usb.api.requestDevice.mockResolvedValue(usb.device)
    await expect(printJobForSettings({ devices: [printer("usb")] }, job)).resolves.toBe(true)
    expect(usb.api.requestDevice).toHaveBeenCalledTimes(1)
    expect(usb.device.transferOut).toHaveBeenCalledTimes(1)
  })

  it("still honors allowPrompt false and rejects transport errors", async () => {
    const usb = installUsb()
    setPrinterBind(usbBind)
    usb.api.getDevices.mockResolvedValue([])
    await expect(printJobForSettings({ devices: [printer("usb")] }, job, { allowPrompt: false })).rejects.toThrow("not connected")
    expect(usb.api.requestDevice).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })

  it("still stops on a device error rather than continuing or falling back", async () => {
    const usb = installUsb()
    const bluetooth = installBluetooth()
    setPrinterBind(usbBind)
    setPrinterBind(bluetoothBind)
    usb.device.transferOut.mockRejectedValueOnce(new Error("partial write"))
    await expect(printJobForSettings({ devices: [printer("usb"), printer("bluetooth"), printer("system")] }, job)).rejects.toThrow("partial write")
    expect(usb.device.transferOut).toHaveBeenCalledTimes(1)
    expect(bluetooth.write).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })
})


describe("best-effort target eligibility", () => {
  it.each([
    ["no binding", null, {}],
    ["empty USB identity", { printerId: "usb", workstationId: "front" }, {}],
    ["different local station", { ...usbBind, workstationId: "back" }, {}],
    ["different claimed station", usbBind, { station: { workstationId: "back", workstationName: "Back" } }],
    ["claim hardware mismatch", usbBind, { station: { workstationId: "front", workstationName: "Front", usbVendorId: 99 } }],
    ["wrong transport binding", { ...bluetoothBind, printerId: "usb" }, {}],
    ["disabled", usbBind, { enabled: false }],
    ["different module", usbBind, { modules: { pos: true, orders: false, inventory: false } }],
  ] as [string, WorkstationBind | null, Partial<PrinterDevice>][])("skips %s without selecting authorized unbound hardware", async (_label, bind, overrides) => {
    const usb = installUsb()
    const bluetooth = installBluetooth()
    if (bind) setPrinterBind(bind)
    await expect(run([printer("usb", overrides)])).resolves.toBe(false)
    expect(usb.api.getDevices).not.toHaveBeenCalled()
    expect(usb.api.requestDevice).not.toHaveBeenCalled()
    expect(bluetooth.api.getDevices).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })

  it("skips unbound Bluetooth and system printers even with authorized hardware", async () => {
    const bluetooth = installBluetooth()
    await expect(run([printer("bluetooth"), printer("system")])).resolves.toBe(false)
    expect(bluetooth.api.getDevices).not.toHaveBeenCalled()
    expect(bluetooth.api.requestDevice).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })

  it("accepts legacy local bindings without a workstation ID or driver kind", async () => {
    const usb = installUsb()
    setPrinterBind({ printerId: "usb", usbVendorId: 1, usbProductId: 2 })
    await expect(run([printer("usb")])).resolves.toBe(true)
    expect(usb.device.transferOut).toHaveBeenCalledTimes(1)
  })

  it("respects auto-print selection and excludes skipped devices from success accounting", async () => {
    const usb = installUsb()
    const bluetooth = installBluetooth()
    setPrinterBind(usbBind)
    setPrinterBind(bluetoothBind)
    const unflagged = printer("bluetooth")
    unflagged.autoPrint.kitchenTicket = false
    await expect(run([unflagged, printer("system"), printer("usb")], { autoPrintFlag: "kitchenTicket" })).resolves.toBe(true)
    expect(usb.device.transferOut).toHaveBeenCalledTimes(1)
    expect(bluetooth.write).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })

  it.each([null, undefined, { devices: [] }])("returns false with no configured targets (%s)", async (settings) => {
    await expect(printJobForSettings(settings, job, { bestEffort: true })).resolves.toBe(false)
    expect(printHtml).not.toHaveBeenCalled()
  })
})

describe("best-effort per-device completion", () => {
  it.each(["webusb", "serial", undefined, "bluetooth"] as const)("continues after a partial %s failure without replay or driver fallback", async (kind) => {
    const usb = installUsb()
    const serial = installSerial()
    const bluetooth = installBluetooth()
    setPrinterBind({ ...usbBind, usbKind: kind === "bluetooth" ? "webusb" : kind })
    setPrinterBind(bluetoothBind)
    const failure = new Error("Disconnected after potential bytes")
    if (kind === "webusb") usb.device.transferOut.mockRejectedValueOnce(failure)
    else if (kind === "bluetooth") bluetooth.write.mockRejectedValueOnce(failure)
    else serial.writer.write.mockRejectedValueOnce(failure)
    const failedTransport = kind === "bluetooth" ? "bluetooth" : "usb"
    const otherTransport = failedTransport === "usb" ? "bluetooth" : "usb"
    await expect(run([printer(failedTransport, { copies: 2 }), printer(otherTransport)])).resolves.toBe(false)
    if (kind === "webusb" || kind === "bluetooth") {
      expect(usb.device.transferOut).toHaveBeenCalledTimes(1)
      expect(serial.writer.write).not.toHaveBeenCalled()
    } else {
      expect(serial.writer.write).toHaveBeenCalledTimes(1)
      expect(usb.device.transferOut).not.toHaveBeenCalled()
    }
    expect(bluetooth.write).toHaveBeenCalledTimes(1)
    expect(printHtml).not.toHaveBeenCalled()
  })

  it.each(["all", "last fails", "both fail"])("returns true only when all targets and copies finish: %s", async (outcome) => {
    const usb = installUsb()
    const bluetooth = installBluetooth()
    setPrinterBind(usbBind)
    setPrinterBind(bluetoothBind)
    if (outcome !== "all") bluetooth.write.mockRejectedValue(new Error("offline"))
    if (outcome === "both fail") usb.device.transferOut.mockRejectedValue(new Error("offline"))
    await expect(run([printer("usb", { copies: 2 }), printer("bluetooth")])).resolves.toBe(outcome === "all")
    expect(usb.device.transferOut).toHaveBeenCalledTimes(outcome === "both fail" ? 1 : 2)
    expect(bluetooth.write).toHaveBeenCalledTimes(1)
    expect(printHtml).not.toHaveBeenCalled()
  })
})


describe("best-effort dispatch with real transports and mock browser hardware", () => {
  it.each(["webusb", "serial", "bluetooth"] as const)("reconnects bound %s despite stale readiness, without prompting", async (kind) => {
    const usb = installUsb()
    const serial = installSerial()
    const bluetooth = installBluetooth()
    const ready = jest.mocked(stationStatus.isPrinterReadyOnStation).mockReturnValue(false)
    const transport = kind === "bluetooth" ? "bluetooth" : "usb"
    setPrinterBind(kind === "bluetooth" ? bluetoothBind : { ...usbBind, usbKind: kind, baudRate: 19200 })

    await expect(run([printer(transport)], { allowPrompt: true, fallbackToSystem: true })).resolves.toBe(true)

    expect(ready).not.toHaveBeenCalled()
    if (kind === "webusb") {
      expect(usb.device.open).toHaveBeenCalledTimes(1)
      expect(usb.device.transferOut).toHaveBeenCalledTimes(1)
      expect(serial.writer.write).not.toHaveBeenCalled()
    } else if (kind === "serial") {
      expect(serial.port.open).toHaveBeenCalledWith({ baudRate: 19200 })
      expect(serial.writer.write).toHaveBeenCalledTimes(1)
      expect(usb.device.transferOut).not.toHaveBeenCalled()
    } else {
      expect(bluetooth.gatt.connect).toHaveBeenCalledTimes(1)
      expect(bluetooth.write).toHaveBeenCalledTimes(1)
    }
    expect(usb.api.requestDevice).not.toHaveBeenCalled()
    expect(serial.api.requestPort).not.toHaveBeenCalled()
    expect(bluetooth.api.requestDevice).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })

  it.each(["webusb", "serial", "bluetooth"] as const)("returns false for disconnected bound %s without prompting or system fallback", async (kind) => {
    const usb = installUsb()
    const serial = installSerial()
    const bluetooth = installBluetooth()
    usb.api.getDevices.mockResolvedValue([])
    serial.api.getPorts.mockResolvedValue([])
    bluetooth.api.getDevices.mockResolvedValue([])
    setPrinterBind(kind === "bluetooth"
      ? { ...bluetoothBind, bluetoothDeviceId: "never-connected" }
      : { ...usbBind, usbKind: kind })

    await expect(run([printer(kind === "bluetooth" ? "bluetooth" : "usb")], {
      allowPrompt: true, fallbackToSystem: true,
    })).resolves.toBe(false)
    expect(usb.api.requestDevice).not.toHaveBeenCalled()
    expect(serial.api.requestPort).not.toHaveBeenCalled()
    expect(bluetooth.api.requestDevice).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })

  it.each(["usb", "bluetooth"] as const)("returns false when the bound %s API is unsupported", async (transport) => {
    setPrinterBind(transport === "usb" ? usbBind : bluetoothBind)
    await expect(run([printer(transport)])).resolves.toBe(false)
    expect(printHtml).not.toHaveBeenCalled()
  })
})

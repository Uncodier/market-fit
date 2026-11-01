import { printRegisterReport } from "@/app/pos/register/print-register-report"
import { setPrinterBind } from "@/lib/printer/core/bind-store"
import { createPrinterDevice } from "@/lib/printer/core/types"
import { printHtml } from "@/lib/printer/transports/browser-print"
import { closedRegisterSession, registerSummary } from "../../pos/register-ui-fixtures"

jest.mock("@/lib/printer/transports/browser-print", () => ({ printHtml: jest.fn() }))

const printer = createPrinterDevice({ id: "report", transport: "usb", modules: { pos: true, orders: false, inventory: false } })
const system = { ...printer, id: "system", transport: "system" as const }
const bind = { printerId: printer.id, usbVendorId: 1, usbProductId: 2 }
const run = (devices = [printer, system]) => printRegisterReport(closedRegisterSession, registerSummary, "Store", { devices })

function installUsb() {
  const device = {
    vendorId: 1, productId: 2, opened: true,
    configuration: { interfaces: [{ claimed: true, interfaceNumber: 0,
      alternates: [{ endpoints: [{ direction: "out", endpointNumber: 1, type: "bulk" }] }],
    }] },
    transferOut: jest.fn(async (_endpoint: number, data: Uint8Array) => ({ status: "ok", bytesWritten: data.length })),
  }
  const api = { getDevices: jest.fn(async () => [device]), requestDevice: jest.fn() }
  Object.defineProperty(navigator, "usb", { configurable: true, value: api })
  return { device, api }
}

function installSerial() {
  const writer = { write: jest.fn<Promise<void>, [Uint8Array]>().mockResolvedValue(undefined), releaseLock: jest.fn() }
  const port = { getInfo: () => ({ usbVendorId: 1, usbProductId: 2 }),
    open: jest.fn(), close: jest.fn(), writable: { getWriter: () => writer } }
  const api = { getPorts: jest.fn(async () => [port]), requestPort: jest.fn() }
  Object.defineProperty(navigator, "serial", { configurable: true, value: api })
  return { writer, port, api }
}

describe("manual report transport safety (mock browser devices only)", () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
    for (const key of ["usb", "serial", "bluetooth"] as const) {
      delete (navigator as Navigator & { usb?: unknown; serial?: unknown; bluetooth?: unknown })[key]
    }
  })
  afterEach(() => {
    for (const key of ["usb", "serial", "bluetooth"] as const) {
      delete (navigator as Navigator & { usb?: unknown; serial?: unknown; bluetooth?: unknown })[key]
    }
  })

  it.each(["usb", "bluetooth"] as const)("Safari-like missing APIs block configured %s without system fallback", async (transport) => {
    setPrinterBind({ ...bind, bluetoothDeviceId: transport === "bluetooth" ? "bt" : undefined })
    await expect(run([{ ...printer, transport }, system])).rejects.toThrow("not ready")
    expect(printHtml).not.toHaveBeenCalled()
  })

  it("allows explicit system printing without direct APIs", async () => {
    await expect(run([system])).resolves.toBe("system")
    expect(printHtml).toHaveBeenCalledWith(expect.stringContaining("Cash Register Report"))
  })

  it.each(["serial", undefined] as const)("does not replay a failed serial write through USB (binding %s)", async (usbKind) => {
    const serial = installSerial()
    const usb = installUsb()
    setPrinterBind({ ...bind, usbKind })
    serial.writer.write.mockRejectedValueOnce(new Error("Disconnected after partial write"))
    await expect(run()).rejects.toThrow("Output may be partial")
    expect(serial.writer.write).toHaveBeenCalledTimes(1)
    expect(usb.device.transferOut).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })

  it("does not switch a saved serial binding to WebUSB when its port is absent", async () => {
    const usb = installUsb()
    setPrinterBind({ ...bind, usbKind: "serial" })
    await expect(run()).rejects.toThrow("not supported")
    expect(usb.device.transferOut).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })

  it.each(["short", "stall", "reject"])("stops at a %s USB transfer, with no next copy or fallback", async (failure) => {
    const { device } = installUsb()
    setPrinterBind({ ...bind, usbKind: "webusb" })
    device.transferOut.mockResolvedValueOnce({ status: "ok", bytesWritten: 64 })
    if (failure === "reject") device.transferOut.mockRejectedValueOnce(new Error("Disconnected"))
    else device.transferOut.mockResolvedValueOnce({ status: failure === "stall" ? "stall" : "ok", bytesWritten: 2 })
    await expect(run([{ ...printer, copies: 2 }, system])).rejects.toThrow("Output may be partial")
    expect(device.transferOut).toHaveBeenCalledTimes(2)
    expect(printHtml).not.toHaveBeenCalled()
  })

  it("never prompts or retries after a legacy WebUSB write fails", async () => {
    const usb = installUsb()
    const serial = installSerial()
    serial.api.getPorts.mockResolvedValue([])
    setPrinterBind(bind)
    usb.device.transferOut.mockRejectedValueOnce(new Error("Partial transfer"))
    await expect(run()).rejects.toThrow("Partial transfer")
    expect(usb.device.transferOut).toHaveBeenCalledTimes(1)
    expect(serial.api.requestPort).not.toHaveBeenCalled()
    expect(usb.api.requestDevice).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })

  it("stops a partial Bluetooth report without retrying or opening system print", async () => {
    const write = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("BLE disconnected"))
    const device = { id: "partial-report-bt", gatt: { connected: true,
      getPrimaryServices: async () => [{ getCharacteristics: async () => [{
        properties: { write: true }, writeValue: write,
      }] }],
    } }
    const requestDevice = jest.fn()
    Object.defineProperty(navigator, "bluetooth", { configurable: true,
      value: { getDevices: async () => [device], requestDevice } })
    setPrinterBind({ printerId: printer.id, bluetoothDeviceId: device.id })
    await expect(run([{ ...printer, transport: "bluetooth", copies: 2 }, system])).rejects.toThrow("Output may be partial")
    expect(write).toHaveBeenCalledTimes(2)
    expect(requestDevice).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })

  it.each(["serial", "webusb"] as const)("rejects ambiguous same-model %s devices", async (usbKind) => {
    const usb = installUsb()
    const serial = installSerial()
    usb.api.getDevices.mockResolvedValue([usb.device, { ...usb.device }])
    serial.api.getPorts.mockResolvedValue([serial.port, { ...serial.port }])
    setPrinterBind({ ...bind, usbKind })
    await expect(run()).rejects.toThrow("Multiple")
    expect(usb.device.transferOut).not.toHaveBeenCalled()
    expect(serial.writer.write).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })

  it("keeps the original binding across copies if local settings change during output", async () => {
    const { device, api } = installUsb()
    setPrinterBind({ ...bind, usbKind: "webusb" })
    device.transferOut.mockImplementationOnce(async (_endpoint, data) => {
      setPrinterBind({ ...bind, usbVendorId: 99, usbKind: "webusb" })
      return { status: "ok", bytesWritten: data.length }
    })
    await expect(run([{ ...printer, copies: 2 }])).resolves.toBe("printer")
    expect(api.getDevices).toHaveBeenCalledTimes(2)
    expect(api.requestDevice).not.toHaveBeenCalled()
  })

  it("does not retarget an in-flight report when the caller replaces site settings or data", async () => {
    const { device, api } = installUsb()
    let release!: (devices: typeof device[]) => void
    api.getDevices.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    setPrinterBind({ ...bind, usbKind: "webusb" })
    const settings = { devices: [printer] }
    const session = { ...closedRegisterSession, snapshot: { ...registerSummary } }
    const pending = printRegisterReport(session, registerSummary, "Original store", settings)
    settings.devices = [system]
    session.site_id = "other-site"
    session.snapshot.expected_amount = 999
    release([device])
    await expect(pending).resolves.toBe("printer")
    const bytes = Buffer.concat(device.transferOut.mock.calls.map(([, data]) => Buffer.from(data))).toString("ascii")
    expect(bytes).toContain("Site ID: site-1")
    expect(bytes).toContain("Original store")
    expect(bytes).not.toContain("other-site")
    expect(bytes).not.toContain("$999.00")
    expect(printHtml).not.toHaveBeenCalled()
  })
})
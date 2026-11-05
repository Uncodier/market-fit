import { requestUsbPrinter } from "@/lib/printer/transports/web-serial"
import { requestWebUsbPrinter, writeWebUsbBytes } from "@/lib/printer/transports/web-usb"

const binding = { printerId: "receipt", usbVendorId: 1, usbProductId: 2 }

function installDevices() {
  const alternate = {
    alternateSetting: 0,
    endpoints: [{ direction: "out", type: "bulk", endpointNumber: 1 }],
  }
  const iface = { claimed: false, interfaceNumber: 0, alternate, alternates: [alternate] }
  const device = {
    vendorId: 1, productId: 2, serialNumber: "receipt-1", opened: false,
    configuration: { interfaces: [iface] } as { interfaces: typeof iface[] } | null,
    configurations: [{ configurationValue: 3 }],
    open: jest.fn(async () => { device.opened = true }),
    close: jest.fn(async () => { device.opened = false }),
    selectConfiguration: jest.fn(async () => { device.configuration = { interfaces: [iface] } }),
    claimInterface: jest.fn(async () => { iface.claimed = true }),
    selectAlternateInterface: jest.fn(async (_interfaceNumber: number, setting: number) => {
      iface.alternate = iface.alternates.find(a => a.alternateSetting === setting)!
    }),
    transferOut: jest.fn(async (_endpoint: number, data: Uint8Array) => ({ status: "ok", bytesWritten: data.length })),
  }
  const port = {
    getInfo: () => ({ usbVendorId: 1, usbProductId: 2 }),
    open: jest.fn(async () => undefined), close: jest.fn(async () => undefined),
    writable: { getWriter: () => ({ write: jest.fn(), releaseLock: jest.fn() }) },
  }
  const usb = { getDevices: jest.fn(async () => [device]), requestDevice: jest.fn(async () => device) }
  const serial = { getPorts: jest.fn(async () => [port]), requestPort: jest.fn(async () => port) }
  Object.defineProperty(navigator, "usb", { configurable: true, value: usb })
  Object.defineProperty(navigator, "serial", { configurable: true, value: serial })
  return { device, iface, port, usb, serial }
}

afterEach(() => {
  delete (navigator as Navigator & { usb?: unknown }).usb
  delete (navigator as Navigator & { serial?: unknown }).serial
})

describe("saved USB printer reconnection (mock browser hardware)", () => {
  it.each(["serial", undefined] as const)("reuses an authorized %s port without either chooser", async (usbKind) => {
    const { port, usb, serial, device } = installDevices()
    await expect(requestUsbPrinter({ ...binding, usbKind, baudRate: 19200 })).resolves.toMatchObject({
      kind: "serial", vendorId: 1, productId: 2, baudRate: 19200,
    })
    expect(port.open).toHaveBeenCalledWith({ baudRate: 19200 })
    expect(usb.requestDevice).not.toHaveBeenCalled()
    expect(serial.requestPort).not.toHaveBeenCalled()
    expect(device.open).not.toHaveBeenCalled()
  })

  it("reuses the saved WebUSB device, not an available serial port", async () => {
    const { device, usb, serial, port } = installDevices()
    await expect(requestUsbPrinter({ ...binding, usbKind: "webusb", usbSerialNumber: "receipt-1" }))
      .resolves.toMatchObject({ kind: "webusb", serialNumber: "receipt-1" })
    expect(device.claimInterface).toHaveBeenCalledWith(0)
    expect(usb.requestDevice).not.toHaveBeenCalled()
    expect(serial.requestPort).not.toHaveBeenCalled()
    expect(port.open).not.toHaveBeenCalled()
    expect(device.transferOut).not.toHaveBeenCalled()
  })

  it("recovers a legacy WebUSB binding when no serial port is authorized", async () => {
    const { usb, serial } = installDevices()
    serial.getPorts.mockResolvedValue([])
    await expect(requestUsbPrinter(binding)).resolves.toMatchObject({ kind: "webusb" })
    expect(usb.requestDevice).not.toHaveBeenCalled()
    expect(serial.requestPort).not.toHaveBeenCalled()
  })

  it("opens only the serial chooser if its saved permission is missing", async () => {
    const { usb, serial } = installDevices()
    serial.getPorts.mockResolvedValue([])
    await requestUsbPrinter({ ...binding, usbKind: "serial" })
    expect(serial.requestPort).toHaveBeenCalledTimes(1)
    expect(usb.requestDevice).not.toHaveBeenCalled()
  })

  it("does not silently reuse a different WebUSB device", async () => {
    const { device, usb } = installDevices()
    device.serialNumber = "different-printer"
    usb.requestDevice.mockRejectedValue(new DOMException("No device selected", "NotFoundError"))
    await expect(requestUsbPrinter({ ...binding, usbKind: "webusb", usbSerialNumber: "receipt-1" }))
      .rejects.toThrow("No device selected")
    expect(device.open).not.toHaveBeenCalled()
  })

  it("rejects ambiguous saved ports without selecting or opening one", async () => {
    const { port, usb, serial } = installDevices()
    serial.getPorts.mockResolvedValue([port, { ...port }])
    await expect(requestUsbPrinter({ ...binding, usbKind: "serial" })).rejects.toThrow("Multiple")
    expect(port.open).not.toHaveBeenCalled()
    expect(usb.requestDevice).not.toHaveBeenCalled()
    expect(serial.requestPort).not.toHaveBeenCalled()
  })

  it("preserves an access error instead of reporting a nonexistent endpoint or changing transport", async () => {
    const { device, usb, serial } = installDevices()
    device.claimInterface.mockRejectedValue(new Error("Interface busy"))
    await expect(requestUsbPrinter({ ...binding, usbKind: "webusb" }))
      .rejects.toThrow("Could not access the USB printer interface: Interface busy")
    expect(device.close).toHaveBeenCalled()
    expect(usb.requestDevice).not.toHaveBeenCalled()
    expect(serial.requestPort).not.toHaveBeenCalled()
  })
})

describe("USB interface preparation", () => {
  it("selects the advertised configuration rather than assuming configuration 1", async () => {
    const { device } = installDevices()
    device.configuration = null
    await requestWebUsbPrinter(binding)
    expect(device.selectConfiguration).toHaveBeenCalledWith(3)
  })

  it("activates the output alternate before transferring bytes", async () => {
    const { device, iface, usb } = installDevices()
    iface.alternate.endpoints = []
    iface.alternates.push({ alternateSetting: 1, endpoints: [{ direction: "out", type: "bulk", endpointNumber: 2 }] })
    device.transferOut.mockImplementation(async (endpoint, data) => {
      expect(iface.alternate.alternateSetting).toBe(1)
      expect(endpoint).toBe(2)
      return { status: "ok", bytesWritten: data.length }
    })
    await writeWebUsbBytes(new Uint8Array([1, 2]), 1, 2, "receipt-1", { allowPrompt: false })
    expect(device.selectAlternateInterface).toHaveBeenCalledWith(0, 1)
    expect(device.transferOut).toHaveBeenCalledTimes(1)
    expect(usb.requestDevice).not.toHaveBeenCalled()
  })

  it("does not send bulk transfers to an isochronous endpoint", async () => {
    const { device, iface } = installDevices()
    iface.alternate.endpoints[0].type = "isochronous"
    await expect(requestWebUsbPrinter(binding)).rejects.toThrow("no USB bulk or interrupt output endpoint")
    expect(device.transferOut).not.toHaveBeenCalled()
  })

  it("retains configuration errors instead of reporting a missing endpoint", async () => {
    const { device } = installDevices()
    device.configuration = null
    device.selectConfiguration.mockRejectedValue(new Error("Configuration denied"))
    await expect(requestWebUsbPrinter(binding)).rejects.toThrow("Configuration denied")
    expect(device.close).toHaveBeenCalled()
  })
})
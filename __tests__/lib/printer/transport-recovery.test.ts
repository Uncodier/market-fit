import { createPrinterDevice } from "../../../lib/printer/core/types"
import { setPrinterBind } from "../../../lib/printer/core/bind-store"
import { printerSyncToken } from "../../../lib/printer/core/station-claim"
import { probeModulePrinters } from "../../../lib/printer/core/probe"
import { warmBluetoothPrinter } from "../../../lib/printer/transports/web-bluetooth"
import { warmUsbPrinter } from "../../../lib/printer/transports/web-serial"
import { warmWebUsbPrinter } from "../../../lib/printer/transports/web-usb"

const STATION_KEY = "makinari-printer-station"

function createUsbDevice(vendorId = 1, productId = 2) {
  const printerInterface = {
    claimed: false,
    interfaceNumber: 0,
    alternates: [
      {
        endpoints: [{ direction: "out", endpointNumber: 1, type: "bulk" }],
      },
    ],
  }
  const device = {
    vendorId,
    productId,
    serialNumber: "printer-1",
    opened: false,
    configuration: { interfaces: [printerInterface] },
    open: jest.fn(async () => {
      device.opened = true
    }),
    close: jest.fn(async () => {
      device.opened = false
    }),
    selectConfiguration: jest.fn(async () => undefined),
    claimInterface: jest.fn(async () => {
      printerInterface.claimed = true
    }),
    transferOut: jest.fn(async () => ({ status: "ok" })),
  }
  return device
}

describe("printer transport recovery", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem(STATION_KEY, JSON.stringify({ id: "ws-front", name: "Front" }))
    delete (navigator as Navigator & { bluetooth?: unknown }).bluetooth
    delete (navigator as Navigator & { serial?: unknown }).serial
    delete (navigator as Navigator & { usb?: unknown }).usb
  })

  afterEach(() => {
    delete (navigator as Navigator & { bluetooth?: unknown }).bluetooth
    delete (navigator as Navigator & { serial?: unknown }).serial
    delete (navigator as Navigator & { usb?: unknown }).usb
  })

  it("probes a saved WebUSB printer through WebUSB instead of Web Serial", async () => {
    const usbDevice = createUsbDevice()
    Object.defineProperty(navigator, "usb", {
      configurable: true,
      value: {
        getDevices: jest.fn(async () => [usbDevice]),
        requestDevice: jest.fn(),
      },
    })
    const bind = {
      printerId: "p-webusb",
      workstationId: "ws-front",
      usbVendorId: 1,
      usbProductId: 2,
      usbKind: "webusb" as const,
      usbSerialNumber: "printer-1",
    }
    setPrinterBind(bind)
    sessionStorage.setItem(`makinari-printer-sync:${printerSyncToken(bind.printerId, bind)}`, "ok")
    const printer = createPrinterDevice({
      id: bind.printerId,
      transport: "usb",
      modules: { pos: true, orders: false, inventory: false },
      station: {
        workstationId: "ws-front",
        workstationName: "Front",
        usbVendorId: 1,
        usbProductId: 2,
        usbKind: "webusb",
        usbSerialNumber: "printer-1",
      },
    })

    await expect(probeModulePrinters({ devices: [printer] }, "pos")).resolves.toEqual({
      state: "ready",
    })
    expect(usbDevice.open).toHaveBeenCalledTimes(1)
  })

  it("replaces a stale cached WebUSB device with the currently authorized device", async () => {
    const first = createUsbDevice()
    const replacement = createUsbDevice()
    let authorized = [first]
    Object.defineProperty(navigator, "usb", {
      configurable: true,
      value: {
        getDevices: jest.fn(async () => authorized),
        requestDevice: jest.fn(),
      },
    })

    await expect(warmWebUsbPrinter(1, 2, "printer-1")).resolves.toBe(true)
    authorized = [replacement]
    await expect(warmWebUsbPrinter(1, 2, "printer-1")).resolves.toBe(true)

    expect(first.open).toHaveBeenCalledTimes(1)
    expect(replacement.open).toHaveBeenCalledTimes(1)
  })

  it("does not use a different authorized WebUSB device", async () => {
    const otherPrinter = createUsbDevice(9, 9)
    Object.defineProperty(navigator, "usb", {
      configurable: true,
      value: {
        getDevices: jest.fn(async () => [otherPrinter]),
        requestDevice: jest.fn(),
      },
    })

    await expect(warmWebUsbPrinter(1, 2, "printer-1")).resolves.toBe(false)
    expect(otherPrinter.open).not.toHaveBeenCalled()
  })

  it("reopens a Web Serial port when its state or baud rate changes", async () => {
    const writable = () => ({
      getWriter: jest.fn(() => ({
        write: jest.fn(),
        releaseLock: jest.fn(),
      })),
    })
    const port = {
      writable: null as ReturnType<typeof writable> | null,
      open: jest.fn(async () => {
        port.writable = writable()
      }),
      close: jest.fn(async () => {
        port.writable = null
      }),
      getInfo: jest.fn(() => ({ usbVendorId: 1, usbProductId: 2 })),
    }
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: {
        getPorts: jest.fn(async () => [port]),
        requestPort: jest.fn(),
      },
    })

    await expect(warmUsbPrinter(1, 2)).resolves.toBe(true)
    port.writable = null
    await expect(warmUsbPrinter(1, 2)).resolves.toBe(true)
    await expect(warmUsbPrinter(1, 2, 19200)).resolves.toBe(true)

    expect(port.close).toHaveBeenCalledTimes(2)
    expect(port.open).toHaveBeenCalledTimes(3)
    expect(port.open).toHaveBeenLastCalledWith({ baudRate: 19200 })
  })

  it("retries a transient Bluetooth GATT connection failure", async () => {
    const gatt = {
      connected: false,
      connect: jest.fn(),
      getPrimaryServices: jest.fn(async () => []),
      disconnect: jest.fn(),
    }
    gatt.connect.mockImplementation(async () => {
      if (gatt.connect.mock.calls.length === 1) {
        throw new Error("GATT connection failed")
      }
      gatt.connected = true
      return gatt
    })
    const device = {
      id: "bt-retry",
      name: "Kitchen printer",
      gatt,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: {
        getDevices: jest.fn(async () => [device]),
        requestDevice: jest.fn(),
      },
    })

    await expect(warmBluetoothPrinter(device.id)).resolves.toBe(true)
    expect(gatt.connect).toHaveBeenCalledTimes(2)
  })

  it("automatically reconnects after a Bluetooth disconnect event", async () => {
    let onDisconnected: (() => void) | undefined
    const gatt = {
      connected: true,
      connect: jest.fn(),
      getPrimaryServices: jest.fn(async () => []),
      disconnect: jest.fn(),
    }
    gatt.connect.mockImplementation(async () => {
      gatt.connected = true
      return gatt
    })
    const device = {
      id: "bt-disconnect",
      name: "Receipt printer",
      gatt,
      addEventListener: jest.fn((type: string, listener: () => void) => {
        if (type === "gattserverdisconnected") onDisconnected = listener
      }),
      removeEventListener: jest.fn(),
    }
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: {
        getDevices: jest.fn(async () => [device]),
        requestDevice: jest.fn(),
      },
    })

    await expect(warmBluetoothPrinter(device.id)).resolves.toBe(true)
    gatt.connected = false
    onDisconnected?.()
    await Promise.resolve()

    expect(gatt.connect).toHaveBeenCalledTimes(1)
    expect(gatt.connected).toBe(true)
  })
})

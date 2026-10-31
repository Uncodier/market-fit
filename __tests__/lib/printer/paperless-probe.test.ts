import { probeModulePrinters } from "@/lib/printer/core/probe"
import { createPrinterDevice } from "@/lib/printer/core/types"
import { setPrinterBind } from "@/lib/printer/core/bind-store"
import { printOnDevice, warmUsbPrinterConnection } from "@/lib/printer/transports/dispatch"
import { warmBluetoothPrinter } from "@/lib/printer/transports/web-bluetooth"

jest.mock("@/lib/printer/transports/dispatch", () => ({
  printOnDevice: jest.fn(),
  warmUsbPrinterConnection: jest.fn(),
}))
jest.mock("@/lib/printer/transports/web-bluetooth", () => ({
  isWebBluetoothSupported: () => true,
  warmBluetoothPrinter: jest.fn(),
}))
jest.mock("@/lib/printer/transports/web-usb", () => ({ isWebUsbSupported: () => true }))

describe("paperless printer connection checks", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it.each(["usb", "bluetooth"] as const)("checks %s on first connection and reconnection without printing", async (transport) => {
    const printer = createPrinterDevice({
      id: "printer",
      transport,
      modules: { pos: true, orders: false, inventory: false },
    })
    setPrinterBind({ printerId: printer.id, usbVendorId: 1, usbProductId: 2, bluetoothDeviceId: "ble-1" })
    const warm = transport === "usb" ? jest.mocked(warmUsbPrinterConnection) : jest.mocked(warmBluetoothPrinter)
    warm.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    await expect(probeModulePrinters({ devices: [printer] }, "pos")).resolves.toEqual({ state: "ready" })
    await expect(probeModulePrinters({ devices: [printer] }, "pos")).resolves.toMatchObject({ state: "disconnected" })
    await expect(probeModulePrinters({ devices: [printer] }, "pos")).resolves.toEqual({ state: "ready" })

    expect(warm).toHaveBeenCalledTimes(3)
    expect(printOnDevice).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0)
  })
})
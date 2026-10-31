import { setPrinterBind } from "@/lib/printer/core/bind-store"
import { createPrinterDevice, type PrintJob } from "@/lib/printer/core/types"
import { printOnDevice } from "@/lib/printer/transports/dispatch"
import { printHtml } from "@/lib/printer/transports/browser-print"

jest.mock("@/lib/printer/transports/browser-print", () => ({ printHtml: jest.fn() }))

describe("direct USB receipt output", () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete (navigator as Navigator & { usb?: unknown }).usb
  })

  it.each([58, 80] as const)("sends ESC/POS instead of HTML or PostScript on %i mm paper", async (paperWidthMm) => {
    const chunks: Uint8Array[] = []
    const requestDevice = jest.fn()
    const device = {
      vendorId: 1,
      productId: 2,
      serialNumber: "receipt-usb",
      opened: true,
      configuration: {
        interfaces: [{
          claimed: true,
          interfaceNumber: 0,
          alternates: [{ endpoints: [{ direction: "out", endpointNumber: 1, type: "bulk" }] }],
        }],
      },
      transferOut: jest.fn(async (_endpoint: number, data: Uint8Array) => {
        chunks.push(data)
        return { status: "ok" }
      }),
    }
    Object.defineProperty(navigator, "usb", {
      configurable: true,
      value: { getDevices: jest.fn(async () => [device]), requestDevice },
    })
    const printer = createPrinterDevice({ id: "usb-receipt", transport: "usb", paperWidthMm })
    setPrinterBind({
      printerId: printer.id,
      usbKind: "webusb",
      usbVendorId: 1,
      usbProductId: 2,
      usbSerialNumber: "receipt-usb",
    })
    const job: PrintJob = {
      id: "receipt-test",
      module: "pos",
      template: "receipt",
      payload: {
        siteName: "Test counter",
        lines: [{ name: "Coffee", quantity: 1, unitPrice: 3, subtotal: 3 }],
        total: 3,
        currency: "USD",
      },
    }

    await printOnDevice(printer, job, { allowPrompt: false })

    const output = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)))
    expect(Array.from(output.subarray(0, 2))).toEqual([0x1b, 0x40])
    expect(Array.from(output.subarray(-3))).toEqual([0x1d, 0x56, 0x00])
    expect(output.toString("ascii")).toContain("Coffee")
    expect(output.toString("ascii")).not.toMatch(/<!doctype|<html|%!PS|showpage|findfont/i)
    expect(requestDevice).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })
})
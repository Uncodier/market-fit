import { printRegisterReport } from "@/app/pos/register/print-register-report"
import { isPrinterReadyOnStation, printOnDevice, printHtml } from "@/lib/printer"
import { closedRegisterSession, registerSession, registerSummary } from "./register-ui-fixtures"
import type { PrinterDevice } from "@/lib/printer"

jest.mock("@/lib/printer", () => {
  const actual = jest.requireActual("@/lib/printer")
  return { ...actual, isPrinterReadyOnStation: jest.fn(), printOnDevice: jest.fn(), printHtml: jest.fn() }
})

const usb: PrinterDevice = {
  id: "pos", name: "POS", transport: "usb", paperWidthMm: 80, copies: 1, enabled: true,
  modules: { pos: true, orders: false, inventory: false },
  autoPrint: { posReceipt: false, kitchenTicket: false, orderDelta: false, inventoryLabel: false },
}
const system: PrinterDevice = { ...usb, id: "system", transport: "system", paperWidthMm: 58 }
const run = (devices: PrinterDevice[]) => printRegisterReport(closedRegisterSession, registerSummary, "Store", { devices })

describe("manual cash register report routing", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.mocked(isPrinterReadyOnStation).mockReturnValue(true)
  })

  it.each(["usb", "bluetooth"] as const)("prefers ready %s hardware over system without auto-print flags", async (transport) => {
    const hardware = { ...usb, transport }
    await expect(run([system, hardware])).resolves.toBe("printer")
    expect(printOnDevice).toHaveBeenCalledWith(hardware, expect.objectContaining({
      module: "pos", template: "register-report", payload: {
        session: closedRegisterSession, summary: registerSummary, locationName: "Store",
      },
    }), { allowPrompt: false })
    expect(printHtml).not.toHaveBeenCalled()
  })

  it("does not switch drivers after a hardware transfer failure", async () => {
    jest.mocked(printOnDevice).mockRejectedValueOnce(new Error("Transfer failed"))
    await expect(run([usb, system])).rejects.toThrow("Transfer failed Output may be partial. Check the printer before retrying.")
    expect(printOnDevice).toHaveBeenCalledTimes(1)
    expect(printHtml).not.toHaveBeenCalled()
  })

  it.each([true, false])("blocks system fallback for unavailable hardware (enabled=%s)", async (enabled) => {
    jest.mocked(isPrinterReadyOnStation).mockImplementation((device) => device.transport === "system")
    await expect(run([{ ...usb, enabled }, system])).rejects.toThrow("Settings > Printers")
    expect(printOnDevice).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })

  it("honors a configured system printer's width", async () => {
    await expect(run([system])).resolves.toBe("system")
    expect(printOnDevice).toHaveBeenCalledWith(system, expect.objectContaining({ template: "register-report" }), { allowPrompt: false })
  })

  it("opens only report HTML at 80 mm with no applicable POS hardware", async () => {
    await expect(run([{ ...usb, modules: { ...usb.modules, pos: false } }])).resolves.toBe("system")
    expect(printOnDevice).not.toHaveBeenCalled()
    expect(printHtml).toHaveBeenCalledWith(expect.stringContaining("size:80mm"))
  })

  it("surfaces system printing failures", async () => {
    jest.mocked(printHtml).mockRejectedValueOnce(new Error("Print window blocked"))
    await expect(run([])).rejects.toThrow("Print window blocked")
    jest.mocked(printOnDevice).mockRejectedValueOnce(new Error("System failed"))
    await expect(run([system])).rejects.toThrow("System failed")
  })

  it("uses the immutable snapshot instead of a supplied live summary for closed sessions", async () => {
    await printRegisterReport(closedRegisterSession, { ...registerSummary, expected_amount: 999 }, "Store", { devices: [usb] })
    expect(printOnDevice).toHaveBeenCalledWith(usb, expect.objectContaining({
      payload: expect.objectContaining({ summary: registerSummary }),
    }), expect.anything())
  })

  it.each([{ devices: [] }, { devices: [usb] }, { devices: [system] }])("fails closed without a saved snapshot before any output (%j)", async ({ devices }) => {
    await expect(printRegisterReport(
      { ...closedRegisterSession, snapshot: null }, registerSummary, "Store", { devices },
    )).rejects.toThrow("closing snapshot is unavailable")
    expect(printOnDevice).not.toHaveBeenCalled()
    expect(printHtml).not.toHaveBeenCalled()
  })

  it("uses the supplied live summary for an open session, even with a stale snapshot", async () => {
    await printRegisterReport({ ...registerSession, snapshot: registerSummary }, { ...registerSummary, expected_amount: 999 }, "Store", { devices: [] })
    expect(printHtml).toHaveBeenCalledWith(expect.stringContaining("Live session preview"))
    expect(printHtml).toHaveBeenCalledWith(expect.stringContaining("$999.00"))
  })
})

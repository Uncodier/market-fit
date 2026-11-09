import { printJobManually } from "@/lib/printer/transports/manual-print"
import { createPrinterDevice, type PrintJob } from "@/lib/printer/core/types"
import { printOnDevice } from "@/lib/printer/transports/dispatch"
import { printHtml } from "@/lib/printer/transports/browser-print"
import { isPrinterReadyOnStation } from "@/lib/printer/core/station-status"

jest.mock("@/lib/printer/transports/dispatch", () => ({ printOnDevice: jest.fn() }))
jest.mock("@/lib/printer/transports/browser-print", () => ({ printHtml: jest.fn() }))
jest.mock("@/lib/printer/core/station-status", () => ({ isPrinterReadyOnStation: jest.fn() }))

const hardware = createPrinterDevice({
  id: "kitchen", transport: "usb",
  modules: { orders: true, pos: false, inventory: false },
})
const system = { ...hardware, id: "system", transport: "system" as const }
const job: PrintJob = {
  id: "order-print", module: "orders", template: "kitchen",
  payload: { orderNumber: "123", lines: [{ key: "burger", name: "Burger", quantity: 2 }] },
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(isPrinterReadyOnStation).mockReturnValue(true)
  jest.mocked(printOnDevice).mockResolvedValue(undefined)
})

it.each(["kitchen", "kitchen-delta"] as const)("sends %s to hardware without a selector", async (template) => {
  const ticket = { ...job, template }
  await expect(printJobManually({ devices: [system, hardware] }, ticket)).resolves.toBe("printer")
  expect(printOnDevice).toHaveBeenCalledWith(hardware, ticket, { allowPrompt: false })
  expect(printOnDevice).toHaveBeenCalledTimes(1)
  expect(printHtml).not.toHaveBeenCalled()
})

it("does not open system print when the configured Orders printer is unavailable", async () => {
  jest.mocked(isPrinterReadyOnStation).mockImplementation(device => device.transport === "system")
  await expect(printJobManually({ devices: [hardware, system] }, job)).rejects.toThrow("configured orders printer")
  expect(printOnDevice).not.toHaveBeenCalled()
  expect(printHtml).not.toHaveBeenCalled()
})

it("never retries a potentially partial hardware transfer through system print", async () => {
  jest.mocked(printOnDevice).mockRejectedValueOnce(new Error("Disconnected"))
  await expect(printJobManually({ devices: [hardware, system] }, job)).rejects.toThrow("Output may be partial")
  expect(printOnDevice).toHaveBeenCalledTimes(1)
  expect(printHtml).not.toHaveBeenCalled()
})

it("renders the final kitchen HTML when no app printer is configured", async () => {
  await expect(printJobManually({ devices: [] }, job)).resolves.toBe("system")
  const html = jest.mocked(printHtml).mock.calls[0][0]
  expect(html).toContain("<!doctype html>")
  expect(html).toContain("Burger")
  expect(html).toContain("kitchen-item")
  expect(printOnDevice).not.toHaveBeenCalled()
})

it("prints Orders on every ready kitchen station without opening system print", async () => {
  const second = { ...hardware, id: "second-kitchen" }
  await expect(printJobManually({ devices: [hardware, system, second] }, job)).resolves.toBe("printer")
  expect(printOnDevice).toHaveBeenCalledTimes(2)
  expect(printOnDevice).toHaveBeenNthCalledWith(1, hardware, job, { allowPrompt: false })
  expect(printOnDevice).toHaveBeenNthCalledWith(2, second, job, { allowPrompt: false })
  expect(printHtml).not.toHaveBeenCalled()
})

it("stops on a partial multi-station failure without replaying any ticket", async () => {
  const second = { ...hardware, id: "second-kitchen" }
  jest.mocked(printOnDevice).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Disconnected"))
  await expect(printJobManually({ devices: [hardware, second, system] }, job)).rejects.toThrow("Output may be partial")
  expect(printOnDevice).toHaveBeenCalledTimes(2)
  expect(printHtml).not.toHaveBeenCalled()
})

it("keeps POS manual printing limited to one hardware printer", async () => {
  const first = { ...hardware, modules: { pos: true, orders: false, inventory: false } }
  const second = { ...first, id: "second-pos" }
  await printJobManually({ devices: [first, second] }, { ...job, module: "pos" })
  expect(printOnDevice).toHaveBeenCalledTimes(1)
  expect(printOnDevice).toHaveBeenCalledWith(first, expect.objectContaining({ module: "pos" }), { allowPrompt: false })
})

it("renders ticket elements rather than displaying HTML source as text", async () => {
  await printJobManually({ devices: [] }, job)
  const doc = new DOMParser().parseFromString(jest.mocked(printHtml).mock.calls[0][0], "text/html")
  expect(doc.querySelector(".ticket .kitchen-name")?.textContent).toBe("Burger")
  expect(doc.querySelector(".kitchen-qty")?.textContent).toBe("2")
  expect(doc.querySelector(".order")?.textContent).toBe("#123")
  expect(doc.body.textContent).not.toContain("<div")
  expect(doc.querySelector("style")?.textContent).toContain("@page")
})
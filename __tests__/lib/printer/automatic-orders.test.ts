import { createPrinterDevice, normalizePrintersSettings } from "@/lib/printer/core/types"
import { printersForJob } from "@/lib/printer/core/format"
import { printJobForSettings, shouldAutoPrint } from "@/lib/printer/transports/dispatch"
import { printHtml } from "@/lib/printer/transports/browser-print"

jest.mock("@/lib/printer/transports/browser-print", () => ({ printHtml: jest.fn() }))

const kitchen = createPrinterDevice({
  id: "kitchen", transport: "system",
  modules: { orders: true, pos: false, inventory: false },
  autoPrint: { kitchenTicket: false, orderDelta: false, posReceipt: false, inventoryLabel: false },
})

beforeEach(() => jest.clearAllMocks())

it("does not enable automatic printing when saved settings omit the flags", () => {
  const settings = normalizePrintersSettings({ devices: [{
    id: "legacy", transport: "system", modules: { orders: true },
  }] })
  expect(shouldAutoPrint(settings, "orders", "kitchenTicket")).toBe(false)
  expect(shouldAutoPrint(settings, "orders", "orderDelta")).toBe(false)
})

it.each([
  ["kitchen", "kitchenTicket"],
  ["kitchen-delta", "orderDelta"],
] as const)("does not dispatch %s when its automatic toggle is off", async (template, flag) => {
  const settings = { devices: [kitchen] }
  expect(shouldAutoPrint(settings, "orders", flag)).toBe(false)
  await expect(printJobForSettings(settings, {
    id: "automatic", module: "orders", template, payload: { lines: [] },
  }, { autoPrintFlag: flag, fallbackToSystem: false })).resolves.toBe(false)
  expect(printHtml).not.toHaveBeenCalled()
})

it.each([
  ["kitchen", "kitchenTicket", "orderDelta"],
  ["kitchen-delta", "orderDelta", "kitchenTicket"],
] as const)("selects only printers opted into %s independently", (template, flag, otherFlag) => {
  const optedIn = { ...kitchen, id: "opted-in", autoPrint: { ...kitchen.autoPrint, [flag]: true } }
  const disabled = { ...optedIn, id: "disabled", enabled: false }
  const wrongModule = { ...optedIn, id: "pos", modules: { orders: false, pos: true, inventory: false } }
  const settings = { devices: [kitchen, optedIn, disabled, wrongModule] }
  expect(printersForJob(settings, "orders", template, flag)).toEqual([optedIn])
  expect(shouldAutoPrint(settings, "orders", flag)).toBe(true)
  expect(shouldAutoPrint(settings, "orders", otherFlag)).toBe(false)
})
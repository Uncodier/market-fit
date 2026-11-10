import { encodeJob, htmlForJob, thermalHtmlForJob } from "@/lib/printer/templates"
import { autoPrintFlagForJob, printJobForSettings } from "@/lib/printer/transports/dispatch"
import { createPrinterDevice, normalizePrintersSettings, type PrintJob } from "@/lib/printer/core/types"
import { printersForJob } from "@/lib/printer/core/format"
import { printHtml } from "@/lib/printer/transports/browser-print"
import { brandCommerceFields } from "@/app/components/settings/brand-commerce-schema"
import { enabledPrintFormats, payloadForFormat } from "@/app/components/settings/printer-samples"

jest.mock("@/lib/printer/transports/browser-print", () => ({ printHtml: jest.fn() }))

const job: PrintJob = {
  id: "packing", module: "shipments", template: "packing-slip",
  payload: {
    shipmentId: "shipment-123", orderNumber: "SO-42", customerName: "Ada",
    shippingAddress: "123 Main Street", trackingNumber: "TRACK123",
    lines: [{ name: "Tea <strong>box</strong>", quantity: 2 }],
  },
}

it.each([58, 80] as const)("renders packing slips at %smm, not carrier labels", paper => {
  const html = htmlForJob(job, paper)
  expect(html).toBe(thermalHtmlForJob(job, paper))
  const doc = new DOMParser().parseFromString(html, "text/html")
  expect(doc.body.textContent).toContain("PACKING SLIP")
  expect(doc.body.textContent).toContain("SO-42")
  expect(doc.body.textContent).toContain("123 Main Street")
  expect(doc.body.textContent).toContain("Not a carrier label")
  expect(doc.querySelector("strong")).toBeNull()
  const bytes = Buffer.from(encodeJob(job, paper)).toString("ascii")
  expect(bytes).toContain("PACKING SLIP")
  expect(bytes).toContain("TRACK123")
  expect(bytes).not.toContain("<!doctype")
})

it("keeps shipment routing and automatic flags after settings normalization", () => {
  const device = createPrinterDevice({
    id: "shipping", modules: { pos: false, orders: false, inventory: false, shipments: true },
    autoPrint: { posReceipt: false, kitchenTicket: false, orderDelta: false, inventoryLabel: false, shipmentPackingSlip: true },
  })
  const settings = normalizePrintersSettings({ devices: [device] })
  expect(printersForJob(settings, "shipments", "packing-slip", "shipmentPackingSlip")).toEqual([device])
  expect(printersForJob(settings, "orders", "kitchen")).toEqual([])
  expect(autoPrintFlagForJob(job)).toBe("shipmentPackingSlip")
  expect(brandCommerceFields.printers.parse(settings).devices[0].modules.shipments).toBe(true)
  expect(brandCommerceFields.printers.parse(settings).devices[0].autoPrint.shipmentPackingSlip).toBe(true)
  expect(enabledPrintFormats(device)).toEqual([{ template: "packing-slip", module: "shipments" }])
  expect(payloadForFormat("packing-slip", {})).toHaveProperty("shipmentId")
})

it("never opens system printing for an automatic shipment job", async () => {
  const device = createPrinterDevice({
    modules: { pos: false, orders: false, inventory: false, shipments: true },
    autoPrint: { posReceipt: false, kitchenTicket: false, orderDelta: false, inventoryLabel: false, shipmentPackingSlip: true },
  })
  await expect(printJobForSettings({ devices: [device] }, job, {
    autoPrintFlag: "shipmentPackingSlip", bestEffort: true, fallbackToSystem: false, allowPrompt: false,
  })).resolves.toBe(false)
  expect(printHtml).not.toHaveBeenCalled()
})
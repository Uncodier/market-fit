import { claimShipmentPackingSlip, shipmentPackingSlip } from "@/app/shipments/packing-slip"
import { packingSlipPdf } from "@/app/shipments/packing-slip-pdf"
import type { ShipmentWithRelations } from "@/app/shipments/types"
import { PDFDocument } from "pdf-lib"

const shipment = {
  id: "shipment-1", site_id: "site-1", created_at: "2026-11-09", status: "preparing",
  shipping_address: { street: "1 Main St", city: "London", region: "London", postal_code: "A1" },
  sale_orders: { order_number: "SO-1", total: 100, sale_order_items: [
    { id: "1", name: "Assigned", quantity: 2, shipment_id: "shipment-1", status: "completed" },
    { id: "2", name: "Other", quantity: 3, shipment_id: "shipment-2" },
    { id: "3", name: "Unassigned", quantity: 4 },
    { id: "4", name: "Cancelled", quantity: 1, shipment_id: "shipment-1", status: "cancelled" },
    { id: "5", name: "Draft", quantity: 1, shipment_id: "shipment-1", status: "draft" },
    { id: "6", name: "Invalid", quantity: NaN, shipment_id: "shipment-1" },
  ] },
} as ShipmentWithRelations

describe("shipment packing slips", () => {
  beforeEach(() => { localStorage.clear() })

  it("includes only valid assigned lines, no prices or unassigned items", () => {
    expect(shipmentPackingSlip(shipment, "Warehouse")).toMatchObject({
      shipmentId: "shipment-1", orderNumber: "SO-1", siteName: "Warehouse",
      shippingAddress: "1 Main St, London, London, A1", lines: [{ name: "Assigned", quantity: 2 }],
    })
    expect(shipmentPackingSlip(shipment)).not.toHaveProperty("total")
  })

  it("supports empty relations and string addresses", () => {
    expect(shipmentPackingSlip({ ...shipment, sale_orders: undefined, shipping_address: "Destination" }))
      .toMatchObject({ lines: [], shippingAddress: "Destination" })
  })

  it("claims once across concurrent callers and remains claimed for reloads", async () => {
    let queue = Promise.resolve()
    const request = jest.fn((_key, action) => {
      const result = queue.then(action)
      queue = result.then(() => undefined)
      return result
    })
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request } })
    expect(await Promise.all([claimShipmentPackingSlip("s", "u", "shipment"), claimShipmentPackingSlip("s", "u", "shipment")]))
      .toEqual([true, false])
    expect(await claimShipmentPackingSlip("s", "u", "shipment")).toBe(false)
    expect(await claimShipmentPackingSlip("s2", "u", "shipment")).toBe(true)
    expect(await claimShipmentPackingSlip("s", "u2", "shipment")).toBe(true)
  })

  it("fails closed without browser locks or writable storage", async () => {
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined })
    expect(await claimShipmentPackingSlip("s", "u", "shipment")).toBe(false)
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request: (_key: string, action: () => boolean) => action() } })
    const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
    expect(await claimShipmentPackingSlip("s", "u", "shipment")).toBe(false)
    spy.mockRestore()
  })

  it("generates a valid multipage PDF with long and unsupported text", async () => {
    const payload = shipmentPackingSlip(shipment)
    payload.lines = Array.from({ length: 100 }, () => ({ name: "Long item 🧪 " + "a".repeat(100), quantity: 2 }))
    const bytes = await packingSlipPdf(payload)
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBeGreaterThan(1)
  })
})
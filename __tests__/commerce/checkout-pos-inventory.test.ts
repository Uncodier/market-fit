import { posCheckoutShipmentItems, settlePosCheckoutInventory } from "@/app/commerce/checkout-pos-inventory"
import { reconcileOrderLineInventory } from "@/app/commerce/order-line-inventory"
jest.mock("server-only", () => ({}))
jest.mock("@/app/commerce/order-line-inventory", () => ({ reconcileOrderLineInventory: jest.fn() }))

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(reconcileOrderLineInventory).mockResolvedValue({ reviewRequired: false, skipped: false,
    debitedQuantity: 0, restockedQuantity: 0, appliedQuantity: 0 })
})

it("never uses fulfillment completion as a debit credit", async () => {
  await settlePosCheckoutInventory({ client: {} as never, siteId: "site", orderId: "order", locationId: "location",
    lines: [{ id: "host", quantity: 3, status: "completed" }, { id: "extra", quantity: 6, status: "completed" }] })
  expect(jest.mocked(reconcileOrderLineInventory).mock.calls.map((call) => call[1].targetQuantity)).toEqual([3, 6])
})

it("does not take inventory ownership from assigned shipments or acknowledged no-stock fulfillment", async () => {
  const review = await settlePosCheckoutInventory({ client: {} as never, siteId: "site", orderId: "order", locationId: "location",
    lines: [{ id: "ship", quantity: 3, shipment_id: "shipment" },
      { id: "explicit", quantity: 1, metadata: { completed_without_stock: true } },
      { id: "cancelled", quantity: 1, status: "cancelled" }] })
  expect(review).toBe(false)
  expect(reconcileOrderLineInventory).not.toHaveBeenCalled()
})

it("aggregates legacy review without losing other known receipts", async () => {
  jest.mocked(reconcileOrderLineInventory).mockResolvedValueOnce({ reviewRequired: true, skipped: false,
    debitedQuantity: 0, restockedQuantity: 0, appliedQuantity: 0 })
  expect(await settlePosCheckoutInventory({ client: {} as never, siteId: "site", orderId: "order", locationId: "location",
    lines: [{ id: "legacy", quantity: 1 }, { id: "new", quantity: 2 }] })).toBe(true)
  expect(reconcileOrderLineInventory).toHaveBeenCalledTimes(2)
})

it("includes partially completed and completed but unshipped line budgets", () => {
  expect(posCheckoutShipmentItems([{ id: "partial", status: "preparing", quantity: 3 },
    { id: "completed", status: "completed", quantity: 2 },
    { id: "assigned", shipment_id: "shipment", quantity: 4 },
    { id: "explicit", quantity: 1, metadata: { completed_without_stock: true } }])).toEqual(["partial", "completed"])
})
/** @jest-environment node */
jest.mock("server-only", () => ({}))
import { assertSelfServiceFulfillmentPaid } from "@/app/commerce/self-service-fulfillment-guard"
import { updateOrderItemStatus, updateOrderItemsStatus } from "@/app/orders/actions"
import { createClient } from "@/lib/supabase/server"
import { updateOperationalOrderLineStatus, advanceOperationalOrderLines } from "@/app/order-lines/actions"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/marketplace/mutation-guards", () => ({ assertInternalOrder: jest.fn() }))
jest.mock("@/lib/redis/json-cache", () => ({ bumpCacheEpoch: jest.fn() }))

function setup(paid = false, marked = true) {
  const chain = (data: unknown) => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error: null }) })
  const tables = { sale_orders: chain({ id: "order", sale_id: "sale", status: "pending", items: marked ? [{ metadata: { self_service: true } }] : [] }),
    sales: chain({ status: paid ? "completed" : "pending", amount_due: paid ? 0 : 10 }), sale_order_items: chain(null) }
  const client = { from: jest.fn((table: keyof typeof tables) => tables[table]) }
  ;(createClient as jest.Mock).mockResolvedValue(client)
  return { client, tables }
}

it.each(["new", "preparing", "in_progress", "completed", "ready"])("denies unpaid operational transition to %s", async (status) => {
  const { client } = setup()
  await expect(assertSelfServiceFulfillmentPaid(client, "site", "order", status)).rejects.toThrow("Collect payment")
})

it("permits cancellation and normal orders, and releases fully paid kiosk work", async () => {
  const unpaid = setup().client
  await expect(assertSelfServiceFulfillmentPaid(unpaid, "site", "order", "cancelled")).resolves.toBeUndefined()
  expect(unpaid.from).not.toHaveBeenCalled()
  await expect(assertSelfServiceFulfillmentPaid(setup(true).client, "site", "order", "preparing")).resolves.toBeUndefined()
  await expect(assertSelfServiceFulfillmentPaid(setup(false, false).client, "site", "order", "preparing")).resolves.toBeUndefined()
})

it("Orders single and bulk actions deny unpaid kitchen writes", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {})
  const { tables } = setup()
  expect(await updateOrderItemStatus("site", "item", "order", "preparing")).toEqual({ error: expect.stringContaining("Collect payment") })
  expect(await updateOrderItemsStatus("site", "order", "new")).toEqual({ error: expect.stringContaining("Collect payment") })
  expect(tables.sale_order_items.update).not.toHaveBeenCalled()
  log.mockRestore()
})

it("Order-lines single and bulk actions deny unpaid unit transitions before RPC", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {})
  const { client } = setup()
  const units = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [
    { id: "unit", status: "draft", sale_order_items: { sale_order_id: "order" } },
  ], error: null }) }
  const rpc = jest.fn()
  const scoped = { from: (table: string) => table === "sale_order_item_units" ? units : client.from(table as "sale_orders"), rpc }
  ;(createClient as jest.Mock).mockResolvedValue(scoped)
  expect(await updateOperationalOrderLineStatus("site", "unit", "preparing")).toEqual({ error: expect.stringContaining("Collect payment") })
  expect(await advanceOperationalOrderLines("site", ["unit"])).toEqual({ error: expect.stringContaining("Collect payment") })
  expect(rpc).not.toHaveBeenCalled()
  log.mockRestore()
})
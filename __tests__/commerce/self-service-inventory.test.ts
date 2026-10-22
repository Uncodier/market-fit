/** @jest-environment node */
import { applySelfServiceInventoryRelease } from "@/app/commerce/self-service-inventory"

it("uses only the authorized order ID, returning DB-owned released lines", async () => {
  const items = [{ id: "parent", quantity: 1 }, { id: "modifier", quantity: 2 }]
  const client = { rpc: jest.fn().mockResolvedValue({ data: { status: "completed", items }, error: null }) }
  await expect(applySelfServiceInventoryRelease({ client: client as never, siteId: "site", orderId: "order" })).resolves.toEqual(items)
  expect(client.rpc).toHaveBeenCalledWith("release_self_service_order", { p_site_id: "site", p_order_id: "order" })
})

it.each([
  { data: null, error: { message: "unpaid" } },
  { data: { status: "completed" }, error: null },
  { data: { status: "pending", items: [] }, error: null },
])("fails closed when the transaction is denied or has an invalid response %#", async (result) => {
  const client = { rpc: jest.fn().mockResolvedValue(result) }
  await expect(applySelfServiceInventoryRelease({ client: client as never, siteId: "site", orderId: "order" }))
    .rejects.toThrow("Unable to atomically release")
})

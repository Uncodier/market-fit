/** @jest-environment node */
import { applySelfServiceInventoryRelease, selfServiceReleasedInventoryUnits } from "@/app/commerce/self-service-inventory"

const parent = { id: "parent-line", catalog_item_id: "parent", quantity: 1, status: "new", sent_at: "released" }
const modifier = { id: "modifier-line", catalog_item_id: "extra", quantity: 2, status: "new", sent_at: "released" }

function inventoryClient(policy = "ship") {
  const stock: Record<string, number> = { parent: 10, extra: 10 }
  const writes: { sku: string; quantity: number }[] = []
  const client = {
    from: (table: string) => {
      const filters: Record<string, unknown> = {}
      let payload: { quantity: number } | undefined
      const result = () => {
        if (table === "settings") return { data: { commerce: { decrement_stock_on: policy } }, error: null }
        if (table === "catalog_items") return { data: { track_inventory: true }, error: null }
        const sku = String(filters.catalog_item_id || filters.id)
        if (payload) { stock[sku] = payload.quantity; writes.push({ sku, quantity: payload.quantity }) }
        return { data: { id: sku, quantity: stock[sku] }, error: null }
      }
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters[key] = value; return query },
        update: (data: { quantity: number }) => { payload = data; return query },
        single: async () => result(),
        maybeSingle: async () => result(),
        then: <T>(resolve: (value: ReturnType<typeof result>) => T) => Promise.resolve(result()).then(resolve),
      }
      return query
    },
  }
  return { client, stock, writes }
}

it.each(["free checkout", "POS cash checkout"])("decrements parent and modifier units once for %s then leaves paid saves unchanged", async () => {
  const { client, stock, writes } = inventoryClient()
  const released = [parent, modifier]
  const params = { client, siteId: "site", locationId: "location", existingItems: [], nextItems: released }
  await applySelfServiceInventoryRelease(params)
  expect(stock).toEqual({ parent: 9, extra: 8 })
  await applySelfServiceInventoryRelease({ ...params, existingItems: released })
  expect(stock).toEqual({ parent: 9, extra: 8 })
  expect(writes).toHaveLength(2)
})

it("deducts the full persisted quantity of a draft line on payment, not zero because it exists", async () => {
  const { client, stock } = inventoryClient()
  await applySelfServiceInventoryRelease({ client, siteId: "site", locationId: "location",
    existingItems: [{ ...parent, status: "draft", sent_at: null }, { ...modifier, status: "draft", sent_at: null }],
    nextItems: [parent, modifier] })
  expect(stock).toEqual({ parent: 9, extra: 8 })
})

it("aggregates repeated SKUs across parent/modifier rows and only charges positive released increases", () => {
  expect([...selfServiceReleasedInventoryUnits([parent], [
    { ...parent, quantity: 3 }, { ...modifier, catalog_item_id: "parent" },
  ])]).toEqual([["parent", 4]])
  expect(selfServiceReleasedInventoryUnits([parent], [{ ...parent, quantity: 0 }]).size).toBe(0)
})

it("does not deduct unpaid drafts, cancelled lines, or unsent snapshots", () => {
  expect(selfServiceReleasedInventoryUnits([], [
    { ...parent, status: "draft", sent_at: null }, { ...modifier, status: "cancelled" }, { ...parent, sent_at: null },
  ]).size).toBe(0)
})

it("honors the never-decrement policy", async () => {
  const { client, stock, writes } = inventoryClient("never")
  await applySelfServiceInventoryRelease({ client, siteId: "site", locationId: "location", existingItems: [], nextItems: [parent, modifier] })
  expect(stock).toEqual({ parent: 10, extra: 10 })
  expect(writes).toHaveLength(0)
})
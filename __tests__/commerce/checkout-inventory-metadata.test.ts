/** @jest-environment node */
import { readCheckoutTrackedInventoryIds } from "@/app/commerce/checkout-inventory-metadata"

function metadataClient(batchError = false, rowLimit?: number, nullData = false) {
  const items = [
    { id: "tracked", site_id: "site", track_inventory: true },
    { id: "untracked", site_id: "site", track_inventory: false },
    { id: "foreign", site_id: "other-site", track_inventory: true },
  ]
  const batches: string[][] = []
  const scopes: unknown[] = []
  const singles: unknown[] = []
  type Result<T> = { data: T | null; error: { message: string } | null }
  type Query = {
    select: jest.Mock<Query, []>
    eq: (key: string, value: unknown) => Query
    in: (key: string, ids: string[]) => Promise<Result<typeof items>>
    single: () => Promise<Result<typeof items[number]>>
  }
  const client = {
    from: jest.fn((table: string) => {
      expect(table).toBe("catalog_items")
      const filters: Record<string, unknown> = {}
      const query: Query = {
        select: jest.fn((): Query => query),
        eq: (key: string, value: unknown) => { filters[key] = value; return query },
        in: async (key: string, ids: string[]) => {
          expect(key).toBe("id")
          batches.push(ids)
          scopes.push(filters.site_id)
          return batchError
            ? { data: null, error: { message: "Batch unavailable" } }
            : { data: nullData ? null : items.filter((item) => ids.includes(item.id) && item.site_id === filters.site_id).slice(0, rowLimit), error: null }
        },
        single: async () => {
          scopes.push(filters.site_id)
          singles.push(filters.id)
          const item = items.find((item) => item.id === filters.id && item.site_id === filters.site_id)
          return { data: item || null, error: item ? null : { message: "Not found" } }
        },
      }
      return query
    }),
  }
  return { client, batches, scopes, singles }
}

describe("checkout inventory metadata batching", () => {
  it("deduplicates IDs and includes only tracked products from the trusted site", async () => {
    const fixture = metadataClient()
    await expect(readCheckoutTrackedInventoryIds(fixture.client as never, "site", [
      "tracked", "untracked", "tracked", "missing", "foreign",
    ])).resolves.toEqual(new Set(["tracked"]))
    expect(fixture.batches).toEqual([["tracked", "untracked", "missing", "foreign"]])
    expect(fixture.scopes).toEqual(["site", "site", "site"])
    expect(fixture.singles).toEqual(["missing", "foreign"])
  })

  it("bounds every request for a large cart", async () => {
    const fixture = metadataClient()
    const ids = Array.from({ length: 205 }, (_, index) => `item-${index}`)
    await readCheckoutTrackedInventoryIds(fixture.client as never, "site", ids)
    expect(fixture.batches.map((batch) => batch.length)).toEqual([100, 100, 5])
    expect(fixture.batches.flat()).toEqual(ids)
    expect(fixture.scopes).toEqual(Array(208).fill("site"))
  })

  it("does not query for an empty cart", async () => {
    const fixture = metadataClient()
    await expect(readCheckoutTrackedInventoryIds(fixture.client as never, "site", [])).resolves.toEqual(new Set())
    expect(fixture.client.from).not.toHaveBeenCalled()
  })

  it.each([false, true])("resolves missing rows when a batch is truncated or null (%s)", async (nullData) => {
    const fixture = metadataClient(false, 0, nullData)
    await expect(readCheckoutTrackedInventoryIds(fixture.client as never, "site", ["tracked", "untracked"]))
      .resolves.toEqual(new Set(["tracked"]))
    expect(fixture.singles).toEqual(["tracked", "untracked"])
    expect(fixture.scopes).toEqual(["site", "site", "site"])
  })

  it("falls back to scoped per-product reads on batch errors without dropping readable stock", async () => {
    const fixture = metadataClient(true)
    await expect(readCheckoutTrackedInventoryIds(fixture.client as never, "site", [
      "tracked", "missing", "foreign", "untracked", "tracked",
    ])).resolves.toEqual(new Set(["tracked"]))
    expect(fixture.singles).toEqual(["tracked", "missing", "foreign", "untracked"])
    expect(fixture.scopes).toEqual(Array(5).fill("site"))
  })

  it("propagates thrown transport failures", async () => {
    const fixture = metadataClient()
    fixture.client.from.mockImplementationOnce(() => { throw new Error("Transport failed") })
    await expect(readCheckoutTrackedInventoryIds(fixture.client as never, "site", ["tracked"]))
      .rejects.toThrow("Transport failed")
  })
})
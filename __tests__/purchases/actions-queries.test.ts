/** @jest-environment node */

import { listPurchases, getPurchaseById, getPurchaseWithoutContext } from "@/app/purchases/actions"
import * as queries from "@/app/purchases/purchase-queries"
import { mapPurchase } from "@/app/purchases/purchase-mappers"

jest.mock("@/app/purchases/purchase-queries", () => ({
  listPurchases: jest.fn(),
  getPurchaseById: jest.fn(),
  getPurchaseWithoutContext: jest.fn(),
}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/app/accounting/ensure", () => ({
  upsertPolizaForPurchase: jest.fn(),
  removePolizaForSource: jest.fn(),
}))
jest.mock("@/app/accounting/source-lifecycle", () => ({
  deleteAccountingSource: jest.fn(),
  hasSourceJournal: jest.fn(),
}))

const siteId = "00000000-0000-4000-8000-000000000001"
const id = "00000000-0000-4000-8000-000000000002"
const purchase = mapPurchase({ id, site_id: siteId, title: "Vendor bill", amount: 100 })

describe("purchase query actions", () => {
  beforeEach(() => jest.resetAllMocks())

  it("forwards all list filters and preserves the query result", async () => {
    const params = {
      siteId, page: 2, pageSize: 10, status: "pending",
      locationId: "location-1", q: "Vendor", sort: "oldest",
    }
    const result = { data: [purchase], count: 1, error: null }
    jest.mocked(queries.listPurchases).mockResolvedValueOnce(result)

    await expect(listPurchases(params)).resolves.toBe(result)
    expect(queries.listPurchases).toHaveBeenCalledTimes(1)
    expect(queries.listPurchases).toHaveBeenCalledWith(params)
  })

  it("forwards site and purchase IDs in their original order", async () => {
    const result = { purchase, error: null }
    jest.mocked(queries.getPurchaseById).mockResolvedValueOnce(result)

    await expect(getPurchaseById(siteId, id)).resolves.toBe(result)
    expect(queries.getPurchaseById).toHaveBeenCalledTimes(1)
    expect(queries.getPurchaseById).toHaveBeenCalledWith(siteId, id)
  })

  it("preserves the context-free query's purchase and site result", async () => {
    const result = { purchase, site: { id: siteId, name: "Test site" }, error: null }
    jest.mocked(queries.getPurchaseWithoutContext).mockResolvedValueOnce(result)

    await expect(getPurchaseWithoutContext(id)).resolves.toBe(result)
    expect(queries.getPurchaseWithoutContext).toHaveBeenCalledTimes(1)
    expect(queries.getPurchaseWithoutContext).toHaveBeenCalledWith(id)
  })

  it("preserves errors returned by the underlying queries", async () => {
    const listError = { data: null, count: 0, error: "Not authenticated" }
    const detailError = { purchase: null, error: "Not authorized for this site" }
    const contextError = { purchase: null, site: null, error: "Purchase not found" }
    jest.mocked(queries.listPurchases).mockResolvedValueOnce(listError)
    jest.mocked(queries.getPurchaseById).mockResolvedValueOnce(detailError)
    jest.mocked(queries.getPurchaseWithoutContext).mockResolvedValueOnce(contextError)

    await expect(listPurchases({ siteId })).resolves.toBe(listError)
    await expect(getPurchaseById(siteId, id)).resolves.toBe(detailError)
    await expect(getPurchaseWithoutContext(id)).resolves.toBe(contextError)
  })
})
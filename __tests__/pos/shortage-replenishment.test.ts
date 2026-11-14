/** @jest-environment node */

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/inventory/movements/order-actions", () => ({ createTransferOrder: jest.fn() }))

import { createClient } from "@/lib/supabase/server"
import { createTransferOrder } from "@/app/inventory/movements/order-actions"
import { requestPosShortagePurchase, requestPosShortageTransfer } from "@/app/pos/shortage-replenishment"

const siteId = "10000000-0000-4000-8000-000000000001"
const catalogItemId = "10000000-0000-4000-8000-000000000002"
const locationId = "10000000-0000-4000-8000-000000000003"
const sourceLocationId = "10000000-0000-4000-8000-000000000004"
const requestId = "10000000-0000-4000-8000-000000000005"
const documentId = "10000000-0000-4000-8000-000000000006"
const input = { siteId, catalogItemId, locationId, requestId, quantity: 2.5, currency: "USD" }
const transferInput = { siteId, catalogItemId, locationId, requestId, quantity: 2.5, sourceLocationId }
const mockCreateClient = jest.mocked(createClient)
const mockTransfer = jest.mocked(createTransferOrder)
type Query = { select: jest.Mock; eq: jest.Mock; maybeSingle: jest.Mock }
let client: { auth: { getUser: jest.Mock }; rpc: jest.Mock; from: jest.Mock; _isDemo?: boolean }
let queries: Record<string, Query>

beforeEach(() => {
  jest.resetAllMocks()
  queries = {}
  client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "actor" } }, error: null }) },
    rpc: jest.fn().mockImplementation(async (name: string) => ({ data: name === "save_procurement_request" ? documentId : true, error: null })),
    from: jest.fn((table: string) => {
      const query = {
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: table === "catalog_items" ? { name: "Server product", currency: "EUR" } : { name: "Warehouse" }, error: null }),
      }
      queries[table] = query
      return query
    }),
  }
  mockCreateClient.mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  mockTransfer.mockResolvedValue({ success: true, orderId: documentId, requestId, alreadyApplied: false })
})

describe("POS purchase requisition", () => {
  it("creates a real draft with server currency, whole catalog units and no client prices", async () => {
    expect(await requestPosShortagePurchase(input)).toEqual({ id: documentId })
    expect(mockCreateClient).toHaveBeenCalledWith(true)
    expect(client.rpc).toHaveBeenCalledWith("procurement_request_access", { p_site: siteId })
    expect(client.rpc).toHaveBeenCalledWith("save_procurement_request", {
      p_site: siteId, p_id: null, p_revision: 0,
      p_document: {
        title: "POS replenishment: Server product", currency: "EUR",
        description: expect.stringContaining(requestId),
        lines: [{ catalog_item_id: catalogItemId, quantity: 3, description: "" }],
      },
    })
    for (const query of Object.values(queries)) expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(queries.locations.eq).toHaveBeenCalledWith("id", locationId)
    expect(client.rpc.mock.calls.map(([name]: [string]) => name)).not.toContain("submit_procurement_request")
  })

  it.each([0, -1, NaN, Infinity, 1_000_001])("rejects invalid quantity %s before auth/write", async quantity => {
    expect(await requestPosShortagePurchase({ ...input, quantity })).toHaveProperty("error")
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it("rejects forged prices and malformed tenant IDs", async () => {
    const forged = { ...input, price: 1 }
    expect(await requestPosShortagePurchase(forged)).toHaveProperty("error")
    expect(await requestPosShortagePurchase({ ...input, siteId: "foreign" })).toHaveProperty("error")
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it("denies unauthenticated callers", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await requestPosShortagePurchase(input)).toEqual({ error: "Not authenticated" })
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it("denies demo writes", async () => {
    client._isDemo = true
    expect(await requestPosShortagePurchase(input)).toHaveProperty("error")
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it.each([false, null])("fails closed on procurement access %s", async permission => {
    client.rpc.mockResolvedValue({ data: permission, error: null })
    expect(await requestPosShortagePurchase(input)).toEqual({ error: "Purchase requisition access denied" })
    expect(client.from).not.toHaveBeenCalled()
  })

  it("denies a restricted receiving location", async () => {
    client.rpc.mockImplementation(async (name: string) => ({ data: name !== "user_can_access_location", error: null }))
    expect(await requestPosShortagePurchase(input)).toEqual({ error: "Receiving location access denied" })
    expect(client.from).not.toHaveBeenCalled()
  })

  it("fails closed on a foreign or missing catalog/location record", async () => {
    client.from.mockImplementation(() => {
      const q = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) }
      return q
    })
    expect(await requestPosShortagePurchase(input)).toHaveProperty("error")
    expect(client.rpc).not.toHaveBeenCalledWith("save_procurement_request", expect.anything())
  })

  it.each(["42501", "22023", "23514"])("returns safe known database denial %s without ambiguous state", async code => {
    client.rpc.mockImplementation(async (name: string) => name === "save_procurement_request"
      ? { data: null, error: { code, message: "private database details" } } : { data: true, error: null })
    const result = await requestPosShortagePurchase(input)
    expect(result.error).toBeTruthy()
    expect(result.reviewRequired).toBeUndefined()
    expect(result.error).not.toContain("private database details")
  })

  it.each(["throw", "unknown", "invalid-result"])("requires manual review after %s, without replay", async failure => {
    client.rpc.mockImplementation(async (name: string) => {
      if (name !== "save_procurement_request") return { data: true, error: null }
      if (failure === "throw") throw new Error("private transport details")
      return { data: "invalid", error: failure === "unknown" ? { code: "unknown" } : null }
    })
    expect(await requestPosShortagePurchase(input)).toMatchObject({ reviewRequired: true, error: expect.stringContaining("Review purchase requisitions") })
    expect(client.rpc.mock.calls.filter(([name]: [string]) => name === "save_procurement_request")).toHaveLength(1)
  })

  it("allows preparation retry when no write has begun", async () => {
    client.auth.getUser.mockRejectedValue(new Error("network"))
    expect(await requestPosShortagePurchase(input)).toEqual({ error: "Unable to prepare the purchase requisition. Please try again." })
  })
})

describe("POS transfer request", () => {
  it("reuses authorized requested transfer action, exact fractional quantity and stable retry key", async () => {
    expect(await requestPosShortageTransfer(transferInput)).toEqual({ id: documentId })
    expect(mockTransfer).toHaveBeenCalledWith({
      siteId, requestId, fromLocationId: sourceLocationId, toLocationId: locationId,
      status: "requested", items: [{ catalogItemId, quantity: 2.5 }], notes: "POS stock shortage",
    })
    mockTransfer.mockResolvedValue({ success: true, orderId: documentId, requestId, alreadyApplied: true })
    expect(await requestPosShortageTransfer(transferInput)).toEqual({ id: documentId })
    expect(mockTransfer.mock.calls[0]).toEqual(mockTransfer.mock.calls[1])
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it("rejects same-location transfer even with differently cased UUIDs", async () => {
    const id = "abcdef00-0000-4000-8000-000000000001"
    expect(await requestPosShortageTransfer({ ...transferInput, locationId: id, sourceLocationId: id.toUpperCase() })).toHaveProperty("error")
    expect(mockTransfer).not.toHaveBeenCalled()
  })

  it("preserves workflow denial and does not retry", async () => {
    mockTransfer.mockResolvedValue({ error: "Transfer order access denied", status: 403 })
    expect(await requestPosShortageTransfer(transferInput)).toEqual({ error: "Transfer order access denied" })
    expect(mockTransfer).toHaveBeenCalledTimes(1)
  })

  it("reports ambiguous transport failure without dispatching or automatic retries", async () => {
    mockTransfer.mockRejectedValue(new Error("private details"))
    expect(await requestPosShortageTransfer(transferInput)).toEqual({ error: "Transfer request could not be confirmed. Retain the request ID and retry." })
    expect(mockTransfer).toHaveBeenCalledTimes(1)
  })
})
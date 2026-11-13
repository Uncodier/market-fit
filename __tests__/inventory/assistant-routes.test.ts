/** @jest-environment node */
import { NextResponse } from "next/server"
import { POST as bulk } from "@/app/api/inventory/bulk/route"
import { POST as receiveBill } from "@/app/api/inventory/receive-bill/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { userCanOnLocation } from "@/lib/permissions/location-access"
import { executeInventoryBatch, InventoryOperationError } from "@/app/inventory/movements/operations"
import { createClient } from "@supabase/supabase-js"
import { lookupCurrentUserSiteRole } from "@/lib/auth/site-role-lookup"

jest.mock("server-only", () => ({}))
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/auth/site-role-lookup", () => ({ lookupCurrentUserSiteRole: jest.fn() }))
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
jest.mock("@/lib/permissions/location-access", () => ({ userCanOnLocation: jest.fn() }))
jest.mock("@/app/inventory/movements/operations", () => ({
  executeInventoryBatch: jest.fn(),
  InventoryOperationError: class extends Error {
    constructor(message: string, public status: number) { super(message) }
  },
}))

const siteId = "00000000-0000-4000-8000-000000000001"
const requestId = "00000000-0000-4000-8000-000000000002"
const fromLocationId = "00000000-0000-4000-8000-000000000003"
const toLocationId = "00000000-0000-4000-8000-000000000004"
const catalogItemId = "00000000-0000-4000-8000-000000000005"
const purchaseId = "00000000-0000-4000-8000-000000000006"
const transfer = { kind: "transfer", fromLocationId, toLocationId, catalogItemId, quantity: 2 }
const input = { siteId, requestId, operations: [transfer] }
const receivingUserId = "00000000-0000-4000-8000-000000000007"
const purchaseItemId = "00000000-0000-4000-8000-000000000008"
const receipt = { siteId, requestId, purchaseId, toLocationId, receivingUserId, lines: [{ purchaseItemId, quantity: 1.5 }] }
const result = { success: true as const, requestId, movementIds: [], alreadyApplied: false }
const purchaseQuery = {
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn(),
}
const client = { from: jest.fn().mockReturnValue(purchaseQuery), rpc: jest.fn() }

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/inventory", {
    method: "POST", headers: { "content-type": "application/json", cookie: "session=test", ...headers },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requireSiteAccess).mockResolvedValue({ supabase: client } as unknown as Awaited<ReturnType<typeof requireSiteAccess>>)
  jest.mocked(userCanOnLocation).mockResolvedValue(true)
  jest.mocked(executeInventoryBatch).mockResolvedValue(result)
  client.rpc.mockResolvedValue({ data: result, error: null })
  purchaseQuery.maybeSingle.mockResolvedValue({ data: { id: purchaseId, location_id: fromLocationId }, error: null })
})

describe.each([["bulk", bulk, input], ["receive-bill", receiveBill, receipt]] as const)("%s authentication", (_name, handler, body) => {
  it.each([401, 403])("preserves auth denial %s without invoking operations", async status => {
    jest.mocked(requireSiteAccess).mockResolvedValue({ error: NextResponse.json({ error: "Denied" }, { status }) })
    expect((await handler(request(body))).status).toBe(status)
    expect(executeInventoryBatch).not.toHaveBeenCalled()
    expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId, { allowLocationScoped: true })
  })
  it("requires JSON and rejects unknown fields", async () => {
    expect((await handler(request(body, { "content-type": "text/plain" }))).status).toBe(415)
    expect((await handler(request({ ...body, userId: "forged" }))).status).toBe(400)
    expect(requireSiteAccess).not.toHaveBeenCalled()
  })
  it("rejects declared and actual oversized bodies", async () => {
    expect((await handler(request(body, { "content-length": "200000" }))).status).toBe(413)
    expect((await handler(request({ padding: "x".repeat(140000) }))).status).toBe(413)
    expect(executeInventoryBatch).not.toHaveBeenCalled()
  })
  it("rejects malformed JSON", async () => {
    const malformed = new Request("http://localhost/api/inventory", { method: "POST", headers: { "content-type": "application/json" }, body: "{" })
    expect((await handler(malformed)).status).toBe(400)
  })
})

describe("bulk inventory boundary", () => {
  it("authorizes both endpoints and calls one atomic batch with the user client", async () => {
    const response = await bulk(request(input))
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(await response.json()).toEqual(result)
    expect(userCanOnLocation).toHaveBeenCalledWith(client, siteId, fromLocationId, "update")
    expect(userCanOnLocation).toHaveBeenCalledWith(client, siteId, toLocationId, "update")
    expect(executeInventoryBatch).toHaveBeenCalledTimes(1)
    expect(executeInventoryBatch).toHaveBeenCalledWith(client, input)
  })
  it.each([fromLocationId, toLocationId])("denies unauthorized endpoint %s before any write", async denied => {
    jest.mocked(userCanOnLocation).mockImplementation(async (_client, _site, location) => location !== denied)
    expect((await bulk(request(input))).status).toBe(403)
    expect(executeInventoryBatch).not.toHaveBeenCalled()
  })
  it.each([
    { ...input, requestId: "invalid" },
    { ...input, operations: [] },
    { ...input, operations: Array.from({ length: 101 }, () => transfer) },
    { ...input, operations: [{ ...transfer, quantity: "2" }] },
    { ...input, operations: [{ ...transfer, quantity: 0 }] },
    { ...input, operations: [{ ...transfer, quantity: -2 }] },
    { ...input, operations: [{ ...transfer, price: 1 }] },
    { ...input, operations: [{ ...transfer, kind: "delete" }] },
    { ...input, operations: [{ ...transfer, fromLocationId: toLocationId }] },
    { ...input, operations: [{ ...transfer, quantity: 1_000_000_001 }] },
    { ...input, operations: [{ ...transfer, notes: "x".repeat(1001) }] },
    { ...input, operations: [{ kind: "adjustment", catalogItemId, toLocationId, quantity: 0 }] },
  ])("rejects invalid types, size, quantities and forged fields", async invalid => {
    expect((await bulk(request(invalid))).status).toBe(400)
    expect(executeInventoryBatch).not.toHaveBeenCalled()
  })
  it("passes replay identity unchanged and exposes confirmed replay state", async () => {
    jest.mocked(executeInventoryBatch).mockResolvedValue({ ...result, alreadyApplied: true })
    expect((await (await bulk(request(input))).json()).alreadyApplied).toBe(true)
    expect(executeInventoryBatch).toHaveBeenCalledWith(client, input)
  })
  it("accepts 100 operations as one batch, including signed-delta adjustments", async () => {
    const operations = Array.from({ length: 100 }, () => ({ kind: "adjustment", catalogItemId, toLocationId, quantity: -1 }))
    expect((await bulk(request({ ...input, operations }))).status).toBe(200)
    expect(executeInventoryBatch).toHaveBeenCalledTimes(1)
    expect(executeInventoryBatch).toHaveBeenCalledWith(client, { ...input, operations })
  })
  it("preserves sanitized typed conflict and hides raw database errors", async () => {
    jest.mocked(executeInventoryBatch).mockRejectedValueOnce(new InventoryOperationError("Request ID conflicts with an existing batch", 409))
    expect((await bulk(request(input))).status).toBe(409)
    jest.mocked(executeInventoryBatch).mockRejectedValueOnce(new Error("secret SQL provider detail"))
    const response = await bulk(request(input))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain("secret")
  })
})

describe("receive bill boundary", () => {
  it.each([["42501", 403], ["22023", 400], ["23505", 409], ["P0001", 409]] as const)("maps database rejection %s safely", async (code, status) => {
    client.rpc.mockResolvedValue({ data: null, error: { code, message: "secret database detail" } })
    const response = await receiveBill(request(receipt))
    expect(response.status).toBe(status)
    expect(await response.text()).not.toContain("secret")
  })
  it("does not confirm malformed or mismatched RPC results", async () => {
    client.rpc.mockResolvedValue({ data: { ...result, requestId: purchaseId }, error: null })
    expect((await receiveBill(request(receipt))).status).toBe(503)
    client.rpc.mockResolvedValue({ data: { success: true }, error: null })
    expect((await receiveBill(request(receipt))).status).toBe(503)
  })
  it.each([
    { ...receipt, receivingUserId: undefined }, { ...receipt, lines: [] },
    { ...receipt, lines: [{ purchaseItemId, quantity: 0 }] },
    { ...receipt, lines: [{ purchaseItemId, quantity: "2" }] },
    { ...receipt, lines: [receipt.lines[0], receipt.lines[0]] },
    { ...receipt, lines: [{ catalogItemId, quantity: 2 }] },
  ])("rejects incomplete/invalid line or receiver input", async body => {
    expect((await receiveBill(request(body))).status).toBe(400)
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it("sanitizes uncertain RPC errors", async () => {
    client.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "secret" } })
    const response = await receiveBill(request(receipt))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain("secret")
  })
  it("dispatches actual bill-line quantities and receiver, scopes bill and preserves request ID", async () => {
    expect((await receiveBill(request(receipt))).status).toBe(200)
    expect(client.from).toHaveBeenCalledWith("purchases")
    expect(purchaseQuery.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(purchaseQuery.eq).toHaveBeenCalledWith("id", purchaseId)
    expect(userCanOnLocation).toHaveBeenCalledWith(client, siteId, fromLocationId, "update")
    expect(client.rpc).toHaveBeenCalledWith("receive_bill_inventory_lines", {
      p_site_id: siteId, p_request_id: requestId, p_purchase_id: purchaseId, p_location_id: toLocationId,
      p_receiving_user_id: receivingUserId, p_lines: receipt.lines,
    })
    expect(executeInventoryBatch).not.toHaveBeenCalled()
  })
  it("denies unavailable/cross-tenant bill without writes", async () => {
    purchaseQuery.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect((await receiveBill(request(receipt))).status).toBe(403)
    expect(executeInventoryBatch).not.toHaveBeenCalled()
  })
  it("cannot use an authorized destination to access a forbidden bill location", async () => {
    jest.mocked(userCanOnLocation).mockImplementation(async (_client, _site, location) => location === toLocationId)
    expect((await receiveBill(request(receipt))).status).toBe(403)
    expect(executeInventoryBatch).not.toHaveBeenCalled()
  })
  it("does not accept arbitrary products or payment state", async () => {
    expect((await receiveBill(request({ ...receipt, items: [{ quantity: 100 }], paid: true }))).status).toBe(400)
    expect(executeInventoryBatch).not.toHaveBeenCalled()
  })
})

describe.each([["bulk", bulk, input], ["receive-bill", receiveBill, receipt]] as const)("%s delegated JWT transport", (_name, handler, body) => {
  const userId = "00000000-0000-4000-8000-000000000007"
  const token = `header.${Buffer.from(JSON.stringify({ role: "authenticated", sub: userId })).toString("base64url")}.signature`
  const getUser = jest.fn()
  const bearerClient = { ...client, auth: { getUser } }
  const env = { ...process.env }
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_offline"
    jest.mocked(createClient).mockReturnValue(bearerClient as unknown as ReturnType<typeof createClient>)
    getUser.mockResolvedValue({ data: { user: { id: userId, role: "authenticated" } }, error: null })
    jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue("collaborator")
  })
  afterAll(() => { process.env = env })
  it("dispatches with verified bearer client, not cookie identity", async () => {
    expect((await handler(request(body, { authorization: `Bearer ${token}` }))).status).toBe(200)
    if (_name === "bulk") expect(executeInventoryBatch).toHaveBeenCalledWith(bearerClient, expect.objectContaining({ siteId, requestId }))
    else expect(bearerClient.rpc).toHaveBeenCalledWith("receive_bill_inventory_lines", expect.objectContaining({ p_site_id: siteId, p_request_id: requestId }))
    expect(userCanOnLocation).toHaveBeenCalledWith(bearerClient, siteId, toLocationId, "update")
    expect(requireSiteAccess).not.toHaveBeenCalled()
  })
  it("denies invalid bearer without cookie bypass or operations", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } })
    expect((await handler(request(body, { authorization: `Bearer ${token}` }))).status).toBe(401)
    expect(executeInventoryBatch).not.toHaveBeenCalled()
    expect(requireSiteAccess).not.toHaveBeenCalled()
  })
  it("denies bearer cross-site and forbidden location without operations", async () => {
    jest.mocked(lookupCurrentUserSiteRole).mockResolvedValueOnce(null)
    expect((await handler(request(body, { authorization: `Bearer ${token}` }))).status).toBe(403)
    jest.mocked(userCanOnLocation).mockResolvedValue(false)
    expect((await handler(request(body, { authorization: `Bearer ${token}` }))).status).toBe(403)
    expect(executeInventoryBatch).not.toHaveBeenCalled()
  })
})
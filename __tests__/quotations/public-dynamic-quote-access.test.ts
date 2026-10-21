/** @jest-environment node */
import { requestPublicDynamicQuote } from "@/app/quotations/public-dynamic-quote"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { executeVerifiedDynamicQuote } from "@/app/quotations/dynamic-quote-request"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }))
jest.mock("@/app/quotations/dynamic-quote-request", () => ({ executeVerifiedDynamicQuote: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const catalogItemId = "22222222-2222-4222-8222-222222222222"
const input = { siteId, catalogItemId, quantity: 1, fieldValues: {} }
const getUser = jest.fn()
const from = jest.fn()
const eq = jest.fn().mockReturnThis()
const insert = jest.fn().mockReturnThis()
const single = jest.fn()
const maybeSingle = jest.fn()
const query = { select: jest.fn().mockReturnThis(), eq, is: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), single, maybeSingle, insert }

beforeEach(() => {
  jest.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: "buyer", email: "buyer@example.com", email_confirmed_at: "2026-01-01" } }, error: null })
  ;(createClient as jest.Mock).mockResolvedValue({ auth: { getUser } })
  ;(createAdmin as jest.Mock).mockReturnValue({ from })
  from.mockReturnValue(query)
  single.mockResolvedValue({ data: { id: catalogItemId, is_dynamic_price: true, site: { id: siteId, user_id: "owner" } }, error: null })
  maybeSingle.mockResolvedValue({ data: { id: "own-lead" }, error: null })
  ;(executeVerifiedDynamicQuote as jest.Mock).mockResolvedValue({ data: {
    quotationId: "new-quote", quotationItemId: "new-item", progressAccessToken: "token", status: "processing", assistantInstanceId: "secret",
  } })
})

it.each([null, { id: "guest", is_anonymous: true }, { id: "unverified", email: "buyer@example.com" }])(
  "requires a real authenticated verified buyer %p", async (user) => {
    getUser.mockResolvedValue({ data: { user }, error: null })
    expect((await requestPublicDynamicQuote(input)).error).toBeTruthy()
    expect(createAdmin).not.toHaveBeenCalled()
  },
)

it.each(["leadId", "quotationId", "dealId", "buyerUserId", "ownerUserId"])("rejects caller identity/resource override %s", async (key) => {
  expect((await requestPublicDynamicQuote({ ...input, [key]: "victim" } as any)).error).toBe("Invalid quote request")
  expect(createAdmin).not.toHaveBeenCalled()
  expect(executeVerifiedDynamicQuote).not.toHaveBeenCalled()
})

it("denies products outside the active public listing projection before creating leads", async () => {
  single.mockResolvedValue({ data: null, error: null })
  expect((await requestPublicDynamicQuote(input)).error).toBeTruthy()
  expect(eq).toHaveBeenCalledWith("status", "active")
  expect(eq).toHaveBeenCalledWith("site_id", siteId)
  expect(query.is).toHaveBeenCalledWith("site.archived_at", null)
  expect(insert).not.toHaveBeenCalled()
  expect(executeVerifiedDynamicQuote).not.toHaveBeenCalled()
})

it("allows a nonstaff buyer to request only a new own quote without leaking workflow context", async () => {
  const result = await requestPublicDynamicQuote(input)
  expect(result.error).toBeUndefined()
  expect(eq).toHaveBeenCalledWith("buyer_user_id", "buyer")
  expect(executeVerifiedDynamicQuote).toHaveBeenCalledWith({ ...input, leadId: "own-lead" }, expect.anything(), { buyer_user_id: "buyer" })
  expect(result.data).not.toHaveProperty("assistantInstanceId")
})

it("does not claim an existing email-only lead when creating a buyer intake", async () => {
  maybeSingle.mockResolvedValue({ data: null, error: null })
  single.mockResolvedValueOnce({ data: { is_dynamic_price: true, site: { user_id: "owner" } }, error: null })
    .mockResolvedValueOnce({ data: { id: "new-lead" }, error: null })
  await requestPublicDynamicQuote(input)
  expect(insert).toHaveBeenCalledWith([expect.objectContaining({ buyer_user_id: "buyer", email: "buyer@example.com", user_id: "owner" })])
  expect(eq).not.toHaveBeenCalledWith("email", expect.anything())
})

it.each([{ arbitrary: "injected context" }, { field: { deep: "payload" } }, { field: "a".repeat(2001) }])(
  "rejects undeclared, nested, or oversized assistant field input %p", async (fieldValues) => {
    expect((await requestPublicDynamicQuote({ ...input, fieldValues })).error).toBeTruthy()
    expect(executeVerifiedDynamicQuote).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  },
)
/** @jest-environment node */
import { requestDynamicQuote, authorizeDynamicQuote, applyDynamicQuoteFromText, retryDynamicQuoteItem } from "@/app/quotations/dynamic-quote-actions"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { ensurePublicAccessTokenForRecord } from "@/app/documents/public-token-store"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }))
jest.mock("@/app/documents/public-token-store", () => ({ ensurePublicAccessTokenForRecord: jest.fn() }))
jest.mock("@/app/quotations/catalog-item-requirements", () => ({ ensureCatalogItemRequirement: jest.fn() }))
jest.mock("@/app/quotations/dynamic-quote-apply", () => ({ getSiteOwnerUserId: jest.fn() }))
jest.mock("@/app/quotations/dynamic-quote-resolve", () => ({ scheduleAssistantQuoteResolution: jest.fn() }))

const rpc = jest.fn()
const getUser = jest.fn()
const from = jest.fn()
const input = { siteId: "site", catalogItemId: "product", leadId: "lead", quotationId: "quote" }
beforeEach(() => {
  jest.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: "staff" } }, error: null })
  rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "owner" : name === "user_can", error: null }))
  ;(createClient as jest.Mock).mockResolvedValue({ auth: { getUser }, rpc, from })
})

it("requires authentication before private quote lookup and service token issuance", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  await expect(requestDynamicQuote(input)).resolves.toEqual({ error: "Not authenticated" })
  expect(from).not.toHaveBeenCalled()
  expect(createAdmin).not.toHaveBeenCalled()
  expect(ensurePublicAccessTokenForRecord).not.toHaveBeenCalled()
})

it.each([true, null, "false"])("rejects restricted or unverifiable staff scope %p", async (state) => {
  rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "admin" : state, error: null }))
  expect((await requestDynamicQuote(input)).error).toBeTruthy()
  expect(from).not.toHaveBeenCalled()
  expect(createAdmin).not.toHaveBeenCalled()
})

it("requires supplied quotation and lead to be readable in the same site", async () => {
  const eq = jest.fn().mockReturnThis()
  const single = jest.fn().mockResolvedValueOnce({ data: { id: "lead", buyer_user_id: "buyer" }, error: null })
    .mockResolvedValueOnce({ data: null, error: null })
  from.mockReturnValue({ select: jest.fn().mockReturnThis(), eq, single })
  expect((await requestDynamicQuote(input)).error).toBe("Quotation not available")
  expect(eq).toHaveBeenCalledWith("site_id", "site")
  expect(eq).toHaveBeenCalledWith("lead_id", "lead")
  expect(createAdmin).not.toHaveBeenCalled()
  expect(ensurePublicAccessTokenForRecord).not.toHaveBeenCalled()
})

it.each([
  () => authorizeDynamicQuote("quote"),
  () => retryDynamicQuoteItem("item"),
  () => applyDynamicQuoteFromText({ quotationItemId: "item", assistantText: '{"unit_price":1}' }),
])("guards every mutation action before reading a private record", async (action) => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect((await action()).error).toBe("Not authenticated")
  expect(from).not.toHaveBeenCalled()
})
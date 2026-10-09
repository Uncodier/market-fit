/** @jest-environment node */
import { randomBytes, randomUUID } from "node:crypto"
import { createHash } from "node:crypto"
import { GET, POST } from "@/app/api/stripe/auto-top-up/route"
import { resolveBillingPaymentMethod } from "@/lib/billing/payment-method.server"
const site = randomUUID(), actor = randomUUID(), token = randomUUID()
const access = jest.fn(), can = jest.fn(), rpc = jest.fn(), from = jest.fn(), retrieve = jest.fn()
const billing = { stripe_customer_id: "cus_synthetic", stripe_subscription_id: "sub_synthetic" }
const method = { id: "pm_synthetic", customer: billing.stripe_customer_id, type: "card",
  card: { brand: "visa", last4: "1234", exp_month: 12, exp_year: 2099 } }
const hash = createHash("sha256").update(method.id).digest("hex")
const values = { enabled: false, minimum_credits: 5, target_credits: 20, max_monthly_spend_cents: 10000, stripe_payment_method_id: method.id, state: "ready" }
let setup: null | {token:string;status:string;source:string;stripe_payment_method_id?:string;stripe_customer_id?:string}
let setting: typeof values | null
jest.mock("stripe", () => ({ __esModule: true, default: jest.fn(() => ({ paymentMethods: { retrieve } })) }))
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: (...args: unknown[]) => access(...args) }))
jest.mock("@/lib/permissions/site-access", () => ({ userCanOnSite: (...args: unknown[]) => can(...args) }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: async () => ({ rpc, from }) }))
jest.mock("@/lib/http/api-proxy-security", () => ({ isSameOriginApiRequest: () => true }))
jest.mock("@/lib/billing/payment-method.server", () => {
  const original = jest.requireActual("@/lib/billing/payment-method.server")
  return { ...original, resolveBillingPaymentMethod: jest.fn() }
})
const originalSecret = process.env.STRIPE_SECRET_KEY
beforeEach(() => {
  jest.clearAllMocks(); setup = { token, status: "completed", source: "top_up", stripe_payment_method_id: method.id, stripe_customer_id: billing.stripe_customer_id }; setting = values
  process.env.STRIPE_SECRET_KEY = randomBytes(32).toString("hex")
  access.mockResolvedValue({ supabase: { from }, userId: actor }); can.mockResolvedValue(true)
  rpc.mockResolvedValue({ data: { success: true, outcome: "saved" }, error: null })
  from.mockImplementation((table: string) => {
    const b = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn(async () => ({ data: table === "billing" ? billing : table === "credit_auto_top_up_card_setups" ? setup : table === "credit_auto_top_up_settings" ? setting : null, error: null })) }
    b.select.mockReturnValue(b); b.eq.mockReturnValue(b); return b
  })
  retrieve.mockResolvedValue(method); jest.mocked(resolveBillingPaymentMethod).mockResolvedValue(method as never)
})
afterAll(() => { if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = originalSecret })
function request(input: unknown) { return new Request("https://app.example.test/api/stripe/auto-top-up", { method: "POST", headers: { "content-type": "application/json", cookie: "synthetic=1" }, body: JSON.stringify(input) }) }
const valid = { siteId: site, enabled: true, minimumCredits: 5, targetCredits: 20, maxMonthlySpendCents: 10000, consentAccepted: true }
it("requires manager authorization and rejects client card IDs", async () => {
  access.mockResolvedValueOnce({ error: Response.json({}, { status: 403 }) })
  expect((await POST(request(valid))).status).toBe(403); expect(rpc).not.toHaveBeenCalled()
  expect((await POST(request({ ...valid, stripe_payment_method_id: "pm_injected" }))).status).toBe(400)
  expect((await POST(request(valid))).status).toBe(200)
  expect(rpc).toHaveBeenCalledWith("set_credit_auto_top_up_settings", { p_site_id: site, p_actor_id: actor, p_enabled: true, p_minimum_credits: 5, p_target_credits: 20, p_max_monthly_spend_cents: 10000 })
})
it("rejects invalid limits and missing consent", async () => {
  for (const input of [{ targetCredits: 4 }, { maxMonthlySpendCents: -1 }, { consentAccepted: false }]) expect((await POST(request({ ...valid, ...input }))).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
})
it("presents Billing's principal card by default without mutating settings", async () => {
  setup = null; setting = null
  const response = await GET(new Request(`https://app.example.test/api/stripe/auto-top-up?siteId=${site}`)), body = await response.json()
  expect(response.status).toBe(200); expect(body.settings.billingCardAvailable).toBe(true)
  expect(body.settings.paymentMethodReady).toBe(false); expect(body.settings.enabled).toBe(false)
  expect(body.settings.paymentMethod.last4).toBe("1234"); expect(body.settings.billingCardFingerprint).toBe(hash)
  expect(JSON.stringify(body)).not.toContain(method.id); expect(rpc).not.toHaveBeenCalled()
})
it("atomically adopts the displayed Billing card only with explicit consent", async () => {
  setup = null
  expect((await POST(request({ ...valid, billingCardFingerprint: hash }))).status).toBe(200)
  expect(rpc).toHaveBeenCalledWith("save_credit_auto_top_up_with_billing_card", expect.objectContaining({ p_actor_id: actor, p_stripe_customer_id: billing.stripe_customer_id, p_stripe_payment_method_id: method.id, p_expected_setup_token: null }))
})
it("rejects changed displayed card and unfinished explicit card setup", async () => {
  setup = null
  expect((await POST(request({ ...valid, billingCardFingerprint: "0".repeat(64) }))).status).toBe(409)
  setup = { token, status: "pending", source: "top_up" }
  expect((await POST(request({ ...valid, billingCardFingerprint: hash }))).status).toBe(409)
  expect(rpc).not.toHaveBeenCalled()
})
it("keeps a specifically chosen top-up card instead of replacing it with the default", async () => {
  const body = await (await GET(new Request(`https://app.example.test/api/stripe/auto-top-up?siteId=${site}`))).json()
  expect(body.settings.paymentMethodReady).toBe(true); expect(body.settings.paymentMethodSource).toBe("top_up")
  expect(jest.mocked(resolveBillingPaymentMethod)).not.toHaveBeenCalled()
})
it("disables without Stripe availability or another card setup", async () => {
  delete process.env.STRIPE_SECRET_KEY
  expect((await POST(request({ ...valid, enabled: false, consentAccepted: false }))).status).toBe(200)
  expect(rpc).toHaveBeenCalledWith("set_credit_auto_top_up_settings", expect.objectContaining({ p_enabled: false }))
  expect(retrieve).not.toHaveBeenCalled()
})

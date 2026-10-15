/** @jest-environment node */
import { randomBytes, randomUUID } from "node:crypto"
import { POST } from "@/app/api/stripe/auto-top-up/worker/route"

const rpc = jest.fn(), processSite = jest.fn()
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: async () => ({ rpc }) }))
jest.mock("@/app/api/stripe/auto-top-up/worker/process", () => ({ processAutoTopUpSite: (...args: unknown[]) => processSite(...args) }))
jest.mock("stripe", () => ({ __esModule: true, default: jest.fn(() => ({})) }))
const originalServiceKey = process.env.SERVICE_API_KEY, originalStripe = process.env.STRIPE_SECRET_KEY
let secret: string
beforeEach(() => {
  jest.clearAllMocks(); secret = randomBytes(32).toString("hex")
  process.env.SERVICE_API_KEY = secret
  process.env.STRIPE_SECRET_KEY = randomBytes(32).toString("hex")
})
afterEach(() => { jest.restoreAllMocks() })
afterAll(() => {
  if (originalServiceKey === undefined) delete process.env.SERVICE_API_KEY; else process.env.SERVICE_API_KEY = originalServiceKey
  if (originalStripe === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = originalStripe
})
function request(token = secret) { return new Request("https://billing.example.test/api/stripe/auto-top-up/worker", { method: "POST", headers: { 'x-api-key': token } }) }
it("rejects absent/wrong credentials without database access", async () => {
  expect((await POST(request(randomBytes(32).toString("hex")))).status).toBe(401)
  delete process.env.SERVICE_API_KEY
  expect((await POST(request())).status).toBe(401); expect(rpc).not.toHaveBeenCalled()
})
it("validates bounded site UUID candidates before any charge", async () => {
  rpc.mockResolvedValue({ data: [{ site_id: "not-a-site" }], error: null })
  expect((await POST(request())).status).toBe(503); expect(processSite).not.toHaveBeenCalled()
})
it("stops admitting new sites before the function timeout", async () => {
  const siteIds = [randomUUID(), randomUUID()]
  rpc.mockResolvedValue({ data: siteIds.map(site_id => ({ site_id })), error: null })
  let now = 1000
  jest.spyOn(Date, "now").mockImplementation(() => now)
  processSite.mockImplementation(async () => { now += 181000; return "succeeded" })
  const response = await POST(request())
  const body = await response.json()
  expect(body.deferred).toBe(1); expect(processSite).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(body)).not.toContain(secret)
  expect(JSON.stringify(body)).not.toContain(process.env.STRIPE_SECRET_KEY)
})
it("isolates a failed site and does not leak provider errors or secrets", async () => {
  rpc.mockResolvedValue({ data: [{ site_id: randomUUID() }], error: null })
  processSite.mockRejectedValueOnce(new Error(secret))
  const response = await POST(request()), body = await response.json()
  expect(body.results[0].outcome).toBe("needs_reconciliation")
  expect(JSON.stringify(body)).not.toContain(secret)
})

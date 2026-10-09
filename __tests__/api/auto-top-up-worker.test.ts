/** @jest-environment node */
import { randomBytes, randomUUID } from "node:crypto"
import { GET } from "@/app/api/stripe/auto-top-up/worker/route"

const rpc = jest.fn(), processSite = jest.fn()
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: async () => ({ rpc }) }))
jest.mock("@/app/api/stripe/auto-top-up/worker/process", () => ({ processAutoTopUpSite: (...args: unknown[]) => processSite(...args) }))
jest.mock("stripe", () => ({ __esModule: true, default: jest.fn(() => ({})) }))
const originalCron = process.env.CRON_SECRET, originalStripe = process.env.STRIPE_SECRET_KEY
let secret: string
beforeEach(() => {
  jest.clearAllMocks(); secret = randomBytes(32).toString("hex")
  process.env.CRON_SECRET = secret
  process.env.STRIPE_SECRET_KEY = randomBytes(32).toString("hex")
})
afterEach(() => { jest.restoreAllMocks() })
afterAll(() => {
  if (originalCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = originalCron
  if (originalStripe === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = originalStripe
})
function request(token = secret) { return new Request("https://billing.example.test/api/stripe/auto-top-up/worker", { headers: { authorization: `Bearer ${token}` } }) }
it("rejects absent/wrong credentials without database access", async () => {
  expect((await GET(request(randomBytes(32).toString("hex")))).status).toBe(401)
  delete process.env.CRON_SECRET
  expect((await GET(request())).status).toBe(401); expect(rpc).not.toHaveBeenCalled()
})
it("validates bounded site UUID candidates before any charge", async () => {
  rpc.mockResolvedValue({ data: [{ site_id: "not-a-site" }], error: null })
  expect((await GET(request())).status).toBe(503); expect(processSite).not.toHaveBeenCalled()
})
it("stops admitting new sites before the function timeout", async () => {
  const siteIds = [randomUUID(), randomUUID()]
  rpc.mockResolvedValue({ data: siteIds.map(site_id => ({ site_id })), error: null })
  let now = 1000
  jest.spyOn(Date, "now").mockImplementation(() => now)
  processSite.mockImplementation(async () => { now += 181000; return "succeeded" })
  const response = await GET(request())
  const body = await response.json()
  expect(body.deferred).toBe(1); expect(processSite).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(body)).not.toContain(secret)
  expect(JSON.stringify(body)).not.toContain(process.env.STRIPE_SECRET_KEY)
})
it("isolates a failed site and does not leak provider errors or secrets", async () => {
  rpc.mockResolvedValue({ data: [{ site_id: randomUUID() }], error: null })
  processSite.mockRejectedValueOnce(new Error(secret))
  const response = await GET(request()), body = await response.json()
  expect(body.results[0].outcome).toBe("needs_reconciliation")
  expect(JSON.stringify(body)).not.toContain(secret)
})

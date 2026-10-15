/** @jest-environment node */
jest.mock("server-only", () => ({}))
import { randomBytes } from "node:crypto"
import { uberWebhookSigningKey } from "@/lib/marketplace/merchant/signing-key"
import { platformReady } from "@/lib/marketplace/merchant/platform"

const original = { ...process.env }
beforeEach(() => {
  delete process.env.UBER_EATS_WEBHOOK_SIGNING_KEY
  delete process.env.UBER_EATS_SANDBOX_WEBHOOK_SIGNING_KEY
})
afterEach(() => { process.env = { ...original } })
const config = () => ({ credential_mode: "platform" as const, environment: "production" as const, client_secret: randomBytes(32).toString("hex") })

it("reads separate production and sandbox keys without an OAuth or production fallback", () => {
  const productionKey = randomBytes(32).toString("hex"), sandboxKey = randomBytes(32).toString("hex")
  process.env.UBER_EATS_WEBHOOK_SIGNING_KEY = productionKey
  expect(uberWebhookSigningKey(config())).toBe(productionKey)
  expect(uberWebhookSigningKey({ ...config(), environment: "sandbox" })).toBe("")
  process.env.UBER_EATS_SANDBOX_WEBHOOK_SIGNING_KEY = sandboxKey
  expect(uberWebhookSigningKey({ ...config(), environment: "sandbox" })).toBe(sandboxKey)
})
it("fails closed when the explicit platform key is absent or blank", () => {
  expect(uberWebhookSigningKey(config())).toBe("")
  process.env.UBER_EATS_WEBHOOK_SIGNING_KEY = "  "
  expect(uberWebhookSigningKey(config())).toBe("")
})
it("never applies Makinari's signing key to a third-party application", () => {
  process.env.UBER_EATS_WEBHOOK_SIGNING_KEY = randomBytes(32).toString("hex")
  const custom = { ...config(), credential_mode: "custom" as const }
  expect(uberWebhookSigningKey(custom)).toBe(custom.client_secret)
  const legacy = { environment: "production" as const, client_secret: randomBytes(32).toString("hex") }
  expect(uberWebhookSigningKey(legacy)).toBe(legacy.client_secret)
})
it("never marks the platform application ready before webhook signing is configured", () => {
  process.env.UBER_EATS_CLIENT_ID = randomBytes(24).toString("hex")
  process.env.UBER_EATS_CLIENT_SECRET = randomBytes(32).toString("hex")
  expect(platformReady("uber_eats", "production")).toBe(false)
  process.env.UBER_EATS_WEBHOOK_SIGNING_KEY = randomBytes(32).toString("hex")
  expect(platformReady("uber_eats", "production")).toBe(true)
})
it("does not include malformed secret material in errors", () => {
  const secret = randomBytes(32).toString("hex")
  process.env.UBER_EATS_WEBHOOK_SIGNING_KEY = `${secret}\n`
  let message = ""
  try { uberWebhookSigningKey(config()) } catch (error) { message = String(error) }
  expect(message).toContain("configuration is invalid")
  expect(message).not.toContain(secret)
})
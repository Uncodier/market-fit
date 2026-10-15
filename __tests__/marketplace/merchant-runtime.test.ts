/** @jest-environment node */
jest.mock("server-only", () => ({}))
import { createHmac, randomBytes } from "node:crypto"
import { marketplaceWebhookDependencies } from "@/lib/marketplace/runtime"
import type { ProviderConfig } from "@/lib/marketplace/providers/types"

it("matches Rappi signatures to the registered event, not a different event key", () => {
  const cancelKey = randomBytes(32).toString("hex"), newKey = randomBytes(32).toString("hex")
  const config: ProviderConfig = { provider:"rappi",environment:"sandbox",country:"MX",store_id:"store-1",
    client_id:randomBytes(24).toString("hex"),client_secret:randomBytes(24).toString("hex"),
    webhook_secrets:{NEW_ORDER:newKey,ORDER_EVENT_CANCEL:cancelKey} }
  const raw = JSON.stringify({ store_id:"store-1", order_id:"order-1", event:"cancel_by_user" })
  const timestamp = Math.floor(Date.now()/1000)
  const sign = (key:string) => `t=${timestamp},sign=${createHmac("sha256",key).update(`${timestamp}.`).update(raw).digest("hex")}`
  expect(marketplaceWebhookDependencies.verify("rappi",raw,sign(cancelKey),config)).toBe(true)
  expect(marketplaceWebhookDependencies.verify("rappi",raw,sign(newKey),config)).toBe(false)
  expect(marketplaceWebhookDependencies.verify("rappi",raw,null,config)).toBe(false)
})

it("uses Uber's explicit signing key for orders, independently of OAuth", () => {
  const oauth = randomBytes(32).toString("hex"), signingKey = randomBytes(32).toString("hex")
  const config: ProviderConfig = { provider: "uber_eats", environment: "production", country: "MX", store_id: "store-1",
    client_id: randomBytes(24).toString("hex"), client_secret: oauth, webhook_signing_key: signingKey }
  const raw = JSON.stringify({ event_type: "orders.notification", meta: { user_id: "store-1", resource_id: "order-1" } })
  const sign = (key: string) => createHmac("sha256", key).update(raw).digest("hex")
  expect(marketplaceWebhookDependencies.verify("uber_eats", raw, sign(signingKey), config)).toBe(true)
  expect(marketplaceWebhookDependencies.verify("uber_eats", raw, sign(oauth), config)).toBe(false)
  expect(marketplaceWebhookDependencies.verify("uber_eats", raw, sign(oauth), { ...config, webhook_signing_key: "" })).toBe(false)
})
import { readFileSync } from "node:fs"
import path from "node:path"

const paymentSources = [
  "app/api/stripe/webhook/route.ts",
  "app/api/stripe/webhook/checkout-session-handler.ts",
  "app/api/stripe/webhook/billing-event-handlers.ts",
  "app/api/stripe/webhook/webhook-delivery.ts",
  "app/api/stripe/webhook/sale-checkout-settlement.ts",
  "app/api/stripe/webhook/sale-settlement-effects.ts",
  "app/api/stripe/webhook/sale-settlement-compensation.ts",
  "app/commerce/post-payment.ts",
  "app/commerce/entitlements.ts",
  "app/shipments/actions.ts",
  "supabase/migrations/20260917210000_stripe_payment_security.sql",
  "supabase/migrations/20260917210100_stripe_webhook_delivery_claims.sql",
  "supabase/migrations/20260925000000_fix_webhook_events_status_constraint.sql",
  "supabase/migrations/20260917210200_stripe_settlement_effect_state.sql",
  "supabase/migrations/20260917210300_stripe_settlement_effect_execution.sql",
]

describe("Stripe webhook source boundaries", () => {
  it.each(paymentSources)("%s stays below 500 lines", (relativePath) => {
    const source = readFileSync(path.join(process.cwd(), relativePath), "utf8")
    expect(source.split("\n").length).toBeLessThan(500)
  })
})

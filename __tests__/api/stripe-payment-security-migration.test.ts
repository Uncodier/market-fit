import { readFileSync } from "node:fs"
import path from "node:path"

const paymentMigration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260917210000_stripe_payment_security.sql",
  ),
  "utf8",
)
const webhookMigration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260917210100_stripe_webhook_delivery_claims.sql",
  ),
  "utf8",
)
const webhookStatusMigration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260925000000_fix_webhook_events_status_constraint.sql",
  ),
  "utf8",
)
const effectStateMigration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260917210200_stripe_settlement_effect_state.sql",
  ),
  "utf8",
)
const effectExecutionMigration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260917210300_stripe_settlement_effect_execution.sql",
  ),
  "utf8",
)

describe("Stripe payment security migration", () => {
  it("uses durable, versioned checkout attempts", () => {
    expect(paymentMigration).toContain(
      "ADD COLUMN IF NOT EXISTS stripe_checkout_attempt bigint",
    )
    expect(paymentMigration).toContain(
      "sales_stripe_checkout_session_id_uidx",
    )
    expect(paymentMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.reserve_stripe_checkout_attempt",
    )
    expect(paymentMigration).toContain(
      "stripe_checkout_session_id = NULL",
    )
    expect(paymentMigration).toContain(
      "v_sale.stripe_checkout_session_id\n    IS DISTINCT FROM p_expected_session_id",
    )
  })

  it("atomically validates and settles the current checkout session", () => {
    expect(paymentMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.settle_stripe_sale_checkout",
    )
    expect(effectStateMigration).toContain("FOR UPDATE;")
    expect(effectStateMigration).toContain(
      "v_sale.status IN ('cancelled', 'refunded')",
    )
    expect(effectStateMigration).toContain(
      "v_sale.status NOT IN ('pending', 'completed')",
    )
    expect(effectStateMigration).toContain(
      "v_sale.stripe_checkout_session_id IS DISTINCT FROM p_session_id",
    )
    expect(effectStateMigration).toContain("v_expected_minor <> p_amount_minor")
    expect(effectStateMigration).toContain(
      "v_order.status IN ('cancelled', 'refunded')",
    )
    expect(effectStateMigration).toContain("'status', 'already_settled'")
    expect(effectStateMigration).toContain("'resume_effects'")
  })

  it("preserves an already completed order during settlement", () => {
    expect(effectStateMigration).toContain(
      "WHEN v_order.status = 'completed'\n        OR v_order.fulfillment_method = 'none' THEN 'completed'",
    )
  })

  it("claims webhook delivery with a unique event and ownership token", () => {
    expect(webhookMigration).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_stripe_event_id_key",
    )
    expect(webhookMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event",
    )
    expect(webhookMigration).toContain(
      "ON CONFLICT (stripe_event_id) DO NOTHING",
    )
    expect(webhookMigration).toContain("AND claim_token = p_claim_token")
    expect(webhookMigration).toContain("'outcome', 'in_progress'")
    expect(webhookMigration).toContain(
      "DROP FUNCTION IF EXISTS public.check_webhook_event_processed(uuid)",
    )
    expect(webhookMigration).toContain(
      "DROP FUNCTION IF EXISTS public.mark_webhook_event_processed(uuid)",
    )
    expect(webhookMigration).toContain(
      "DROP FUNCTION IF EXISTS public.mark_webhook_event_failed(uuid)",
    )
  })

  it("allows every webhook delivery status used by the claim protocol", () => {
    expect(webhookStatusMigration).toContain(
      "DROP CONSTRAINT IF EXISTS webhook_events_status_check",
    )
    expect(webhookStatusMigration).toContain(
      "status IN ('processing', 'processed', 'failed', 'skipped')",
    )
    expect(webhookStatusMigration).toContain(
      "VALIDATE CONSTRAINT webhook_events_status_check",
    )
  })

  it("keeps payment RPCs restricted to the service role", () => {
    expect(paymentMigration).toContain(
      "REVOKE ALL ON FUNCTION public.settle_stripe_sale_checkout",
    )
    expect(webhookMigration).toContain(
      "GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook_event",
    )
    expect(paymentMigration).toContain("TO service_role")
    expect(webhookMigration).toContain("TO service_role")
  })

  it("models KMF as zero-decimal and UGX as whole units times 100", () => {
    expect(paymentMigration).toContain("'jpy', 'kmf', 'krw'")
    expect(paymentMigration).toContain("IF v_currency = 'ugx'")
    expect(paymentMigration).toContain("v_minor := p_amount * 100")
    expect(paymentMigration).toContain("p_amount <> trunc(p_amount)")
  })

  it("persists retryable settlement phases and compensation", () => {
    expect(effectStateMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.stripe_sale_checkout_effects",
    )
    expect(effectStateMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.claim_stripe_sale_compensation",
    )
    expect(effectStateMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.complete_stripe_sale_compensation",
    )
    expect(effectExecutionMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.apply_stripe_sale_financial_effects",
    )
    expect(effectExecutionMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.claim_stripe_sale_fulfillment",
    )
    expect(effectExecutionMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.apply_stripe_sale_inventory_effect",
    )
    expect(effectExecutionMigration).toContain(
      "payments_transaction_id_uidx",
    )
    expect(effectExecutionMigration).toContain(
      "shipments_stripe_checkout_session_id_uidx",
    )
  })

  it("refuses fulfillment after the linked order becomes terminal", () => {
    expect(effectExecutionMigration).toContain(
      "v_order_status IN ('cancelled', 'refunded')",
    )
    expect(effectExecutionMigration).toContain(
      "WHERE id = v_effect.order_id\n      AND sale_id = p_sale_id\n    FOR UPDATE",
    )
    expect(effectExecutionMigration.indexOf(
      "v_order_status IN ('cancelled', 'refunded')",
    )).toBeLessThan(effectExecutionMigration.indexOf(
      "v_effect.fulfillment_status = 'processing'",
    ))
  })

  it("preflights and serializes the billing site uniqueness invariant", () => {
    expect(effectExecutionMigration).toContain(
      "GROUP BY site_id\n    HAVING count(*) > 1",
    )
    expect(effectExecutionMigration).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS billing_site_id_uidx",
    )
    expect(effectExecutionMigration).toContain(
      "pg_advisory_xact_lock",
    )
    expect(effectExecutionMigration).toContain(
      "ON CONFLICT (site_id) DO UPDATE",
    )
  })
})

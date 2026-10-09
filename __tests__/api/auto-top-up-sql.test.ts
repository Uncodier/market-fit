/** @jest-environment node */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261009030000_auto_top_up.sql"), "utf8")
it("restricts automatic charge admission and credit settlement to the service role", () => {
  expect(sql).toMatch(/ALTER TABLE public\.credit_auto_top_up_attempts ENABLE ROW LEVEL SECURITY/i)
  expect(sql).toMatch(/ALTER TABLE public\.credit_auto_top_up_settings ENABLE ROW LEVEL SECURITY/i)
  expect(sql).toMatch(/CREATE UNIQUE INDEX credit_auto_top_up_one_pending_per_site/i)
  expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.assert_credit_auto_top_up_service_role\(\)/i)
  expect(sql).toMatch(/FROM PUBLIC,anon,authenticated/i)
  expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.set_credit_auto_top_up_settings/i)
  expect(sql).toMatch(/TO service_role/i)
  expect(sql).toMatch(/to_regprocedure\('public\.grant_purchased_site_credits\(uuid,numeric,text,jsonb\)'\)/i)
})
it("reserves full monthly spend, never evicts pending work and uses the classified grant", () => {
  expect(sql).toMatch(/status IN \('pending','succeeded'\)/i)
  expect(sql).toMatch(/v_spent\+v_cents > s\.max_monthly_spend_cents/i)
  expect(sql).toMatch(/a\.created_at < now\(\)-interval '23 hours'/i)
  expect(sql).toMatch(/public\.grant_purchased_site_credits\(p_site_id,a\.credits,p_stripe_payment_intent_id/i)
  expect(sql).toMatch(/ON public\.credit_auto_top_up_attempts\(site_id\) WHERE status = 'pending'/i)
})
it("selects recovery and fresh candidates in a bounded, fair batch", () => {
  expect(sql).toMatch(/CREATE FUNCTION public\.list_credit_auto_top_up_candidates\(p_limit integer DEFAULT 20\)/i)
  expect(sql).toMatch(/greatest\(1,\(p_limit\+1\)\/2\)/i)
  expect(sql).toMatch(/public\.renew_site_plan_credits\(p_site_id\)/i)
})

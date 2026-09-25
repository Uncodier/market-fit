import fs from "node:fs"
import path from "node:path"

describe("billing add-ons migration", () => {
  const sql = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260925233000_add_billing_addons_count.sql",
    ),
    "utf8",
  )

  it("adds the webhook field with the required integer contract", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.billing[\s\S]*ADD COLUMN IF NOT EXISTS addons_count integer NOT NULL DEFAULT 0/i,
    )
  })

  it("does not change billing plan constraints", () => {
    expect(sql).not.toMatch(/billing_plan_check|DROP CONSTRAINT/i)
  })
})

describe("legacy billing plan normalization", () => {
  const sql = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260925234000_normalize_legacy_billing_plans.sql",
    ),
    "utf8",
  )

  it("uses the canonical mappings consumed by the webhook", () => {
    expect(sql).toContain("WHEN 'starter' THEN 'engine'")
    expect(sql).toContain("WHEN 'startup' THEN 'foundry'")
  })

  it("does not rewrite unrelated legacy plans", () => {
    expect(sql).toContain("WHERE plan IN ('starter', 'startup')")
    expect(sql).not.toMatch(/WHEN 'free'/)
  })

  it("recovers the failed renewal exactly once", () => {
    expect(sql).toContain("in_1UJKZIIFbIhqNGTbSRcVDdHp")
    expect(sql).toContain("subscription_renewal_recovery")
    expect(sql).toMatch(/NOT EXISTS \([\s\S]*public\.credit_transactions/)
    expect(sql).toContain("credits_available = coalesce(credits_available, 0) + 100")
  })
})
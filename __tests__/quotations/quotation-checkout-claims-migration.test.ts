import fs from "node:fs"
import path from "node:path"

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260917213000_quotation_checkout_claims.sql"
  ),
  "utf8"
)

describe("quotation checkout claims migration", () => {
  it("stores claim and completed checkout identities", () => {
    expect(migration).toContain("checkout_claim_id uuid")
    expect(migration).toContain("checkout_claimed_at timestamptz")
    expect(migration).toContain("checkout_sale_id uuid")
    expect(migration).toContain("checkout_order_id uuid")
  })

  it("enforces one sale and one order per quotation", () => {
    expect(migration).toContain("sales_quotation_id_unique")
    expect(migration).toContain("sale_orders_quotation_id_unique")
    expect(migration).toContain("WHERE quotation_id IS NOT NULL")
  })

  it("validates token lifecycle and supports stale claim recovery", () => {
    expect(migration).toContain("claim_quotation_checkout")
    expect(migration).toContain("public_access_token_revoked_at IS NULL")
    expect(migration).toContain("public_access_token_expires_at > now()")
    expect(migration).toContain("interval '10 minutes'")
  })

  it("requires exact non-null buyer ownership without a public token", () => {
    expect(migration).toContain("quotation_row.buyer_user_id IS NOT NULL")
    expect(migration).toContain(
      "quotation_row.buyer_user_id = p_buyer_user_id"
    )
    expect(migration).not.toContain(
      "quotation_row.buyer_user_id IS NULL\n      OR quotation_row.buyer_user_id = p_buyer_user_id"
    )
  })

  it("finishes and releases only the matching claim", () => {
    expect(migration).toContain("complete_quotation_checkout")
    expect(migration).toContain("release_quotation_checkout_claim")
    expect(migration).toContain(
      "checkout_claim_id IS DISTINCT FROM p_claim_id"
    )
    expect(migration).toContain("checkout_claim_id = p_claim_id")
  })
})

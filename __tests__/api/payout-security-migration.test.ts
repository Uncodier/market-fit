import { readFileSync } from "node:fs"
import path from "node:path"

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260917190000_payout_security_hardening.sql"
  ),
  "utf8"
)

describe("payout security migration", () => {
  it("removes direct payout mutation access from API users", () => {
    expect(migration).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON TABLE public.payout_requests\n  FROM authenticated"
    )
    expect(migration).toContain(
      "public.current_user_site_role(site_id) IN ('owner', 'admin')"
    )
  })

  it("keeps privileged balance functions service-only", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.deduct_balance(uuid, numeric)"
    )
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.add_balance(uuid, numeric)"
    )
    expect(migration).toContain("FROM PUBLIC, anon, authenticated")
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.deduct_balance(uuid, numeric) TO service_role"
    )
  })

  it("rejects non-positive balance mutations", () => {
    expect(migration).toContain("p_amount IS NULL OR p_amount <= 0")
    expect(migration).toContain(
      "p_requested_credits IS NULL OR p_requested_credits <= 0"
    )
  })

  it("resolves payouts atomically under a row lock", () => {
    expect(migration).toContain("FOR UPDATE;")
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.resolve_payout_request")
    expect(migration).toContain("AND status = 'pending'")
    expect(migration).toContain("PERFORM public.add_balance(")
  })

  it("revalidates and records the requesting site manager", () => {
    expect(migration).toContain("p_requested_by uuid")
    expect(migration).toContain("AND sm.status = 'active'")
    expect(migration).toContain("AND sm.role IN ('owner', 'admin')")
    expect(migration).toContain("requested_by")
  })

  it("uses a server-managed platform role source", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.platform_user_roles")
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.current_user_platform_role")
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.platform_user_roles FROM PUBLIC, anon, authenticated"
    )
  })
})

/** @jest-environment node */

import { readFileSync } from "node:fs"
import { join } from "node:path"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260920013000_payout_request_idempotency.sql"
  ),
  "utf8"
)

describe("payout idempotency migration", () => {
  it("enforces one payout request per site and idempotency key", () => {
    expect(migration).toContain(
      "ON public.payout_requests (site_id, idempotency_key)"
    )
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(migration).toContain("p_idempotency_key text")
  })

  it("keeps payout creation unavailable to browser roles", () => {
    expect(migration).toContain(
      ") FROM PUBLIC, anon, authenticated;"
    )
    expect(migration).toContain(") TO service_role;")
  })
})

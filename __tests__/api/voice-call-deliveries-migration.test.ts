/** @jest-environment node */

import { readFileSync } from "node:fs"
import { join } from "node:path"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260921190000_create_voice_call_deliveries.sql"
  ),
  "utf8"
)

describe("voice call deliveries migration", () => {
  it("prevents duplicate provider calls for the same queued message", () => {
    expect(migration).toContain(
      "CONSTRAINT voice_call_deliveries_message_unique UNIQUE (message_id)"
    )
    expect(migration).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS voice_call_deliveries_zavu_call_unique"
    )
    expect(migration).toContain("'placement_unknown'")
  })

  it("keeps call records unavailable to browser roles", () => {
    expect(migration).toContain(
      "ALTER TABLE public.voice_call_deliveries ENABLE ROW LEVEL SECURITY"
    )
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.voice_call_deliveries FROM authenticated"
    )
    expect(migration).toContain(
      "GRANT ALL ON TABLE public.voice_call_deliveries TO service_role"
    )
  })
})

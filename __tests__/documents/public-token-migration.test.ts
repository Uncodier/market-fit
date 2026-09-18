import { readFileSync } from "node:fs"
import path from "node:path"

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260917200000_public_document_token_lifecycle.sql"
  ),
  "utf8"
)

describe("public document token lifecycle migration", () => {
  it.each(["quotations", "sale_orders", "sales", "purchases"])(
    "adds expiry and revocation state to %s",
    (table) => {
      expect(migration).toContain(`ALTER TABLE public.${table}`)
      expect(migration).toContain("public_access_token text")
      expect(migration).toContain("public_access_token_expires_at timestamptz")
      expect(migration).toContain("public_access_token_revoked_at timestamptz")
    }
  )

  it.each(["quotations", "sale_orders", "sales", "purchases"])(
    "enforces unique non-null tokens for %s",
    (table) => {
      expect(migration).toContain(`ON public.${table} (public_access_token)`)
      expect(migration).toContain("WHERE public_access_token IS NOT NULL")
    }
  )
})

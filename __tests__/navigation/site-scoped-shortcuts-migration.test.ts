import { readFileSync } from "node:fs"
import path from "node:path"

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260922180000_scope_user_shortcuts_to_sites.sql",
  ),
  "utf8",
)

describe("site-scoped shortcut migration", () => {
  it("uses one shortcut row per user and site", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS site_id uuid")
    expect(migration).toContain("PRIMARY KEY (user_id, site_id)")
    expect(migration).toContain("REFERENCES public.sites(id)")
    expect(migration).toContain("ON DELETE CASCADE")
    expect(migration).toContain("REPLICA IDENTITY FULL")
    expect(migration).toContain("REPLICA IDENTITY DEFAULT")
  })

  it("copies legacy shortcuts to every accessible site", () => {
    expect(migration).toContain(
      "JOIN public.sites sites ON sites.user_id = legacy.user_id",
    )
    expect(migration).toContain(
      "JOIN public.site_ownership ownership ON ownership.user_id = legacy.user_id",
    )
    expect(migration).toContain(
      "JOIN public.site_members members ON members.user_id = legacy.user_id",
    )
    expect(migration).toContain("WHERE members.status = 'active'")
  })

  it("limits browser access to the user and an accessible site", () => {
    expect(migration).toContain("TO authenticated")
    expect(migration).toContain("(SELECT auth.uid()) = user_id")
    expect(migration).toContain(
      "public.current_user_site_role(site_id) IS NOT NULL",
    )
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.user_shortcuts FROM PUBLIC, anon",
    )
  })
})

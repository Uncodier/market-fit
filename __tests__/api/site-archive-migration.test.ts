/** @jest-environment node */
import fs from "node:fs"
import path from "node:path"

const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260929221000_archive_sites.sql"), "utf8")
const archive = migration.split("CREATE OR REPLACE FUNCTION public.archive_site(")[1].split("REVOKE ALL ON FUNCTION public.archive_site")[0]

it("archives atomically and preserves data instead of cascading a site delete", () => {
  expect(migration.trim()).toMatch(/^BEGIN;/)
  expect(migration.trim()).toMatch(/COMMIT;$/)
  expect(archive).toContain("FOR UPDATE")
  expect(archive).toContain("site_row.user_id IS DISTINCT FROM p_actor_id")
  expect(archive).toContain("IF site_row.archived_at IS NOT NULL THEN\n    RETURN true;")
  expect(archive).toContain("archived_at = now()")
  expect(archive).toContain("archived_by = p_actor_id")
  expect(archive).not.toMatch(/DELETE FROM public\.(sites|settings|site_members|site_ownership|billing|sales)\b/)
})

it("releases URL/domain mappings while retaining their originals and disabling API keys/tracking", () => {
  expect(archive).toContain("'url', site_row.url")
  expect(archive).toContain("'tracking', site_row.tracking")
  expect(archive).toContain("'allowed_domains', domain_snapshot")
  expect(archive).toContain("url = NULL")
  expect(archive).toContain("DELETE FROM public.allowed_domains WHERE site_id = p_site_id")
  expect(archive).toContain("UPDATE public.api_keys SET status = 'revoked'")
  expect(archive).toContain("'record_screen', false, 'enable_chat', false")
  expect(migration).toContain("WHERE id = NEW.site_id AND archived_at IS NULL FOR KEY SHARE")
})

it("restricts archive to the server and blocks legacy deletion and lifecycle field forgery", () => {
  expect(archive).toContain("auth.role() IS DISTINCT FROM 'service_role'")
  expect(migration).toContain("REVOKE ALL ON FUNCTION public.archive_site(uuid, uuid) FROM PUBLIC, anon, authenticated")
  expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.archive_site(uuid, uuid) TO service_role")
  expect(migration).toContain("REVOKE ALL ON FUNCTION public.delete_site_safely(uuid) FROM PUBLIC, anon, authenticated, service_role")
  expect(migration).toContain("REVOKE DELETE ON public.sites FROM PUBLIC, anon, authenticated")
  expect(migration).toContain("BEFORE INSERT OR UPDATE ON public.sites")
  expect(migration).toContain("NEW.archived_at IS DISTINCT FROM OLD.archived_at")
  expect(migration).toContain("AS RESTRICTIVE")
  expect(migration).toContain("USING (archived_at IS NULL) WITH CHECK (archived_at IS NULL)")
  expect(migration).not.toMatch(/DELETE FROM public\.sites\b/)
})

it("excludes archives from roles and accessible-site listings", () => {
  const roleFunction = migration.split("FUNCTION public.current_user_site_role(p_site_id uuid)")[1]
  expect(roleFunction).toContain("WHERE id = p_site_id AND archived_at IS NULL")
  expect(roleFunction).toContain("RETURN NULL")
  expect(migration).toContain("WHERE s.archived_at IS NULL AND (")
})
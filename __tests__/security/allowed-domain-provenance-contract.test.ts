/** @jest-environment node */
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { provenanceFile, provenanceSql as sql } from './allowed-domain-provenance-fixture'

describe('allowed-domain provenance migration contracts', () => {
  it('is a later, unique, atomic forward-only migration', () => {
    const files = readdirSync(path.join(process.cwd(), 'supabase/migrations'))
      .filter(file => /^\d{14}_/.test(file))
    expect(files.filter(file => file.startsWith(provenanceFile.slice(0, 14)))).toEqual([provenanceFile])
    expect(files.filter(file => file !== provenanceFile).every(file => file.slice(0, 14) < provenanceFile.slice(0, 14))).toBe(true)
    expect(provenanceFile.slice(0, 14) > '20261016171046').toBe(true)
    expect(sql).toMatch(/^BEGIN;/)
    expect(sql.trim()).toMatch(/COMMIT;$/)
    expect(sql).toContain("SET LOCAL lock_timeout = '5s'")
  })

  it('keeps unknown as the historical default without hostname-based inference', () => {
    expect(sql).toContain("ADD COLUMN source text NOT NULL DEFAULT 'unknown'")
    expect(sql).toContain("CHECK (source IN ('unknown', 'user', 'harness'))")
    expect(sql).toContain('ADD COLUMN requirement_id uuid')
    expect(sql).not.toMatch(/UPDATE\s+public\.allowed_domains|INSERT\s+INTO\s+public\.allowed_domains/i)
    expect(sql).not.toMatch(/(?:LIKE|ILIKE|~)\s*'.*(?:vercel|preview)/i)
  })

  it('enforces same-site provenance in both directions and retains domains on requirement deletion', () => {
    expect(sql).toContain('ON public.requirements (id, site_id)')
    expect(sql).toContain('FOREIGN KEY (requirement_id, site_id) REFERENCES public.requirements (id, site_id)')
    expect(sql).toContain('ON UPDATE NO ACTION ON DELETE SET NULL (requirement_id)')
    expect(sql).toContain('WHERE requirement_id IS NOT NULL')
  })

  it('guards browser writes using only established role APIs without changing domain RLS or grants', () => {
    expect(sql).toContain('claim_role text := auth.role()')
    expect(sql).toContain("database_role text := current_setting('role', true)")
    expect(sql).not.toMatch(/auth\.(?!role\()[a-z_]+\(/i)
    expect(sql).toContain("NOT IN ('anon', 'authenticated')")
    expect(sql).toContain('SECURITY DEFINER\nSET search_path = public, pg_temp')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.guard_allowed_domain_provenance() FROM PUBLIC, anon, authenticated')
    expect(sql).toContain('BEFORE INSERT OR UPDATE ON public.allowed_domains')
    expect(sql).toContain('IF NEW.source IS DISTINCT FROM OLD.source')
    expect(sql).not.toMatch(/(?:DROP|ALTER|CREATE) POLICY|(?:GRANT|REVOKE).*ON (?:TABLE )?public\.allowed_domains/i)
  })
})
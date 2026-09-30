/** @jest-environment node */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const folder = path.join(process.cwd(), 'supabase/migrations')
const names = readdirSync(folder).filter(name => /^2026092922\d{4}_accounting_.*\.sql$/.test(name)).sort()
const migrations = names.map(name => readFileSync(path.join(folder, name), 'utf8'))
const sql = migrations.join('\n')

describe('accounting migration security contracts', () => {
  it('ships forward-only responsibility splits without a historical ledger backfill', () => {
    expect(names.length).toBeGreaterThanOrEqual(4)
    for (const migration of migrations) {
      expect(migration.split('\n').length).toBeLessThan(500)
      expect(migration).toMatch(/BEGIN;/)
      expect(migration.trim()).toMatch(/COMMIT;$/)
    }
    expect(sql).toContain('Historical journals require review')
    expect(sql).toContain('NOT VALID')
    expect(sql.replace(/--[^\n]*/g, '')).not.toMatch(/\bTRUNCATE\b|DISABLE TRIGGER|VALIDATE CONSTRAINT/i)
  })

  it('sets a safe search path and revokes every privileged function default grant', () => {
    const functions = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map(match => match[1])
    expect(functions.length).toBeGreaterThanOrEqual(8)
    expect(sql.match(/SECURITY (?:DEFINER|INVOKER) SET search_path = public, pg_temp/g)).toHaveLength(functions.length)
    expect(sql).toContain('STABLE SECURITY INVOKER')
    for (const name of functions) expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${name}(`)
    expect(sql).not.toMatch(/current_user\s*(=|<>|!=)\s*'service_role'/)
  })

  it('limits generated posting and refund receipt RPCs exclusively to the service role', () => {
    for (const name of ['accounting_replace_source_journals', 'accounting_record_sale_refund']) {
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^;]+\\)\\s+TO service_role;`))
      expect(sql).not.toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^;]+TO authenticated`))
    }
    expect(sql).toContain("auth.role() IS DISTINCT FROM 'service_role'")
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.accounting_(save_journal_internal|validate_journal_lines)/)
  })

  it('removes legacy ALL policies, table and column DML privileges', () => {
    expect(sql).toContain('DROP POLICY %I ON public.%I')
    expect(sql).toContain('REVOKE ALL PRIVILEGES (%s)')
    expect(sql).toContain('REVOKE ALL ON public.journal_entries, public.journal_lines FROM PUBLIC, anon, authenticated, service_role')
    for (const operation of ['select', 'insert', 'update', 'delete']) {
      expect(sql).toContain(`CREATE POLICY accounting_accounts_${operation}`)
      expect(sql).toContain(`public.user_can(site_id, '${operation}')`)
    }
  })

  it('serializes source and journal writes with row locks and optimistic checks', () => {
    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain('source_version IS DISTINCT FROM p_source_updated_at')
    expect(sql).toContain('existing.source_hash IS DISTINCT FROM p_expected_hash')
    expect(sql).toContain("ERRCODE = '40001'")
    expect(sql).toContain('EXCEPT ALL')
    expect(sql).toContain('kept_ids')
  })

  it('checks raw money, dimensions, immutable identity and receipt caps', () => {
    expect(sql).toContain('debit_total <> credit_total')
    expect(sql).toContain('trunc(debit_amount, 2)')
    expect(sql).toContain('jsonb_array_length(p_lines) NOT BETWEEN 2 AND 500')
    expect(sql).toContain('Manual and opening journals do not accept dimensions')
    expect(sql).toContain('Company dimension must match the accounting source')
    expect(sql).not.toContain('companies.site_id')
    expect(sql).toContain('Journal identity is immutable')
    expect(sql).toContain('Cumulative refunds exceed recorded receipts')
    expect(sql).toContain('GROUP BY site_id, key HAVING count(*) > 1')
  })
})
/** @jest-environment node */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const api = path.resolve(process.env.BILLING_TEST_API_WORKSPACE || path.join(root, '../API'))
const available = existsSync(path.join(api, 'node_modules/@electric-sql/pglite')) &&
  existsSync(path.join(api, 'supabase/migrations/20261009070000_preserve_paid_addon_credit_windows.sql'))
const migration = readFileSync(path.join(root, 'supabase/migrations/20261009080000_free_plan_paid_addons.sql'), 'utf8')
it('keeps the forward migration service-only, guarded, and below the file limit', () => {
  expect(migration.split('\n').length).toBeLessThan(500)
  expect(migration).toContain('pg_advisory_xact_lock')
  expect(migration).toContain('FOR UPDATE')
  expect(migration).toContain('current_service_mismatch')
  expect(migration).toContain('verified_credit_coverage')
  expect(migration).toContain('previous paid window/usage')
  expect(migration).toContain('stored excess')
  expect(migration).not.toContain('v_addons * 5')
  expect(migration).not.toContain('UPDATE public.billing SET credits_available = coalesce(credits_available, 0) +')
  expect(migration).toContain('FROM PUBLIC, anon, authenticated')
  expect(migration).toContain('SET search_path = public, pg_temp')
})
;(available ? describe : describe.skip)('Free add-ons actual producer + disposable PostgreSQL', () => {
  it('preserves usage/protected credits, settles once, verifies renewal, cancellation and replacement chronology', () => {
    const output = execFileSync(process.execPath, [path.join(__dirname, 'stripe-free-addons-sql-runner.cjs'), api], {
      encoding: 'utf8', timeout: 30000,
      env: { PATH: process.env.PATH, NODE_ENV: 'test', LC_ALL: 'C', LANG: 'C' },
    })
    expect(output).toContain('PASS Free monthly and annual producer + SQL settlement')
    expect(output).toContain('PASS Free cancellation, replacement and renewal chronology')
    expect(output).toContain('PASS Free SQL tenant, privilege, proof and atomic failure fences')
  }, 35000)
})
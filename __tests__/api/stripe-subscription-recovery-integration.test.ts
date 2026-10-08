/** @jest-environment node */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

// API owns the canonical annual SQL. Explicit path may select its local checkout;
// no configured database URL or credentials are ever used by this runner.
const api = path.resolve(process.env.BILLING_TEST_API_WORKSPACE || path.join(process.cwd(), '../API'))
const available = existsSync(path.join(api, 'node_modules/@electric-sql/pglite')) &&
  existsSync(path.join(api, 'supabase/migrations/20261007180000_annual_subscription_credit_periods.sql'))
const suite = available ? describe : describe.skip

suite('actual Stripe producer + annual SQL recovery contract', () => {
  it('blocks obsolete tier/interval/addons update recovery, preserves immutable proof, then recovers matching service once', () => {
    const output = execFileSync(process.execPath, [
      path.join(__dirname, 'stripe-subscription-recovery-integration-runner.cjs'), api,
    ], { encoding: 'utf8', timeout: 30000,
      env: { PATH: process.env.PATH, NODE_ENV: 'test', LC_ALL: 'C', LANG: 'C' } })
    expect(output).toContain('PASS 3 integrated recovery cases')
    expect(output).toContain('current tier fence')
    expect(output).toContain('current interval fence')
    expect(output).toContain('current addons fence')
  }, 35000)
})
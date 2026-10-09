/** @jest-environment node */
import { execFileSync } from 'node:child_process'
import path from 'node:path'

// API owns the shared credit fixtures and annual SQL. This executes PostgreSQL
// locally in WASM and cannot use any configured database URL or remote secret.
const api = path.resolve(process.env.BILLING_TEST_API_WORKSPACE || path.join(process.cwd(), '../API'))

describe('automatic top-up forward migration in real PostgreSQL', () => {
  it('enforces single dispatch, current consent, cross-month caps and atomic verified settlement', () => {
    const output = execFileSync(process.execPath, [
      path.join(__dirname, 'auto-top-up-postgres-runner.mjs'), api,
    ], { encoding: 'utf8', timeout: 60000,
      env: { PATH: process.env.PATH, NODE_ENV: 'test', LC_ALL: 'C', LANG: 'C' } })
    expect(output).toContain('PASS 17 real PostgreSQL auto-top-up safety cases (offline PGlite)')
    expect(output).toContain('competing admission and dispatch calls authorize exactly once')
    expect(output).toContain('previous-month pending stays reserved and current settlement consumes current cap')
    expect(output).toContain('configuration and actor consent are atomic')
  }, 65000)
})
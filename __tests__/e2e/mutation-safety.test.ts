/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { fixtureConnection, invitationDomain, requireMutationEnvironment } from '../../tests/support/mutation-safety'

const root = process.cwd()
const env: NodeJS.ProcessEnv = {
  TEST_TARGET: 'local', TEST_SUITE: 'regression', TEST_BASE_URL: 'http://localhost:3000',
  TEST_COMMERCE_BASE_URL: 'http://localhost:3000', TEST_SITE_NAME: 'Disposable workspace',
  TEST_SITE_ID: '11111111-1111-4111-8111-111111111111', TEST_ALLOW_MUTATIONS: '1',
  TEST_DISPOSABLE_ENVIRONMENT: '1', TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
  TEST_SUPABASE_ANON_KEY: `header.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.signature`,
  TEST_ADMIN_EMAIL: 'admin@example.test', TEST_ADMIN_PASSWORD: 'unit-test-placeholder',
}

describe('mutation environment boundaries', () => {
  it('accepts only an explicit disposable site and target', () => {
    expect(requireMutationEnvironment(env).siteName).toBe('Disposable workspace')
  })
  it.each(['TEST_SITE_NAME', 'TEST_SITE_ID', 'TEST_TARGET', 'TEST_BASE_URL', 'TEST_COMMERCE_BASE_URL', 'TEST_ALLOW_MUTATIONS', 'TEST_DISPOSABLE_ENVIRONMENT'])(
    'rejects a missing %s before any I/O', key => {
      expect(() => requireMutationEnvironment({ ...env, [key]: undefined })).toThrow()
    },
  )
  it.each(['smoke', 'buyer', 'regression', 'roles'])('forbids production even through %s suite selection', suite => {
    expect(() => requireMutationEnvironment({ ...env, TEST_TARGET: 'production', TEST_SUITE: suite,
      TEST_BASE_URL: 'https://app.makinari.com', TEST_COMMERCE_BASE_URL: 'https://www.makinari.com' })).toThrow(/production/i)
  })
  it('rejects mislabeled production URLs and demo site IDs', () => {
    expect(() => requireMutationEnvironment({ ...env, TEST_TARGET: 'staging', TEST_BASE_URL: 'https://app.makinari.com' })).toThrow()
    expect(() => requireMutationEnvironment({ ...env, TEST_SITE_ID: 'demo-one' })).toThrow()
  })
  it('requires dedicated fixture endpoint and anon credentials, never ambient secrets', () => {
    expect(fixtureConnection(env).url).toBe('http://127.0.0.1:54321')
    expect(() => fixtureConnection({ ...env, TEST_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_URL: env.TEST_SUPABASE_URL })).toThrow()
    const privileged = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`
    expect(() => fixtureConnection({ ...env, TEST_SUPABASE_ANON_KEY: privileged })).toThrow(/public anon/)
    expect(() => fixtureConnection({ ...env, TEST_SUPABASE_URL: 'https://unselected.supabase.co' })).toThrow(/loopback/)
  })
  it.each(['example.com', 'gmail.com', 'makinari.com', 'sub.makinari.com', 'a.test.evil.com', 'https://mail.test', 'a@b.test'])(
    'rejects a routable or malformed invitation sink %s', domain => {
      expect(() => invitationDomain({ ...env, TEST_INVITE_EMAIL_DOMAIN: domain })).toThrow()
    },
  )
  it('accepts explicitly configured non-routable captured-mail domains only', () => {
    expect(invitationDomain({ ...env, TEST_INVITE_EMAIL_DOMAIN: 'mail.e2e.test' })).toBe('mail.e2e.test')
    expect(invitationDomain({ ...env, TEST_INVITE_EMAIL_DOMAIN: 'mail.invalid' })).toBe('mail.invalid')
  })
})

const files = fs.readdirSync(path.join(root, 'tests')).filter(file =>
  (/^crud-.*\.test\.yaml$/.test(file) && !/^crud-(inventory-item|order|reservation|shipment)\./.test(file)) || file === 'read-edit-agent.test.yaml')

describe('owned mutation YAML governance', () => {
  it.each(files)('%s cannot mutate without explicit guards, shared workspace selection, and teardown', file => {
    const source = fs.readFileSync(path.join(root, 'tests', file), 'utf8')
    const journey = parse(source)
    expect(journey.statements[0].js).toContain('.requireMutationEnvironment()')
    expect(source).toContain("require(process.cwd() + '/tests/support/workspace').selectWorkspace(page)")
    expect(source).toContain('TEST_SITE_NAME')
    expect(source).toContain('TEST_SITE_ID')
    expect(journey.teardown.length).toBeGreaterThan(0)
    expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE|waitForTimeout|Select the first|WAIT_UNTIL:|VERIFY:|sessionStorage/)
    expect(journey.statements.some((step: { locator?: string }) => step.locator?.includes('{{'))).toBe(false)
    expect(journey.skip).toBeUndefined()
    expect(journey.fail).toBeUndefined()
    expect(source).toContain('.assertReadObservation(page)')
  })
  it('fails closed for two unavailable fixtures rather than silently skipping', () => {
    for (const file of ['crud-robot.test.yaml', 'crud-settings-social.test.yaml']) {
      const source = fs.readFileSync(path.join(root, 'tests', file), 'utf8')
      expect(source).toContain('throw new Error(')
      expect(source).not.toContain('action: click')
    }
  })
  it('does not claim update coverage in create/read/delete-only flows', () => {
    for (const kind of ['transaction', 'bill', 'quotation', 'modifier-group', 'settings-calendar', 'settings-secrets', 'settings-team']) {
      const journey = parse(fs.readFileSync(path.join(root, 'tests', `crud-${kind}.test.yaml`), 'utf8'))
      expect(journey.goal).not.toMatch(/CRUD|update/i)
    }
  })
  it('seed compatibility entry point is read-only and imports no ambient dotenv or service key', () => {
    const source = fs.readFileSync(path.join(root, 'scripts/seed-e2e-data.ts'), 'utf8')
    expect(source).not.toMatch(/\.delete\(|\.insert\(|\.upsert\(|\.update\(|\.limit\(1\)|dotenv|SERVICE_ROLE/)
    expect(source).toContain(".eq('site_id', siteId).eq('id', id)")
    expect(source).toContain('is_reservation')
    expect(source).not.toContain('is_reservable')
  })
})
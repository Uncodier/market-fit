/** @jest-environment node */
import { createClient } from '@supabase/supabase-js'
import { assertPersisted, assertRemoved, beginRecordCreation, bindBrowserFixture, cleanup, fixtureClient, own, remember } from '../../tests/support/mutation-fixtures'

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))
const siteId = '11111111-1111-4111-8111-111111111111'
const otherSite = '22222222-2222-4222-8222-222222222222'
const entityId = '33333333-3333-4333-8333-333333333333'
const name = 'Shiplight Expense 1790000000000-abcdefgh'
type Row = Record<string, any>
type Query = { table: string; operation: string; filters: [string, any][]; values?: Row }
let rows: Record<string, Row[]>
let queries: Query[]
let failure: string | undefined
let authError: boolean
const environment = {
  TEST_TARGET: 'local', TEST_SUITE: 'regression', TEST_BASE_URL: 'http://localhost:3000',
  TEST_COMMERCE_BASE_URL: 'http://localhost:3000', TEST_SITE_ID: siteId, TEST_SITE_NAME: 'Disposable',
  TEST_ALLOW_MUTATIONS: '1', TEST_DISPOSABLE_ENVIRONMENT: '1', TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
  TEST_SUPABASE_ANON_KEY: 'sb_publishable_test', TEST_ADMIN_EMAIL: 'admin@example.test', TEST_ADMIN_PASSWORD: 'test-only',
}
const originalEnv = process.env
const user = { id: 'unit-user', email: environment.TEST_ADMIN_EMAIL }

function context() {
  const values = new Map<string, any>()
  return { get: (key: string) => values.get(key), set: (key: string, value: any) => values.set(key, value) }
}

function query(table: string) {
  const state: Query = { table, operation: 'select', filters: [] }
  const execute = () => {
    queries.push({ ...state, filters: [...state.filters] })
    if (failure === `${table}:${state.operation}`) return { error: new Error('Denied'), data: null }
    const matches = (rows[table] || []).filter(row => state.filters.every(([key, value]) =>
      Array.isArray(value) ? value.includes(row[key]) : row[key] === value))
    if (state.operation === 'delete') rows[table] = rows[table].filter(row => !matches.includes(row))
    if (state.operation === 'update') matches.forEach(row => Object.assign(row, state.values))
    return { data: matches, error: null }
  }
  const builder: any = {
    select: () => builder,
    eq: (key: string, value: any) => { state.filters.push([key, value]); return builder },
    in: (key: string, value: any) => { state.filters.push([key, value]); return builder },
    delete: () => { state.operation = 'delete'; return builder },
    update: (values: Row) => { state.operation = 'update'; state.values = values; return builder },
    single: async () => { const result = execute(); return { ...result, data: result.data?.length === 1 ? result.data[0] : null } },
    then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject),
  }
  return builder
}

beforeEach(() => {
  process.env = { ...originalEnv, ...environment }
  rows = { sites: [{ id: siteId, name: 'Disposable', user_id: user.id }], transactions: [
    { id: entityId, site_id: siteId, description: name },
    { id: '44444444-4444-4444-8444-444444444444', site_id: otherSite, description: name },
    { id: '55555555-5555-4555-8555-555555555555', site_id: siteId, description: 'Existing customer record' },
  ] }
  queries = []; failure = undefined; authError = false
  ;(createClient as jest.Mock).mockReturnValue({ from: query, auth: {
    signInWithPassword: async () => ({ data: { user: authError ? null : user }, error: authError }),
    getUser: async () => ({ data: { user }, error: null }),
  } })
})
afterAll(() => { process.env = originalEnv })

it('authenticates the exact test account and rejects inaccessible/mismatched sites', async () => {
  await expect(fixtureClient()).resolves.toMatchObject({ siteId })
  rows.sites[0].name = 'Different site'
  await expect(fixtureClient()).rejects.toThrow(/name does not match/)
  rows.sites[0].name = 'Disposable'; rows.sites[0].user_id = 'other-user'
  rows.site_members = [{ site_id: siteId, user_id: user.id, role: 'marketing' }]
  await expect(fixtureClient()).rejects.toThrow(/owner\/admin/)
  authError = true
  await expect(fixtureClient()).rejects.toThrow(/authentication failed/)
})

it('registers only exact run-specific names and never a generic or wildcard cleanup target', () => {
  for (const value of ['', '%Automated Test Expense%', 'Existing customer record']) {
    expect(() => own(context(), 'transaction', [value])).toThrow(/run-specific/)
  }
})

it('cleanup is scoped to site + saved ID + exact run marker and leaves every other record intact', async () => {
  const ctx = context(); own(ctx, 'transaction', [name])
  await remember(ctx, 'transaction')
  await cleanup(ctx)
  expect(rows.transactions).toHaveLength(2)
  expect(rows.transactions.some(row => row.site_id === otherSite)).toBe(true)
  const deletion = queries.find(item => item.operation === 'delete')!
  expect(deletion.filters).toEqual(expect.arrayContaining([
    ['site_id', siteId], ['id', entityId], ['description', [name]],
  ]))
})

it('cleans a partial create by its exact name but fails if ownership is ambiguous', async () => {
  const ctx = context(); own(ctx, 'transaction', [name])
  rows.transactions.push({ id: '66666666-6666-4666-8666-666666666666', site_id: siteId, description: name })
  await expect(cleanup(ctx)).rejects.toThrow(/Ambiguous/)
  expect(queries.some(item => item.operation === 'delete')).toBe(false)
  rows.transactions.pop()
  await cleanup(ctx)
  expect(rows.transactions.some(row => row.id === entityId)).toBe(false)
})

it('asserts persistence and removal before cleanup; a successful cleanup cannot hide a failed UI deletion', async () => {
  const ctx = context(); own(ctx, 'transaction', [name, `${name} Edited`])
  await remember(ctx, 'transaction')
  await expect(assertPersisted(ctx, 'transaction', `${name} Edited`)).rejects.toThrow(/did not persist/)
  await expect(assertRemoved(ctx, 'transaction')).rejects.toThrow(/did not persist/)
  await cleanup(ctx)
  await expect(assertRemoved(ctx, 'transaction')).resolves.toBeUndefined()
})

it('does not swallow database denial or query failure as absence', async () => {
  const ctx = context(); own(ctx, 'transaction', [name])
  failure = 'transactions:select'
  await expect(cleanup(ctx)).rejects.toThrow(/Unable to resolve/)
  failure = 'transactions:delete'
  await expect(cleanup(ctx)).rejects.toThrow(/Cleanup failed/)
})

it('archives catalog fixtures instead of physically deleting them', async () => {
  const ctx = context(); own(ctx, 'catalog', [name])
  rows.catalog_items = [{ id: entityId, site_id: siteId, name, status: 'active' }]
  await cleanup(ctx)
  expect(rows.catalog_items[0].status).toBe('archived')
  expect(queries.some(item => item.operation === 'delete')).toBe(false)
})

it('reports uncertain automatic record creation instead of deleting a generic title or claiming cleanup', async () => {
  const ctx = context(); own(ctx, 'record', [name]); beginRecordCreation(ctx)
  rows.records = []
  await expect(cleanup(ctx)).rejects.toThrow(/E2E_BLOCKED/)
  expect(queries.some(item => item.operation === 'delete')).toBe(false)
})

it('binds UI session issuer and verified user to the exact fixture backend', async () => {
  const token = (issuer: string) => `header.${Buffer.from(JSON.stringify({ iss: issuer })).toString('base64url')}.signature`
  let issuer = 'http://127.0.0.1:54321/auth/v1'
  const page: any = { context: () => ({ cookies: async () => [{ name: 'sb-127-auth-token',
    value: JSON.stringify({ access_token: token(issuer) }) }] }) }
  await expect(bindBrowserFixture(page)).resolves.toBeUndefined()
  issuer = 'https://other.supabase.co/auth/v1'
  await expect(bindBrowserFixture(page)).rejects.toThrow(/bind UI auth/)
})
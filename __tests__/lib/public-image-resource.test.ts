/** @jest-environment node */

import { getShopSite } from '@/app/shop/[siteSlug]/actions'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePublicImageResource } from '@/lib/images/public-image-resource'
import type { PromptImageInput } from '@/lib/images/prompt-image-contract'

jest.mock('server-only', () => ({}))
jest.mock('@/app/shop/[siteSlug]/actions', () => ({ getShopSite: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createServiceClient: jest.fn() }))

const siteId = '00000000-0000-4000-8000-000000000001'
const otherSite = '00000000-0000-4000-8000-000000000002'
const itemId = '00000000-0000-4000-8000-000000000003'
const parentId = '00000000-0000-4000-8000-000000000004'
const groupId = '00000000-0000-4000-8000-000000000005'
const site = { id: siteId, name: 'Public shop', logo_url: null, description: 'Local artisan goods',
  settings: { business_hours: [{ timezone: 'UTC' }], shop: { hero_title: 'Handmade favorites', hero_subtitle: 'Made with care' } } }
const input: PromptImageInput = { prompt: 'CLIENT PROMPT MUST NOT BE USED', site_id: siteId,
  width: 128, height: 600, public: '1', resource_type: 'catalog', resource_id: itemId }
const item = { id: itemId, site_id: siteId, status: 'active', name: 'Blue mug', description: 'Hand glazed',
  category: { name: 'Ceramics' }, is_marketplace_listed: true, availability_mode: 'manual', availability_status: 'available' }
const parent = { ...item, id: parentId, name: 'Mug collection', description: 'Stoneware', category: { name: 'Tableware' } }
const promotion = { id: itemId, site_id: siteId, status: 'active', name: '  Spring offer  ', channels: ['shop'],
  show_on_shop: true, show_on_marketplace: false }
type Row = Record<string, unknown>
type QueryLog = { table: string; fields?: string; filters: [string, unknown][] }
let rows: Record<string, Row[]>
let queries: QueryLog[]
let errors: (null | { message: string })[]
const writes = { insert: jest.fn(), update: jest.fn(), upsert: jest.fn(), delete: jest.fn(), rpc: jest.fn() }
type Query = typeof writes & PromiseLike<{ data: Row[]; error: { message: string } | null }> & {
  select: (fields: string) => Query
  eq: (field: string, value: unknown) => Query
  maybeSingle: () => Promise<{ data: Row | null; error: { message: string } | null }>
}
const from = jest.fn((table: string) => {
  const log: QueryLog = { table, filters: [] }
  queries.push(log)
  const matchingRows = () => rows[table]?.filter(row => log.filters.every(([field, value]) => row[field] === value)) || []
  const query: Query = {
    select: jest.fn((fields: string): Query => { log.fields = fields; return query }),
    eq: jest.fn((field: string, value: unknown): Query => { log.filters.push([field, value]); return query }),
    maybeSingle: jest.fn(async () => ({
      data: matchingRows()[0] || null,
      error: errors.shift() || null,
    })),
    then: (onFulfilled, onRejected) => Promise.resolve({ data: matchingRows(), error: errors.shift() || null }).then(onFulfilled, onRejected),
    ...writes,
  }
  return query
})

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers().setSystemTime(new Date('2026-01-04T00:30:00Z'))
  rows = { catalog_items: [{ ...item }], promotions: [{ ...promotion }] }
  queries = []
  errors = []
  jest.mocked(getShopSite).mockResolvedValue(site)
  jest.mocked(createServiceClient).mockResolvedValue({ from, ...writes } as never)
  jest.mocked(fetch).mockReset().mockRejectedValue(new Error('Unexpected network access'))
})
afterEach(() => {
  jest.useRealTimers()
  expect(fetch).not.toHaveBeenCalled()
  for (const write of Object.values(writes)) expect(write).not.toHaveBeenCalled()
})

it.each(['site_id', 'resource_id', 'resource_type'] as const)('rejects a missing %s before site or service access', async field => {
  expect(await resolvePublicImageResource({ ...input, [field]: undefined })).toBeNull()
  expect(getShopSite).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it.each([
  ['unknown, private or archived public-site lookup miss', null],
  ['a lookup resolving a different site', { ...site, id: otherSite }],
] as const)('denies %s without creating a resource service client', async (_label, result) => {
  // getShopSite owns the public/nonarchived site lookup; a miss is not authorization.
  jest.mocked(getShopSite).mockResolvedValueOnce(result)
  expect(await resolvePublicImageResource(input)).toBeNull()
  expect(getShopSite).toHaveBeenCalledWith(siteId)
  expect(createServiceClient).not.toHaveBeenCalled()
  expect(from).not.toHaveBeenCalled()
})

it('does not acquire the resource service client while public site authorization is pending', async () => {
  let authorize!: (value: typeof site) => void
  jest.mocked(getShopSite).mockReturnValueOnce(new Promise(resolve => { authorize = resolve }))
  const pending = resolvePublicImageResource(input)
  await Promise.resolve()
  expect(createServiceClient).not.toHaveBeenCalled()
  expect(from).not.toHaveBeenCalled()
  authorize(site)
  expect(await pending).toMatchObject({ site_id: siteId, width: 1024, height: 1024 })
  expect(createServiceClient).toHaveBeenCalledWith(true)
  expect(jest.mocked(getShopSite).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(createServiceClient).mock.invocationCallOrder[0])
})

it('uses only database-owned catalog context and one canonical source size', async () => {
  const result = await resolvePublicImageResource(input)
  expect(result).toEqual({ prompt: 'Blue mug. Hand glazed. category Ceramics. Local artisan goods',
    site_id: siteId, width: 1024, height: 1024 })
  expect(result?.prompt).not.toContain(input.prompt)
  expect(queries).toHaveLength(1)
  expect(queries[0]).toMatchObject({ table: 'catalog_items',
    filters: [['site_id', siteId], ['id', itemId], ['status', 'active']] })
  expect(queries[0].fields).toContain('category:catalog_categories(name)')
  expect(queries[0].fields).not.toContain('*')
  expect(await resolvePublicImageResource({ ...input, prompt: 'Another untrusted prompt', width: 1600, height: 1 }))
    .toEqual(result)
})

it.each([
  ['cross-site', { site_id: otherSite }], ['inactive', { status: 'draft' }],
  ['unlisted', { is_marketplace_listed: false }],
  ['manually unavailable', { availability_status: 'unavailable' }],
  ['manual status missing', { availability_status: null }],
])('rejects a %s catalog item', async (_label, changes) => {
  rows.catalog_items = [{ ...item, ...changes }]
  expect(await resolvePublicImageResource(input)).toBeNull()
  expect(queries[0].filters).toContainEqual(['site_id', siteId])
  expect(queries[0].filters).toContainEqual(['status', 'active'])
})

it.each(['always', 'inventory', null])('preserves storefront availability semantics for mode %s', async mode => {
  rows.catalog_items = [{ ...item, availability_mode: mode, availability_status: 'unavailable' }]
  expect(await resolvePublicImageResource(input)).toMatchObject({ site_id: siteId })
})

it('authorizes a variant through its active listed available parent and uses parent prompt context', async () => {
  rows.catalog_items = [{ ...item, parent_id: parentId, is_marketplace_listed: false, category: null }, parent]
  const result = await resolvePublicImageResource(input)
  expect(result).toEqual({ prompt: 'Blue mug. variant of Mug collection: Stoneware. Hand glazed. category Tableware. Local artisan goods',
    site_id: siteId, width: 1024, height: 1024 })
  expect(queries.map(query => query.filters)).toEqual([
    [['site_id', siteId], ['id', itemId], ['status', 'active']],
    [['site_id', siteId], ['id', parentId], ['status', 'active']],
  ])
})

it.each([
  ['missing', null], ['cross-site', { ...parent, site_id: otherSite }],
  ['inactive', { ...parent, status: 'archived' }], ['unlisted', { ...parent, is_marketplace_listed: false }],
  ['unavailable', { ...parent, availability_status: 'unavailable' }],
])('denies a child whose required public parent is %s', async (_label, publicParent) => {
  rows.catalog_items = [{ ...item, parent_id: parentId }, ...(publicParent ? [publicParent] : [])]
  expect(await resolvePublicImageResource(input)).toBeNull()
  expect(queries).toHaveLength(2)
})

it('does not allow an unavailable variant even when its parent is public', async () => {
  rows.catalog_items = [{ ...item, parent_id: parentId, availability_status: 'unavailable' }, parent]
  expect(await resolvePublicImageResource(input)).toBeNull()
  expect(queries).toHaveLength(1)
})

it.each(['catalog', 'promotion'] as const)('fails closed on a %s lookup error or missing resource', async resource_type => {
  errors = [{ message: 'private database detail' }]
  expect(await resolvePublicImageResource({ ...input, resource_type })).toBeNull()
  rows = {}
  expect(await resolvePublicImageResource({ ...input, resource_type })).toBeNull()
})

it('fails closed when the parent lookup reports an error', async () => {
  rows.catalog_items = [{ ...item, parent_id: parentId }, parent]
  errors = [null, { message: 'parent lookup failed' }]
  expect(await resolvePublicImageResource(input)).toBeNull()
})

function publicAddon() {
  rows.catalog_items = [{ ...item, is_marketplace_listed: false, category: null }, parent]
  rows.modifier_group_items = [{ site_id: siteId, catalog_item_id: itemId, modifier_group_id: groupId }]
  rows.catalog_item_modifier_groups = [{ site_id: siteId, catalog_item_id: parentId, modifier_group_id: groupId }]
  return { ...input, host_id: parentId }
}

it('allows a legitimately unlisted add-on only through tenant-scoped membership attached to its public host', async () => {
  const addon = publicAddon()
  expect(await resolvePublicImageResource(addon)).toEqual({
    prompt: 'Blue mug. add-on for Mug collection: Stoneware. Hand glazed. category Tableware. Local artisan goods',
    site_id: siteId, width: 1024, height: 1024,
  })
  expect(queries.map(query => ({ table: query.table, filters: query.filters }))).toEqual([
    { table: 'catalog_items', filters: [['site_id', siteId], ['id', itemId], ['status', 'active']] },
    { table: 'catalog_items', filters: [['site_id', siteId], ['id', parentId], ['status', 'active']] },
    { table: 'modifier_group_items', filters: [['site_id', siteId], ['catalog_item_id', itemId]] },
    { table: 'catalog_item_modifier_groups', filters: [['site_id', siteId], ['catalog_item_id', parentId]] },
  ])
  expect(queries.slice(2).map(query => query.fields)).toEqual(['modifier_group_id', 'modifier_group_id'])
  expect(createServiceClient).toHaveBeenCalledWith(true)
  expect(jest.mocked(getShopSite).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(createServiceClient).mock.invocationCallOrder[0])
})

it.each([
  ['missing', null], ['foreign', { ...parent, site_id: otherSite }],
  ['inactive', { ...parent, status: 'draft' }], ['unlisted', { ...parent, is_marketplace_listed: false }],
  ['unavailable', { ...parent, availability_status: 'unavailable' }],
  ['manual status absent', { ...parent, availability_status: null }],
])('denies an unlisted add-on when its claimed host is %s', async (_label, host) => {
  const addon = publicAddon()
  rows.catalog_items = [{ ...item, is_marketplace_listed: false }, ...(host ? [host] : [])]
  expect(await resolvePublicImageResource(addon)).toBeNull()
  expect(queries[1].filters).toEqual([['site_id', siteId], ['id', parentId], ['status', 'active']])
})

it.each([
  ['missing option membership', 'modifier_group_items', []],
  ['foreign option membership', 'modifier_group_items', [{ site_id: otherSite, catalog_item_id: itemId, modifier_group_id: groupId }]],
  ['different option membership', 'modifier_group_items', [{ site_id: siteId, catalog_item_id: parentId, modifier_group_id: groupId }]],
  ['missing host link', 'catalog_item_modifier_groups', []],
  ['foreign host link', 'catalog_item_modifier_groups', [{ site_id: otherSite, catalog_item_id: parentId, modifier_group_id: groupId }]],
  ['different host link', 'catalog_item_modifier_groups', [{ site_id: siteId, catalog_item_id: itemId, modifier_group_id: groupId }]],
  ['nonintersecting group link', 'catalog_item_modifier_groups', [{ site_id: siteId, catalog_item_id: parentId, modifier_group_id: 'unrelated-group' }]],
] as const)('denies an add-on with %s rather than trusting host_id', async (_label, table, relationRows) => {
  const addon = publicAddon()
  rows[table] = [...relationRows]
  expect(await resolvePublicImageResource(addon)).toBeNull()
})

it('requires a real same-tenant group intersection even when both membership lists are nonempty', async () => {
  const addon = publicAddon()
  rows.modifier_group_items.push({ site_id: otherSite, catalog_item_id: itemId, modifier_group_id: 'foreign-shared-group' })
  rows.catalog_item_modifier_groups = [
    { site_id: siteId, catalog_item_id: parentId, modifier_group_id: 'unrelated-local-group' },
    { site_id: otherSite, catalog_item_id: parentId, modifier_group_id: groupId },
    { site_id: siteId, catalog_item_id: parentId, modifier_group_id: 'foreign-shared-group' },
  ]
  expect(await resolvePublicImageResource(addon)).toBeNull()
})

it('accepts an intersecting authorized group when irrelevant groups are also present', async () => {
  const addon = publicAddon()
  rows.modifier_group_items.unshift({ site_id: siteId, catalog_item_id: itemId, modifier_group_id: 'unused-group' })
  rows.catalog_item_modifier_groups.unshift({ site_id: siteId, catalog_item_id: parentId, modifier_group_id: 'different-group' })
  expect(await resolvePublicImageResource(addon)).toMatchObject({ prompt: expect.stringContaining('add-on for Mug collection') })
})

it.each([2, 3, 4])('fails closed on add-on authorization query %i errors without writes', async queryNumber => {
  const addon = publicAddon()
  errors = [...Array<null>(queryNumber - 1).fill(null), { message: 'private modifier lookup detail' }]
  expect(await resolvePublicImageResource(addon)).toBeNull()
  expect(queries).toHaveLength(queryNumber)
})

it.each([
  { site_id: otherSite }, { status: 'inactive' }, { availability_status: 'unavailable' },
])('denies an inactive, foreign or unavailable option even with valid public host relations: %j', async changes => {
  const addon = publicAddon()
  rows.catalog_items = [{ ...item, ...changes, is_marketplace_listed: false }, parent]
  expect(await resolvePublicImageResource(addon)).toBeNull()
  expect(queries).toHaveLength(1)
})

it('does not make an unlisted option public merely because some host has attached its group', async () => {
  publicAddon()
  expect(await resolvePublicImageResource(input)).toBeNull()
  expect(queries).toHaveLength(1)
})

it.each(['shop', 'marketplace'] as const)('allows an eligible %s promotion and derives its database name', async surface => {
  rows.promotions = [{ ...promotion, channels: [surface], show_on_shop: surface === 'shop', show_on_marketplace: surface === 'marketplace' }]
  expect(await resolvePublicImageResource({ ...input, resource_type: 'promotion' }))
    .toEqual({ prompt: 'Spring offer', site_id: siteId, width: 1024, height: 1024 })
  expect(queries[0]).toMatchObject({ table: 'promotions', filters: [['site_id', siteId], ['id', itemId]] })
  expect(queries[0].fields).toContain('active_weekdays')
  expect(queries[0].fields).toContain('usage_count')
})

it.each([
  ['cross-site', { site_id: otherSite }], ['inactive', { status: 'inactive' }],
  ['not displayed', { show_on_shop: false }], ['POS-only', { channels: ['pos'] }],
  ['not started', { starts_at: '2026-01-05T00:00:00Z' }], ['expired', { ends_at: '2026-01-03T00:00:00Z' }],
  ['wrong weekday', { active_weekdays: [1] }], ['exhausted', { usage_limit: 5, usage_count: 5 }],
])('rejects a %s promotion', async (_label, changes) => {
  rows.promotions = [{ ...promotion, ...changes }]
  expect(await resolvePublicImageResource({ ...input, resource_type: 'promotion' })).toBeNull()
})

it('uses business-hours timezone for promotion weekdays and ignores conflicting general settings', async () => {
  jest.mocked(getShopSite).mockResolvedValueOnce({ ...site, settings: {
    business_hours: [{ timezone: 'America/Los_Angeles' }], general: { timezone: 'UTC' },
  } })
  rows.promotions = [{ ...promotion, active_weekdays: [6] }]
  expect(await resolvePublicImageResource({ ...input, resource_type: 'promotion' })).not.toBeNull()
  // The same instant is Sunday in UTC, but still Saturday for the authorized shop.
  expect(await resolvePublicImageResource({ ...input, resource_type: 'promotion' })).toBeNull()
})

it('defaults promotion weekdays to UTC rather than a legacy general timezone when business hours are absent', async () => {
  jest.mocked(getShopSite).mockResolvedValueOnce({ ...site, settings: { general: { timezone: 'America/Los_Angeles' } } })
  rows.promotions = [{ ...promotion, active_weekdays: [6] }]
  expect(await resolvePublicImageResource({ ...input, resource_type: 'promotion' })).toBeNull()
})

it('uses a deterministic database-only fallback for an unnamed eligible promotion', async () => {
  rows.promotions = [{ ...promotion, name: '   ' }]
  expect(await resolvePublicImageResource({ ...input, resource_type: 'promotion' }))
    .toMatchObject({ prompt: 'Promotion' })
})

it('resolves the authorized site hero without a resource service lookup', async () => {
  expect(await resolvePublicImageResource({ ...input, resource_type: 'hero', resource_id: siteId }))
    .toEqual({ prompt: 'Handmade favorites. Made with care. Local artisan goods', site_id: siteId, width: 1024, height: 1024 })
  expect(createServiceClient).not.toHaveBeenCalled()
  expect(from).not.toHaveBeenCalled()
})

it.each([
  ['another site hero', otherSite, site.settings],
  ['missing hero title', siteId, { shop: { hero_subtitle: 'Only a subtitle' } }],
  ['existing hero image', siteId, { shop: { hero_title: 'Title', hero_image_url: 'https://cdn.example.test/hero.png' } }],
  ['missing settings', siteId, undefined],
])('denies %s without service access', async (_label, resource_id, settings) => {
  jest.mocked(getShopSite).mockResolvedValueOnce({ ...site, settings })
  expect(await resolvePublicImageResource({ ...input, resource_type: 'hero', resource_id })).toBeNull()
  expect(createServiceClient).not.toHaveBeenCalled()
})
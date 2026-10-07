import { createSiteSetupStore, siteSetupStorageKey } from '@/app/create-site/site-setup-store'
import { startSiteSetup, checkSiteSetup } from '@/app/create-site/start-site-setup'

jest.mock('@/app/create-site/start-site-setup', () => ({ startSiteSetup: jest.fn(), checkSiteSetup: jest.fn() }))
const userId = '00000000-0000-4000-8000-000000000001'
const otherUserId = '00000000-0000-4000-8000-000000000002'
const siteId = '11111111-1111-4111-8111-111111111111'
const otherSiteId = '22222222-2222-4222-8222-222222222222'
const workflowId = `site-setup-${siteId}-1791331200000`
const key = siteSetupStorageKey(userId, siteId)!
const validRecord = { version: 1, userId, siteId, status: 'pending', workflowId }

beforeEach(() => {
  sessionStorage.clear()
  jest.resetAllMocks()
  jest.mocked(startSiteSetup).mockResolvedValue({ status: 'pending', workflowId, message: 'private@example.invalid' })
})

it('persists only safe codes and IDs, not arbitrary response messages; snapshots remain stable', async () => {
  const store = createSiteSetupStore()
  await store.launch(userId, siteId)
  const raw = sessionStorage.getItem(key)!
  expect(JSON.parse(raw)).toEqual(validRecord)
  expect(raw).not.toContain('private@example.invalid')
  expect(store.getSnapshot(userId, siteId)).toBe(store.getSnapshot(userId, siteId))
  expect(createSiteSetupStore().getSnapshot(userId, siteId)?.message).toContain('completion is not yet confirmed')
})

it.each([
  '{bad-json',
  JSON.stringify({ ...validRecord, version: 2 }),
  JSON.stringify({ ...validRecord, userId: otherUserId }),
  JSON.stringify({ ...validRecord, siteId: otherSiteId }),
  JSON.stringify({ ...validRecord, workflowId: `site-setup-${otherSiteId}-1` }),
  JSON.stringify({ ...validRecord, workflowId: 'site-setup--------------------------------------1' }),
  JSON.stringify({ ...validRecord, status: 'accepted' }),
  JSON.stringify({ ...validRecord, detail: 'private@example.invalid' }),
  JSON.stringify({ ...validRecord, message: 'private@example.invalid' }),
  'x'.repeat(1025),
])('rejects corrupt, unrecognized, cross-user/site, or non-allowlisted records (%#)', raw => {
  sessionStorage.setItem(key, raw)
  const store = createSiteSetupStore()
  expect(store.getSnapshot(userId, siteId)).toBeNull()
  expect(startSiteSetup).not.toHaveBeenCalled()
  expect(checkSiteSetup).not.toHaveBeenCalled()
})

it('does not read, start, or check invalid user/site identities', async () => {
  const store = createSiteSetupStore()
  expect(siteSetupStorageKey('owner', siteId)).toBeNull()
  expect(store.getSnapshot(userId, 'demo-project')).toBeNull()
  await store.launch('owner', siteId)
  await store.check(userId, 'demo-project')
  expect(startSiteSetup).not.toHaveBeenCalled()
  expect(checkSiteSetup).not.toHaveBeenCalled()
})

it('keeps original user/site scope when a late async result settles, deduplicates starts, and never replays saved setup', async () => {
  let settle!: (value: Awaited<ReturnType<typeof startSiteSetup>>) => void
  jest.mocked(startSiteSetup).mockReturnValue(new Promise(resolve => { settle = resolve }))
  const store = createSiteSetupStore()
  const listener = jest.fn()
  const unsubscribe = store.subscribe(userId, siteId, listener)
  const task = store.launch(userId, siteId)
  expect(store.launch(userId, siteId)).toBe(task)
  unsubscribe()
  settle({ status: 'partial', workflowId, detail: 'missing_site_url', message: 'private' })
  await task
  expect(listener).toHaveBeenCalledTimes(1)
  expect(store.getSnapshot(otherUserId, siteId)).toBeNull()
  expect(store.getSnapshot(userId, otherSiteId)).toBeNull()
  expect(store.getSnapshot(userId, siteId)?.message).toContain('Add a website URL')
  await createSiteSetupStore().launch(userId, siteId)
  expect(startSiteSetup).toHaveBeenCalledTimes(1)
})

it('retains the known workflow ID across unconfirmed results, rejected GETs, and refresh', async () => {
  const store = createSiteSetupStore()
  await store.launch(userId, siteId)
  jest.mocked(checkSiteSetup).mockResolvedValueOnce({ status: 'unconfirmed', message: 'private' })
  await store.check(userId, siteId)
  expect(store.getSnapshot(userId, siteId)).toMatchObject({ status: 'unconfirmed', workflowId })
  jest.mocked(checkSiteSetup).mockRejectedValueOnce(new Error('private'))
  await store.check(userId, siteId)
  expect(createSiteSetupStore().getSnapshot(userId, siteId)).toMatchObject({ status: 'unconfirmed', workflowId })
  expect(checkSiteSetup).toHaveBeenCalledWith(siteId, workflowId)
  expect(startSiteSetup).toHaveBeenCalledTimes(1)
})

it('restores a safe setup-email delivery warning without persisting provider details', async () => {
  jest.mocked(startSiteSetup).mockResolvedValue({ status: 'partial', workflowId,
    detail: 'setup_email_delivery_unconfirmed', message: 'private@example.invalid provider payload' })
  await createSiteSetupStore().launch(userId, siteId)
  const restored = createSiteSetupStore().getSnapshot(userId, siteId)
  expect(restored).toMatchObject({ status: 'partial', workflowId, detail: 'setup_email_delivery_unconfirmed' })
  expect(restored?.message).toContain('Setup email delivery is unconfirmed; do not resend it automatically.')
  expect(sessionStorage.getItem(key)).not.toContain('private@example.invalid')
})

it('deduplicates an explicit pending GET across subscribers and does not overwrite another site', async () => {
  const store = createSiteSetupStore()
  await store.launch(userId, siteId)
  let settle!: (value: Awaited<ReturnType<typeof checkSiteSetup>>) => void
  jest.mocked(checkSiteSetup).mockReturnValue(new Promise(resolve => { settle = resolve }))
  const task = store.check(userId, siteId)
  expect(store.check(userId, siteId)).toBe(task)
  settle({ status: 'complete', workflowId, message: 'private' })
  await task
  expect(checkSiteSetup).toHaveBeenCalledTimes(1)
  expect(store.getSnapshot(userId, siteId)?.status).toBe('complete')
  expect(store.getSnapshot(userId, otherSiteId)).toBeNull()
})

it('keeps navigation-safe memory if the browser refuses persistence', async () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('storage denied') } } as unknown as Storage
  const store = createSiteSetupStore(() => storage)
  await store.launch(userId, siteId)
  expect(store.getSnapshot(userId, siteId)).toMatchObject({ status: 'pending', workflowId })
  await store.launch(userId, siteId)
  expect(startSiteSetup).toHaveBeenCalledTimes(1)
})
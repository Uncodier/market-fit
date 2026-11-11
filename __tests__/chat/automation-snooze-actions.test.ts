import { getConversationAutomationSnooze, updateConversationAutomationSnooze } from '@/app/chat/automation-snooze-actions'
import type { AutomationSnoozeMutation } from '@/lib/chat/automation-snooze'

const conversationId = '00000000-0000-4000-8000-000000000001'
const siteId = '00000000-0000-4000-8000-000000000002'
const state = { automation_paused_until: '2026-11-11T18:00:00+00:00', last_human_reply_at: '2026-11-11T14:00:00Z', automation_snooze_hours: null }
const query = { select: jest.fn(), update: jest.fn(), eq: jest.fn(), is: jest.fn(), maybeSingle: jest.fn() }
const client = { from: jest.fn(() => query), auth: { getUser: jest.fn() } }
const can = jest.fn()
const unscoped = jest.fn()
const createClient = jest.fn<unknown, unknown[]>(() => client)
jest.mock('@/lib/supabase/server', () => ({ createClient: (...args: unknown[]) => createClient(...args) }))
jest.mock('@/lib/permissions/site-access', () => ({ userCanOnSite: (...args: unknown[]) => can(...args) }))
jest.mock('@/lib/permissions/location-boundary', () => ({ canAccessUnscopedSite: (...args: unknown[]) => unscoped(...args) }))

beforeEach(() => {
  jest.clearAllMocks()
  client.auth.getUser.mockResolvedValue({ data: { user: { id: 'authenticated-user' } }, error: null })
  can.mockResolvedValue(true)
  unscoped.mockResolvedValue(true)
  query.select.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.is.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue({ data: state, error: null })
})

it('reads a minimal site-scoped DTO using the authenticated non-demo client', async () => {
  expect(await getConversationAutomationSnooze(conversationId, siteId)).toEqual({ data: state })
  expect(createClient).toHaveBeenCalledWith(true)
  expect(can).toHaveBeenCalledWith(client, siteId, 'select')
  expect(unscoped).toHaveBeenCalledWith(client, siteId)
  expect(query.eq.mock.calls).toEqual([['id', conversationId], ['site_id', siteId]])
  expect(query.select).toHaveBeenCalledWith('automation_paused_until,last_human_reply_at,automation_snooze_hours')
})

it.each([null, 0, 0.5, 4, 168])('retires conversation hours %s without any DB write', async hours => {
  const result = await updateConversationAutomationSnooze(conversationId, siteId, { action: 'settings', hours })
  expect(result.error).toContain('lead menu')
  expect(query.update).not.toHaveBeenCalled()
})

it.each([-1, 168.1, Infinity, NaN, '4', undefined])('rejects invalid hours %s before DB access', async hours => {
  const result = await updateConversationAutomationSnooze(conversationId, siteId, { action: 'settings', hours } as AutomationSnoozeMutation)
  expect(result.error).toBeDefined()
  expect(createClient).not.toHaveBeenCalled()
})

it('rejects client bypass flags instead of forwarding them', async () => {
  expect((await updateConversationAutomationSnooze(conversationId, siteId,
    { action: 'settings', hours: 4, role: 'service_role', bypass: true } as unknown as AutomationSnoozeMutation)).error).toBeDefined()
  expect(createClient).not.toHaveBeenCalled()
})

it('requires a valid identity, authentication, permission and unscoped-site access', async () => {
  expect((await getConversationAutomationSnooze('not-a-uuid', siteId)).error).toBeDefined()
  expect(createClient).not.toHaveBeenCalled()
  client.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
  expect((await updateConversationAutomationSnooze(conversationId, siteId, { action: 'resume', expectedPausedUntil: state.automation_paused_until, expectedLastHumanReplyAt: state.last_human_reply_at })).error).toBeDefined()
  can.mockResolvedValueOnce(false)
  expect((await updateConversationAutomationSnooze(conversationId, siteId, { action: 'resume', expectedPausedUntil: state.automation_paused_until, expectedLastHumanReplyAt: state.last_human_reply_at })).error).toBeDefined()
  unscoped.mockResolvedValueOnce(false)
  expect((await getConversationAutomationSnooze(conversationId, siteId)).error).toBeDefined()
  expect(client.from).not.toHaveBeenCalled()
})

it('does not report success on a foreign-tenant or RLS-invisible row', async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: null })
  expect((await updateConversationAutomationSnooze(conversationId, siteId, { action: 'resume', expectedPausedUntil: state.automation_paused_until, expectedLastHumanReplyAt: state.last_human_reply_at })).error).toBeDefined()
  expect(query.eq).toHaveBeenCalledWith('site_id', siteId)
})

it('resumes only the observed pause; stale or repeated resumes fail safely', async () => {
  await updateConversationAutomationSnooze(conversationId, siteId, { action: 'resume', expectedPausedUntil: state.automation_paused_until, expectedLastHumanReplyAt: state.last_human_reply_at })
  expect(query.update).toHaveBeenCalledWith({ automation_paused_until: null })
  expect(query.eq).toHaveBeenCalledWith('automation_paused_until', state.automation_paused_until)
  expect(query.eq).toHaveBeenCalledWith('last_human_reply_at', state.last_human_reply_at)
  query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
  expect((await updateConversationAutomationSnooze(conversationId, siteId, { action: 'resume', expectedPausedUntil: state.automation_paused_until, expectedLastHumanReplyAt: state.last_human_reply_at })).error).toContain('changed')
})

it('never returns raw database errors', async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'internal schema detail' } })
  const result = await updateConversationAutomationSnooze(conversationId, siteId, { action: 'resume', expectedPausedUntil: state.automation_paused_until, expectedLastHumanReplyAt: state.last_human_reply_at })
  expect(result.error).toBeDefined()
  expect(JSON.stringify(result)).not.toContain('internal schema detail')
})

it('uses IS NULL for legacy replies and rejects resume without a reply version', async () => {
  await updateConversationAutomationSnooze(conversationId, siteId, { action: 'resume', expectedPausedUntil: state.automation_paused_until, expectedLastHumanReplyAt: null })
  expect(query.is).toHaveBeenCalledWith('last_human_reply_at', null)
  query.update.mockClear()
  expect((await updateConversationAutomationSnooze(conversationId, siteId, { action: 'resume', expectedPausedUntil: state.automation_paused_until } as AutomationSnoozeMutation)).error).toBeDefined()
  expect(query.update).not.toHaveBeenCalled()
})
import { getLeadAutomationSnooze, updateLeadAutomationSnooze } from '@/app/leads/automation-snooze-actions'

const leadId = '00000000-0000-4000-8000-000000000001'
const siteId = '00000000-0000-4000-8000-000000000002'
const thread = { id: '00000000-0000-4000-8000-000000000003', automation_paused_until: null, last_human_reply_at: null }
function builder() {
  const q = { select: jest.fn(), update: jest.fn(), eq: jest.fn(), order: jest.fn(), range: jest.fn(), maybeSingle: jest.fn() }
  for (const method of ['select', 'update', 'eq', 'order'] as const) q[method].mockReturnValue(q)
  return q
}
const leads = builder()
const settings = builder()
const conversations = builder()
const client = { from: jest.fn(), auth: { getUser: jest.fn() } }
const can = jest.fn()
const unscoped = jest.fn()
const create = jest.fn((..._args: unknown[]) => client)
jest.mock('@/lib/supabase/server', () => ({ createClient: (...args: unknown[]) => create(...args) }))
jest.mock('@/lib/permissions/site-access', () => ({ userCanOnSite: (...args: unknown[]) => can(...args) }))
jest.mock('@/lib/permissions/location-boundary', () => ({ canAccessUnscopedSite: (...args: unknown[]) => unscoped(...args) }))

beforeEach(() => {
  jest.clearAllMocks()
  client.from.mockImplementation(table => ({ leads, settings, conversations })[table as 'leads'])
  client.auth.getUser.mockResolvedValue({ data: { user: { id: 'actor' } }, error: null })
  can.mockResolvedValue(true)
  unscoped.mockResolvedValue(true)
  leads.maybeSingle.mockResolvedValue({ data: { automation_snooze_hours: null }, error: null })
  settings.maybeSingle.mockResolvedValue({ data: { activities: {} }, error: null })
  conversations.range.mockResolvedValue({ data: [thread], error: null })
})

it('loads lead before settings and threads with RLS tenant filters; missing activity is four hours', async () => {
  expect(await getLeadAutomationSnooze(leadId, siteId)).toEqual({ data: { hours: null, siteHours: 4, effectiveHours: 4, conversations: [thread] } })
  expect(create).toHaveBeenCalledWith(true)
  expect(can).toHaveBeenCalledWith(client, siteId, 'select')
  expect(client.from.mock.calls).toEqual([['leads'], ['settings'], ['conversations']])
  expect(leads.eq.mock.calls).toEqual([['id', leadId], ['site_id', siteId]])
  expect(settings.eq).toHaveBeenCalledWith('site_id', siteId)
  expect(conversations.eq.mock.calls).toEqual([['site_id', siteId], ['lead_id', leadId]])
})

it.each([null, 0, 2.5])('resolves lead %s over inactive site', async hours => {
  leads.maybeSingle.mockResolvedValue({ data: { automation_snooze_hours: hours }, error: null })
  settings.maybeSingle.mockResolvedValue({ data: { activities: { conversation_automation_snooze: { status: 'inactive', hours: 8 } } }, error: null })
  expect((await getLeadAutomationSnooze(leadId, siteId)).data?.effectiveHours).toBe(hours ?? 0)
})

it.each([null, 0, 0.5, 168])('saves only the lead override %s, never an active expiry or another lead', async hours => {
  leads.maybeSingle.mockResolvedValue({ data: { automation_snooze_hours: hours }, error: null })
  expect(await updateLeadAutomationSnooze(leadId, siteId, hours)).toEqual({ data: { hours } })
  expect(can).toHaveBeenCalledWith(client, siteId, 'update')
  expect(client.from.mock.calls).toEqual([['leads']])
  expect(leads.eq.mock.calls).toEqual([['id', leadId], ['site_id', siteId]])
  expect(leads.update).toHaveBeenCalledWith({ automation_snooze_hours: hours })
})

it.each([-1, 169, Infinity, NaN, '4', undefined, { hours: 4, bypass: true }])('rejects malformed override %s', async hours => {
  expect((await updateLeadAutomationSnooze(leadId, siteId, hours as number)).error).toBeDefined()
  expect(create).not.toHaveBeenCalled()
})

it('requires valid identities, authentication, user_can and site scope', async () => {
  expect((await getLeadAutomationSnooze('invalid', siteId)).error).toBeDefined()
  expect(create).not.toHaveBeenCalled()
  client.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
  expect((await getLeadAutomationSnooze(leadId, siteId)).error).toBeDefined()
  can.mockResolvedValueOnce(false)
  expect((await updateLeadAutomationSnooze(leadId, siteId, 4)).error).toBeDefined()
  unscoped.mockResolvedValueOnce(false)
  expect((await updateLeadAutomationSnooze(leadId, siteId, 4)).error).toBeDefined()
  expect(client.from).not.toHaveBeenCalled()
})

it('does not load site settings for a missing/foreign lead or report invisible updates as success', async () => {
  leads.maybeSingle.mockResolvedValue({ data: null, error: null })
  expect((await getLeadAutomationSnooze(leadId, siteId)).error).toBeDefined()
  expect(client.from.mock.calls).toEqual([['leads']])
  expect((await updateLeadAutomationSnooze(leadId, siteId, 4)).error).toBeDefined()
})

it('does not assume defaults when settings are invisible or leak database errors', async () => {
  settings.maybeSingle.mockResolvedValue({ data: null, error: { message: 'internal schema detail' } })
  const result = await getLeadAutomationSnooze(leadId, siteId)
  expect(result.error).toBeDefined()
  expect(JSON.stringify(result)).not.toContain('internal schema detail')
  settings.maybeSingle.mockResolvedValue({ data: null, error: null })
  expect((await getLeadAutomationSnooze(leadId, siteId)).error).toBeDefined()
})
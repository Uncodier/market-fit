/** @jest-environment node */
import { GET } from '@/app/api/procurement/approvals/route'
import { operationalRequestAccess } from '@/app/api/procurement/requests/http'
import { approvalRevisionState } from '@/app/api/procurement/approvals/revision-state'
import { approverNames } from '@/app/api/procurement/approvals/approver-names'

jest.mock('@/app/api/procurement/requests/http', () => ({ operationalRequestAccess: jest.fn() }))
jest.mock('@/app/api/procurement/approvals/revision-state', () => ({ approvalRevisionState: jest.fn() }))
jest.mock('@/app/api/procurement/approvals/approver-names', () => ({ approverNames: jest.fn() }))

test('returns every assigned voter including pending people and recorded historical voters', async () => {
  jest.mocked(approverNames).mockResolvedValue({ names: new Map([['caller', 'Alex'], ['waiting', 'Sam']]), ownerId: 'caller' })
  const select = jest.fn()
  const query = { select, eq: jest.fn(), order: jest.fn(), limit: jest.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) }
  for (const method of [select, query.eq, query.order, query.limit]) method.mockReturnValue(query)
  const supabase = { from: jest.fn(() => query) }
  jest.mocked(operationalRequestAccess).mockResolvedValue({ supabase, siteId: 'site', userId: 'caller' } as never)
  jest.mocked(approvalRevisionState).mockResolvedValue([{
    id: 'approval', procurement_event_stages: [{ id: 'stage', definition: { quorum: { mode: 'all' }, approverIds: ['caller', 'waiting'], mandatoryApproverIds: ['waiting'] },
      procurement_event_decisions: [{ actor_id: 'caller', decision: 'approve' }, { actor_id: 'other', decision: 'reject' }],
    }, { id: 'unvoted', definition: {}, procurement_event_decisions: [] }],
  }] as never)
  const result = await GET(new Request('https://example.test/api/procurement/approvals?site_id=site'))
  expect(result.status).toBe(200)
  const body = await result.json()
  expect(body.approvals[0].procurement_event_stages).toEqual([
    { id: 'stage', definition: { quorum: { mode: 'all' }, approverIds: ['caller', 'waiting'], mandatoryApproverIds: ['waiting'] }, approval_votes: 1, own_decision: 'approve', voters: [
      { user_id: 'caller', name: 'Alex', is_owner: true, is_self: true, mandatory: false, decision: 'approve' },
      { user_id: 'waiting', name: 'Sam', is_owner: false, is_self: false, mandatory: true, decision: null },
      { user_id: 'other', name: null, is_owner: false, is_self: false, mandatory: false, decision: 'reject' },
    ] },
    { id: 'unvoted', definition: {}, approval_votes: 0, own_decision: null, voters: [] },
  ])
  expect(JSON.stringify(body)).not.toContain('actor_id')
  expect(query.eq).toHaveBeenCalledWith('site_id', 'site')
  expect(approverNames).toHaveBeenCalledWith(supabase, 'site', ['caller', 'waiting', 'other'])
  expect(result.headers.get('Cache-Control')).toContain('no-store')
})
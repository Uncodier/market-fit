/** @jest-environment node */
import { POST } from '@/app/api/procurement/approvals/[id]/decisions/route'
import { createClient } from '@/lib/supabase/server'
import { decisionFailure, submitDecision, decisionTimeoutMessage, DecisionConflictError } from '@/app/purchases/procurement/approvals/decision-response'
import { procurementMessage } from '@/app/purchases/procurement/i18n/messages'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const site = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
const portalError = 'Tender portal is disabled. Enable the workspace tender portal from the tender details before approving publication.'

describe('approval decision diagnostics', () => {
  let failure: { code: string; message: string } | null
  let version: number
  let policyRevision: number
  let status: string
  let rpc: jest.Mock
  beforeEach(() => {
    version = 1
    policyRevision = 1
    status = 'pending'
    failure = { code: '22023', message: 'Tender portal is disabled' }
    rpc = jest.fn(async (name: string) => ({ data: name === 'current_user_site_role' ? 'admin' :
      name === 'decide_procurement_event' ? id : name === 'user_can',
    error: name === 'decide_procurement_event' ? failure : null }))
    const from = jest.fn((table: string) => {
      const query = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn(), in: jest.fn(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null, data: [{ id, version }] }).then(resolve),
        maybeSingle: async () => ({ error: null,
        data: table === 'procurement_event_approvals' ? { event: 'publication', target_id: id, target_version: 1, policy_revision: 1, status }
          : table === 'procurement_policy_versions' ? { revision: policyRevision } : { version } }) }
      query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
      query.order.mockReturnValue(query); query.limit.mockReturnValue(query); query.in.mockReturnValue(query)
      return query
    })
    jest.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id } }, error: null }) },
      rpc, from,
    } as never)
  })
  const send = (decision = 'approve') => POST(new Request(`https://example.test/api/procurement/approvals/${id}/decisions?site_id=${site}`, {
    method: 'POST', headers: { cookie: 'session=x', 'content-type': 'application/json' },
    body: JSON.stringify({ stage_id: id, decision, reason: 'Reviewed' }),
  }), { params: Promise.resolve({ id }) })
  test('portal publication blocker reaches the UI as a safe localized diagnostic', async () => {
    const response = await send()
    expect(response.status).toBe(409)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const message = await decisionFailure(response)
    expect(message).toBe(portalError)
    expect(procurementMessage(message, 'es')).toContain('portal de licitaciones está deshabilitado')
  })
  test('arbitrary RPC errors are not disclosed', async () => {
    failure = { code: '22023', message: 'private database detail' }
    const response = await send()
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain('private database detail')
  })
  test.each([
    ['40001', 'Policy changed; request a new approval', 409, 'política del espacio de trabajo cambió'],
    ['40001', 'Policy changed', 409, 'solicita una nueva aprobación'],
    ['40001', 'Approval changed', 409, 'ya no está pendiente'],
    ['40001', 'Stage changed', 409, 'Recarga la lista'],
    ['PT409', 'Approval changed', 409, 'ya no está pendiente'],
    ['PT409', 'Stage changed', 409, 'Recarga la lista'],
    ['22023', 'Deadline reached', 409, 'plazo de esta etapa'],
    ['22023', 'Earlier stage pending', 409, 'etapa de aprobación anterior'],
    ['42501', 'Ineligible approver or pending AI review', 403, 'aprobadores asignados'],
  ])('explains %s / %s with the specific cause and recovery', async (code, raw, status, expected) => {
    failure = { code, message: raw }
    const response = await send()
    expect(response.status).toBe(status)
    const message = await decisionFailure(response)
    expect(procurementMessage(message, 'es')).toContain(expected)
    expect(message).not.toContain('Check pricing, policy, deadlines')
    expect(message).not.toContain('Request changed or decision already recorded')
  })
  test('global listing restriction is distinct from portal activation and explains recovery', async () => {
    failure = { code: '22023', message: 'Global listing disabled by policy' }
    const response = await send()
    expect(response.status).toBe(409)
    const message = await decisionFailure(response)
    expect(message).toContain('Settings > Tenders')
    expect(message).toContain('request a new publication approval')
    expect(procurementMessage(message, 'es')).toContain('directorio global')
    expect(message).not.toContain('Tender portal is disabled')
  })
  test('successful decisions retain the existing response', async () => {
    failure = null
    const response = await send()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id })
  })
  test('obsolete publication is rejected before sending a vote RPC', async () => {
    version = 2
    const response = await send()
    expect(response.status).toBe(409)
    expect(await decisionFailure(response)).toContain('current working version')
    expect(rpc.mock.calls.some(([name]) => name === 'decide_procurement_event')).toBe(false)
  })
  test.each(['approved', 'rejected', 'cancelled'])('does not send another vote for a %s approval', async current => {
    status = current
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await send()
      expect(response.status).toBe(409)
      expect(await decisionFailure(response)).toContain('no longer pending')
    }
    expect(rpc.mock.calls.some(([name]) => name === 'decide_procurement_event')).toBe(false)
  })
  test('concurrent tender edits return the same actionable conflict', async () => {
    failure = { code: '40001', message: 'Tender version conflict' }
    expect(await decisionFailure(await send())).toContain('current working version')
  })
  test('a stale publication can still be explicitly rejected', async () => {
    version = 2; failure = null
    expect((await send('reject')).status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('decide_procurement_event', expect.objectContaining({ p_decision: 'reject' }))
  })
  test('a changed workspace policy blocks approval before recording a vote', async () => {
    policyRevision = 2; failure = null
    const response = await send()
    expect(response.status).toBe(409)
    expect(await decisionFailure(response)).toContain('workspace policy changed')
    expect(rpc.mock.calls.some(([name]) => name === 'decide_procurement_event')).toBe(false)
  })
  test.each([{ error: 'private database detail' }, { error: 'toString' }, { error: 42 }])(
    'client ignores unknown response diagnostics %#', async body => {
      const message = await decisionFailure({ json: async () => body } as Response)
      expect(message).toContain('Decision not confirmed')
    },
  )
  test('non-JSON failures remain unconfirmed', async () => {
    expect(await decisionFailure({ json: async () => { throw new Error('HTML') } } as unknown as Response))
      .toContain('Decision not confirmed')
  })
})

describe('bounded decision transport', () => {
  afterEach(() => jest.useRealTimers())
  test('a terminal conflict is typed and never automatically retried', async () => {
    const fetchMock = jest.mocked(fetch).mockResolvedValue({ ok: false, status: 409,
      json: async () => ({ error: portalError }) } as Response)
    fetchMock.mockClear()
    await expect(submitDecision(`/api/procurement/approvals/${id}/decisions`, {})).rejects.toBeInstanceOf(DecisionConflictError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  test('a hung request is bounded and aborted without automatic retry', async () => {
    jest.useFakeTimers()
    const fetchMock = jest.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    fetchMock.mockClear()
    const result = submitDecision('/api/fixture', { decision: 'approve' }, 50)
    const expectation = expect(result).rejects.toThrow(decisionTimeoutMessage)
    await jest.advanceTimersByTimeAsync(50)
    await expectation
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true)
  })
  test('a hanging error body is also bounded', async () => {
    jest.useFakeTimers()
    jest.mocked(fetch).mockResolvedValue({ ok: false, json: () => new Promise(() => {}) } as Response)
    const expectation = expect(submitDecision('/api/fixture', {}, 50)).rejects.toThrow(decisionTimeoutMessage)
    await jest.advanceTimersByTimeAsync(50)
    await expectation
  })
  test.each([{}, { id: 'wrong' }, { error: 'unconfirmed' }])('does not silently accept malformed success %#', async body => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => body } as Response)
    await expect(submitDecision(`/api/procurement/approvals/${id}/decisions`, {})).rejects.toThrow(decisionTimeoutMessage)
  })
  test('accepts only the expected confirmed approval ID', async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ id }) } as Response)
    await expect(submitDecision(`/api/procurement/approvals/${id}/decisions`, {})).resolves.toBeUndefined()
  })
})
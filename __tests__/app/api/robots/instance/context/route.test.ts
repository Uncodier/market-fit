/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { GET } from '@/app/api/robots/instance/context/route'
import { requireSiteAccess } from '@/lib/auth/api-site-access'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
const requireAccess = requireSiteAccess as jest.Mock
const siteId = '00000000-0000-4000-8000-000000000001'
const instanceId = '00000000-0000-4000-8000-000000000002'
const url = `http://localhost/api/robots/instance/context?site_id=${siteId}&instance_id=${instanceId}`
function scopedQuery(result: unknown) {
  const query: any = {}
  query.select = jest.fn().mockReturnValue(query)
  query.eq = jest.fn().mockReturnValue(query)
  query.maybeSingle = jest.fn().mockResolvedValue(result)
  return query
}

describe('GET robot instance context', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns only validated numeric breakdown fields for the scoped instance', async () => {
    const measuredAt = '2026-09-25T00:00:00Z'
    const breakdown = { instructions: 10, skills: 20, messages: 30, toolCalls: 40,
      toolDefinitions: 50, estimatedInputTokens: 150, usedTokens: 150, source: 'estimate', measuredAt }
    const from = jest.fn((table: string) => scopedQuery(table === 'remote_instances'
      ? { data: { id: instanceId }, error: null }
      : { data: { model: 'custom', provider: 'azure', used_tokens: 150, output_tokens: 0,
        available_tokens: null, reserved_output_tokens: 0, source: 'estimate', measured_at: measuredAt,
        input_breakdown: breakdown }, error: null }))
    requireAccess.mockResolvedValue({ supabase: { from } })
    const response = await GET(new NextRequest(url))
    expect(response.status).toBe(200)
    expect((await response.json()).context.breakdown).toEqual({
      instructions: 10, skills: 20, messages: 30, toolCalls: 40,
      toolDefinitions: 50, estimatedInputTokens: 150,
    })
  })

  it('does not attach an old breakdown to a newer total or expose arbitrary JSON fields', async () => {
    const measuredAt = '2026-09-25T00:00:01Z'
    const stored = { instructions: 10, skills: 20, messages: 30, toolCalls: 40,
      toolDefinitions: 50, estimatedInputTokens: 150, usedTokens: 150, source: 'estimate',
      measuredAt: '2026-09-25T00:00:00Z', prompt: 'must never appear' }
    const from = jest.fn((table: string) => scopedQuery(table === 'remote_instances'
      ? { data: { id: instanceId }, error: null }
      : { data: { model: 'custom', provider: 'azure', used_tokens: 160,
        available_tokens: null, source: 'estimate', measured_at: measuredAt,
        input_breakdown: stored }, error: null }))
    requireAccess.mockResolvedValue({ supabase: { from } })
    const response = await GET(new NextRequest(url))
    const body = await response.json()
    expect(body.context.breakdown).toBeNull()
    expect(JSON.stringify(body)).not.toContain('must never appear')
  })

  it('does not expose a stale or malformed breakdown and reads the pre-migration state', async () => {
    let calls = 0
    const from = jest.fn((table: string) => {
      if (table === 'remote_instances') return scopedQuery({ data: { id: instanceId }, error: null })
      calls++
      return scopedQuery(calls === 1
        ? { data: null, error: { code: '42703', message: 'column instance_context_state.input_breakdown does not exist' } }
        : { data: { model: 'custom', provider: 'azure', used_tokens: 150,
          available_tokens: null, reserved_output_tokens: 0, source: 'estimate',
          measured_at: '2026-09-25T00:00:00Z' }, error: null })
    })
    requireAccess.mockResolvedValue({ supabase: { from } })
    const response = await GET(new NextRequest(url))
    expect(response.status).toBe(200)
    expect((await response.json()).context.breakdown).toBeNull()
    expect(calls).toBe(2)
  })

  it('does not read instance data without site authorization', async () => {
    const from = jest.fn()
    requireAccess.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })
    const response = await GET(new NextRequest(url))
    expect(response.status).toBe(403)
    expect(from).not.toHaveBeenCalled()
  })

  it('requires an instance in the requested site before reading metrics', async () => {
    const from = jest.fn((table: string) => scopedQuery({ data: null, error: null }))
    requireAccess.mockResolvedValue({ supabase: { from } })
    const response = await GET(new NextRequest(url))
    expect(response.status).toBe(404)
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('remote_instances')
  })

  it('returns null context, not an invented zero-percent measurement, when no usage was saved', async () => {
    const from = jest.fn((table: string) => scopedQuery(table === 'remote_instances'
      ? { data: { id: instanceId }, error: null }
      : { data: null, error: null }))
    requireAccess.mockResolvedValue({ supabase: { from } })
    const response = await GET(new NextRequest(url))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ context: null })
  })

  it('reads legacy usage while the output-reserve migration is pending', async () => {
    let stateReads = 0
    const from = jest.fn((table: string) => {
      if (table === 'remote_instances') return scopedQuery({ data: { id: instanceId }, error: null })
      stateReads++
      return scopedQuery(stateReads === 1
        ? { data: null, error: { code: '42703' } }
        : { data: { model: 'old-deployment', provider: 'azure', used_tokens: 200,
          available_tokens: 10000, source: 'estimate', measured_at: '2026-09-25T00:00:00Z' }, error: null })
    })
    requireAccess.mockResolvedValue({ supabase: { from } })
    const response = await GET(new NextRequest(url))
    expect(response.status).toBe(200)
    expect((await response.json()).context.reservedOutputTokens).toBe(2048)
    expect(stateReads).toBe(2)
  })

  it('reads a measurement from a deployed table without output_tokens', async () => {
    let stateReads = 0
    const from = jest.fn((table: string) => {
      if (table === 'remote_instances') return scopedQuery({ data: { id: instanceId }, error: null })
      stateReads++
      return scopedQuery(stateReads < 3
        ? { data: null, error: { code: '42703', message: 'column instance_context_state.output_tokens does not exist' } }
        : { data: { model: 'custom', provider: 'azure', used_tokens: 700,
          available_tokens: null, source: 'estimate', measured_at: '2026-09-25T00:00:00Z' }, error: null })
    })
    requireAccess.mockResolvedValue({ supabase: { from } })
    const response = await GET(new NextRequest(url))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ context: expect.objectContaining({
      usedTokens: 700, outputTokens: 0, availableTokens: null, utilization: null,
    }) })
    expect(stateReads).toBe(3)
  })

  it('retains a saved output reserve when only output_tokens is missing', async () => {
    let stateReads = 0
    const from = jest.fn((table: string) => {
      if (table === 'remote_instances') return scopedQuery({ data: { id: instanceId }, error: null })
      stateReads++
      return scopedQuery(stateReads === 1
        ? { data: null, error: { code: '42703', message: 'column instance_context_state.output_tokens does not exist' } }
        : { data: { model: 'custom', provider: 'azure', used_tokens: 700,
          available_tokens: 10000, reserved_output_tokens: 1024,
          source: 'estimate', measured_at: '2026-09-25T00:00:00Z' }, error: null })
    })
    requireAccess.mockResolvedValue({ supabase: { from } })
    const response = await GET(new NextRequest(url))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ context: expect.objectContaining({
      usedTokens: 700, outputTokens: 0, reservedOutputTokens: 1024,
    }) })
    expect(stateReads).toBe(2)
  })

  it('returns scoped metrics without exposing the context memory', async () => {
    const from = jest.fn((table: string) => scopedQuery(table === 'remote_instances'
      ? { data: { id: instanceId }, error: null }
      : { data: { model: 'deployment', provider: 'azure', used_tokens: 4000, output_tokens: 250,
        available_tokens: 12000, reserved_output_tokens: 1024, source: 'estimate', measured_at: '2026-09-25T00:00:00Z' }, error: null }))
    requireAccess.mockResolvedValue({ supabase: { from } })
    const response = await GET(new NextRequest(url))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.context.utilization).toBeCloseTo(4000 / 10976)
    expect(body.context.outputTokens).toBe(250)
    expect(body.context.reservedOutputTokens).toBe(1024)
    expect(body.context.summary).toBeUndefined()
    expect(from).toHaveBeenCalledWith('instance_context_state')
  })
})

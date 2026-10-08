/** @jest-environment node */
import { NextResponse } from 'next/server'
import { POST } from '@/app/api/site-members/[siteId]/enabled/route'
import {
  createServiceSupabase,
  denyUnlessTeamManager,
  getSiteMemberAccess,
} from '@/lib/auth/site-member-request'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/auth/site-member-request', () => ({
  ...jest.requireActual('@/lib/auth/site-member-request'),
  createServiceSupabase: jest.fn(),
  getSiteMemberAccess: jest.fn(),
  denyUnlessTeamManager: jest.fn(jest.requireActual('@/lib/auth/site-member-request').denyUnlessTeamManager),
}))

const siteId = '10000000-0000-4000-8000-000000000001'
const memberId = '10000000-0000-4000-8000-000000000002'
const actorId = '10000000-0000-4000-8000-000000000003'
const foreignId = '10000000-0000-4000-8000-000000000004'
const context = { params: Promise.resolve({ siteId }) }
const member = {
  id: memberId, site_id: siteId, user_id: foreignId, role: 'collaborator',
  added_by: actorId, created_at: '2026-01-01', updated_at: '2026-10-08',
  email: 'member@example.test', name: 'Member', position: null, status: 'active',
  license_suspended: true, manually_disabled: true, blocked_screens: ['billing'],
}
const license = { siteId, plan: 'engine', current: 5, total: 7, limit: 5, requiredPlan: 'foundry' }

function request(body: unknown = { memberId, enabled: false }) {
  return new Request(`http://localhost/api/site-members/${siteId}/enabled`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

function setup(flags = { isOwner: true, isAdmin: false, isMember: false }) {
  const access = { ...flags, userId: actorId, ownerUserId: actorId, supabase: {} as never }
  jest.mocked(getSiteMemberAccess).mockResolvedValue(access)
  const rpc = jest.fn().mockResolvedValue({ data: member, error: null })
  const admin = { rpc, from: jest.fn() }
  jest.mocked(createServiceSupabase).mockReturnValue(admin as never)
  return { rpc, admin, access }
}

beforeEach(() => jest.clearAllMocks())

describe('manual member access authorization and validation', () => {
  it.each(['bad', 'demo-site', '', `${siteId}/enabled`])('rejects route ID %s before access lookup', async invalidId => {
    const { rpc } = setup()
    const response = await POST(request(), { params: Promise.resolve({ siteId: invalidId }) })
    expect(response.status).toBe(400)
    expect(getSiteMemberAccess).not.toHaveBeenCalled()
    expect(createServiceSupabase).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([401, 404, 503])('preserves access-helper denial %s without a mutation client', async status => {
    const { rpc } = setup()
    const denied = NextResponse.json({ success: false, error: 'Access unavailable' }, { status })
    jest.mocked(getSiteMemberAccess).mockResolvedValue({ error: denied })
    expect(await POST(request(), context)).toBe(denied)
    expect(createServiceSupabase).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([true, false])('denies non-manager membership=%s using the real manager guard', async isMember => {
    const { rpc, access } = setup({ isOwner: false, isAdmin: false, isMember })
    const response = await POST(request(), context)
    expect(response.status).toBe(403)
    expect(denyUnlessTeamManager).toHaveBeenCalledWith(access)
    expect(createServiceSupabase).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([
    {}, null, [], { memberId }, { enabled: true }, { memberId: 'bad', enabled: false },
    { memberId, enabled: 'false' }, { memberId, enabled: 0 }, { memberId, enabled: null },
    { memberId, enabled: false, siteId: foreignId }, { memberId, enabled: false, userId: actorId },
    { memberId, enabled: false, role: 'owner' }, { memberId, enabled: false, status: 'rejected' },
    { memberId, enabled: false, license_suspended: false },
    { memberId, enabled: false, manually_disabled: false },
  ])('strictly rejects invalid or additional body fields: %j', async body => {
    const { rpc } = setup()
    expect((await POST(request(body), context)).status).toBe(400)
    expect(createServiceSupabase).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON before constructing a mutation client', async () => {
    setup()
    const malformed = new Request('http://localhost/api', { method: 'POST', body: '{' })
    expect((await POST(malformed, context)).status).toBe(400)
    expect(createServiceSupabase).not.toHaveBeenCalled()
  })

  it.each([
    { isOwner: true, isAdmin: false, isMember: false },
    { isOwner: false, isAdmin: true, isMember: true },
  ])('authorizes manager %j before the service client and RPC', async flags => {
    const { rpc, access } = setup(flags)
    expect((await POST(request(), context)).status).toBe(200)
    expect(getSiteMemberAccess).toHaveBeenCalledWith(siteId)
    expect(denyUnlessTeamManager).toHaveBeenCalledWith(access)
    expect(jest.mocked(denyUnlessTeamManager).mock.invocationCallOrder[0])
      .toBeLessThan(jest.mocked(createServiceSupabase).mock.invocationCallOrder[0])
    expect(jest.mocked(createServiceSupabase).mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0])
  })
})

describe('manual member access RPC boundary', () => {
  it.each(['active', 'pending'])('returns retained %s member on disable without extra database writes', async status => {
    const { rpc, admin } = setup()
    const retained = { ...member, status, user_id: status === 'pending' ? null : member.user_id }
    rpc.mockResolvedValue({ data: retained, error: null })
    const response = await POST(request(), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, member: retained })
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('set_site_member_enabled', { p_site_id: siteId, p_member_id: memberId, p_enabled: false })
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('allows repeated enable requests without a quota preflight or automatic retries', async () => {
    const { rpc } = setup()
    const enabledMember = { ...member, license_suspended: false, manually_disabled: false }
    rpc.mockResolvedValue({ data: enabledMember, error: null })
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await POST(request({ memberId, enabled: true }), context)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true, member: enabledMember })
    }
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenCalledWith('set_site_member_enabled', { p_site_id: siteId, p_member_id: memberId, p_enabled: true })
  })

  it.each([
    ['22023', 'Site is unavailable', 404, 'Site not found or access denied'],
    ['22023', 'Member does not belong to site', 404, 'Member not found'],
    ['42501', 'Site owners cannot be disabled', 403, 'Cannot change the site owner from team settings'],
    ['22023', 'Only active or pending members can be enabled or disabled', 409, 'Only active or pending members can be enabled or disabled'],
    ['22023', 'Member enabled inputs are required', 400, 'Invalid member enabled request'],
  ])('maps RPC %s / %s to safe %s', async (code, message, status, expectedError) => {
    const { rpc } = setup()
    rpc.mockResolvedValue({ data: null, error: { code, message, details: 'private database detail' } })
    for (const enabled of [true, false]) {
      const response = await POST(request({ memberId, enabled }), context)
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual({ success: false, error: expectedError })
    }
  })

  it('maps atomic capacity rejection to a scoped upgrade, not a generic error', async () => {
    const { rpc } = setup({ isOwner: false, isAdmin: true, isMember: true })
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'MEMBER_LIMIT', details: JSON.stringify(license) } })
    const response = await POST(request({ memberId, enabled: true }), context)
    expect(response.status).toBe(402)
    const body = await response.json()
    expect(body).toMatchObject({ success: false, code: 'MEMBER_LIMIT', upgradeRequired: {
      kind: 'members', siteId, current: 5, limit: 5, requiredPlan: 'foundry', canUpgrade: true,
    } })
    expect(body).not.toHaveProperty('error')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it.each(['{}', 'not json', JSON.stringify({ ...license, siteId: foreignId })])('fails closed on invalid quota details %s', async details => {
    const { rpc } = setup()
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'MEMBER_LIMIT', details } })
    const response = await POST(request({ memberId, enabled: true }), context)
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'MEMBER_LICENSE_UNAVAILABLE' })
  })

  it.each([
    ['PGRST202', 'private missing function', 503], ['42883', 'private undefined function', 503],
    ['XX000', 'private database error', 500], ['P0001', 'Site owners cannot be disabled', 500],
    ['22023', 'private validation error', 500], ['42501', 'private permission error', 500],
  ])('does not disclose unrelated database errors %s', async (code, message, status) => {
    const { rpc } = setup()
    rpc.mockResolvedValue({ data: null, error: { code, message, details: JSON.stringify(license) } })
    const response = await POST(request(), context)
    expect(response.status).toBe(status)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body).not.toHaveProperty('upgradeRequired')
    expect(JSON.stringify(body)).not.toContain('private')
  })

  it.each([null, [], 'invalid', { ...member, site_id: foreignId }, { ...member, id: foreignId }])('fails closed on an invalid RPC row %j', async data => {
    const { rpc } = setup()
    rpc.mockResolvedValue({ data, error: null })
    const response = await POST(request(), context)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ success: false, error: 'Failed to update member access' })
  })

  it('hides thrown transport errors and does not retry a potentially applied mutation', async () => {
    const { rpc } = setup()
    rpc.mockRejectedValue(new Error('private transport detail'))
    const response = await POST(request(), context)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ success: false, error: 'Failed to update member access' })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
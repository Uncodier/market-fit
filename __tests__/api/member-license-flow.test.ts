/** @jest-environment node */
import { NextResponse } from 'next/server'
import { GET as getLicense } from '@/app/api/site-members/[siteId]/license/route'
import { POST as addMember } from '@/app/api/site-members/[siteId]/route'
import { POST as accept } from '@/app/api/team/accept-invitation/route'
import { POST as send } from '@/app/api/team/invite-member/route'
import { createServiceSupabase, createUserSupabase, getSiteMemberAccess, denyUnlessTeamManager } from '@/lib/auth/site-member-request'
import { memberLimitRaceResponse } from '@/lib/licenses/member-license.server'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/auth/site-member-request', () => ({
  createServiceSupabase: jest.fn(), createUserSupabase: jest.fn(),
  getSiteMemberAccess: jest.fn(), denyUnlessTeamManager: jest.fn(),
}))

const siteId = '10000000-0000-4000-8000-000000000001'
const memberId = '10000000-0000-4000-8000-000000000002'
const actorId = '10000000-0000-4000-8000-000000000003'
const context = { params: Promise.resolve({ siteId }) }
const license = { siteId, plan: 'engine', current: 5, total: 5, limit: 5, requiredPlan: 'foundry' }
const request = (body: unknown) => new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

function query(data: unknown, error: unknown = null) {
  const result = { data, error }
  return {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result), maybeSingle: jest.fn().mockResolvedValue(result),
  }
}

function setup(options: { invitation?: Record<string, unknown> | null; current?: number; rpcError?: unknown; updateError?: unknown; owner?: boolean } = {}) {
  const invitation = options.invitation === undefined ? { id: memberId, user_id: null, status: 'pending', role: 'admin', license_suspended: false } : options.invitation
  const membership = query(invitation)
  const mutation = query({ id: memberId }, options.updateError)
  membership.update.mockReturnValue(mutation)
  membership.insert.mockReturnValue(mutation)
  const site = query({ user_id: options.owner ? actorId : 'another-owner', name: 'Trusted site' })
  const profile = query(null)
  const current = options.current ?? 5
  const rpc = jest.fn().mockResolvedValue({ data: { ...license, current, requiredPlan: current < 5 ? 'engine' : 'foundry' }, error: options.rpcError ?? null })
  const inviteUserByEmail = jest.fn().mockResolvedValue({ error: null })
  const signInWithOtp = jest.fn().mockResolvedValue({ error: null })
  const admin = { from: jest.fn((table: string) => table === 'site_members' ? membership : table === 'sites' ? site : profile), rpc,
    auth: { admin: { inviteUserByEmail, getUserById: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) } } }
  jest.mocked(createServiceSupabase).mockReturnValue(admin as never)
  jest.mocked(createUserSupabase).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: actorId, email: 'invitee@example.test', email_confirmed_at: '2026-01-01' } }, error: null }) } } as never)
  jest.mocked(getSiteMemberAccess).mockResolvedValue({ userId: actorId, isOwner: true, isAdmin: false, isMember: false, supabase: { auth: { signInWithOtp } }, ownerUserId: actorId } as never)
  jest.mocked(denyUnlessTeamManager).mockReturnValue(null)
  return { admin, rpc, membership, mutation, site, inviteUserByEmail, signInWithOtp }
}

beforeEach(() => jest.clearAllMocks())

describe('authorized member license endpoint', () => {
  it('returns validated scoped usage and trusted upgrade permission', async () => {
    setup()
    const response = await getLicense(request({}), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, license: { ...license, canUpgrade: true } })
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it.each([401, 403])('does not call a license RPC when access is denied (%s)', async status => {
    const { rpc } = setup()
    jest.mocked(getSiteMemberAccess).mockResolvedValue({ error: NextResponse.json({ success: false }, { status }) })
    expect((await getLicense(request({}), context)).status).toBe(status)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('does not permit unrelated membership or malformed site IDs', async () => {
    const { rpc } = setup()
    jest.mocked(getSiteMemberAccess).mockResolvedValue({ isOwner: false, isAdmin: false, isMember: false } as never)
    expect((await getLicense(request({}), context)).status).toBe(403)
    expect((await getLicense(request({}), { params: Promise.resolve({ siteId: 'bad' }) })).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('fails closed when migration is unavailable, without returning provider errors', async () => {
    setup({ rpcError: { code: 'PGRST202', message: 'secret missing function detail' } })
    const response = await getLicense(request({}), context)
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('secret')
  })
  it('maps null archived/missing site to404', async () => {
    const { rpc } = setup()
    rpc.mockResolvedValue({ data: null, error: null } as never)
    expect((await getLicense(request({}), context)).status).toBe(404)
  })
})

describe('member creation preflight and database race', () => {
  it('recommends a license sufficient to restore all retained members', async () => {
    const { rpc } = setup()
    rpc.mockResolvedValue({ data: { ...license, total: 12 }, error: null })
    const response = await addMember(request({ email: 'new@example.test', role: 'admin' }), context)
    expect(await response.json()).toMatchObject({ upgradeRequired: { requiredPlan: 'enterprise' } })
  })

  it('blocks before profile lookup, insert or email delivery', async () => {
    const { admin, membership, inviteUserByEmail } = setup()
    const response = await addMember(request({ email: 'new@example.test', role: 'admin' }), context)
    expect(response.status).toBe(402)
    expect(await response.json()).toMatchObject({ code: 'MEMBER_LIMIT', upgradeRequired: { kind: 'members', siteId, canUpgrade: true, requiredPlan: 'foundry' } })
    expect(admin.from).not.toHaveBeenCalled()
    expect(membership.insert).not.toHaveBeenCalled()
    expect(inviteUserByEmail).not.toHaveBeenCalled()
  })
  it('maps atomic insert race to a structured402', async () => {
    const { membership } = setup({ invitation: null, current: 4, updateError: { code: 'P0001', message: 'MEMBER_LIMIT', details: JSON.stringify(license) } })
    const response = await addMember(request({ email: 'new@example.test', role: 'admin' }), context)
    expect(response.status).toBe(402)
    expect(membership.insert).toHaveBeenCalled()
    expect(await response.json()).not.toHaveProperty('error')
  })
  it('does not turn an unrelated DB failure or forged details into an upgrade', () => {
    expect(memberLimitRaceResponse({ code: 'P0001', message: 'OTHER', details: JSON.stringify(license) }, siteId, true)).toBeNull()
    expect(memberLimitRaceResponse({ code: 'P0001', message: 'MEMBER_LIMIT', details: '{}' }, siteId, true)?.status).toBe(503)
  })
})

describe('verified invitation acceptance', () => {
  it('accepts an unsuspended reserved seat at the cap and does not grant pending admin billing permission', async () => {
    const { rpc, mutation } = setup({ current: 4 })
    expect((await accept(request({ siteId, role: 'owner' }))).status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('get_site_member_license', { p_site_id: siteId, p_member_id: memberId })
    expect(mutation.eq).toHaveBeenCalledWith('license_suspended', false)
  })
  it.each(['pending', 'active'])('returns upgrade for a suspended %s invitation without activation', async status => {
    const { rpc, membership } = setup({ invitation: { id: memberId, user_id: actorId, status, role: 'admin', license_suspended: true } })
    const response = await accept(request({ siteId }))
    expect(response.status).toBe(402)
    expect(await response.json()).toMatchObject({ upgradeRequired: { canUpgrade: false } })
    expect(rpc).toHaveBeenCalledWith('get_site_member_license', { p_site_id: siteId })
    expect(membership.update).not.toHaveBeenCalled()
  })
  it('checks archived site before returning already-active success', async () => {
    const { site, rpc } = setup({ invitation: { id: memberId, user_id: actorId, status: 'active', role: 'admin', license_suspended: false } })
    site.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect((await accept(request({ siteId }))).status).toBe(404)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('does not read license usage for an invitation bound to another user', async () => {
    const { rpc } = setup({ invitation: { id: memberId, user_id: 'different-user', status: 'pending', role: 'admin', license_suspended: false } })
    expect((await accept(request({ siteId }))).status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('maps activation race to402 without provider details', async () => {
    setup({ current: 4, updateError: { code: 'P0001', message: 'MEMBER_LIMIT', details: JSON.stringify(license) } })
    const response = await accept(request({ siteId }))
    expect(response.status).toBe(402)
    expect(await response.json()).toMatchObject({ upgradeRequired: { canUpgrade: false } })
  })
  it('rechecks conditional update conflicts after a concurrent license suspension', async () => {
    const { membership, mutation, rpc } = setup({ current: 4 })
    mutation.maybeSingle.mockResolvedValue({ data: null, error: null })
    membership.maybeSingle.mockResolvedValueOnce({ data: { id: memberId, user_id: null, status: 'pending', role: 'admin', license_suspended: false }, error: null })
      .mockResolvedValueOnce({ data: { id: memberId, user_id: null, status: 'pending', role: 'admin', license_suspended: true }, error: null })
    const response = await accept(request({ siteId }))
    expect(response.status).toBe(402)
    expect(await response.json()).toMatchObject({ upgradeRequired: { canUpgrade: false } })
    expect(rpc).toHaveBeenLastCalledWith('get_site_member_license', { p_site_id: siteId })
  })
  it('returns idempotent success when another acceptance activated the same reserved member', async () => {
    const { membership, mutation } = setup({ current: 4 })
    mutation.maybeSingle.mockResolvedValue({ data: null, error: null })
    membership.maybeSingle.mockResolvedValueOnce({ data: { id: memberId, user_id: null, status: 'pending', role: 'admin', license_suspended: false }, error: null })
      .mockResolvedValueOnce({ data: { id: memberId, user_id: actorId, status: 'active', role: 'admin', license_suspended: false }, error: null })
    const response = await accept(request({ siteId }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ alreadyMember: true })
  })
  it.each([null, { id: actorId, email: 'invitee@example.test' }])('requires authenticated confirmed email (%s)', async user => {
    const { rpc, admin } = setup()
    jest.mocked(createUserSupabase).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) } } as never)
    expect((await accept(request({ siteId }))).status).toBe(401)
    expect(admin.from).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('send/resend reserved membership', () => {
  it.each([null, { id: memberId, status: 'pending', role: 'admin', license_suspended: true }])('never sends an unactivatable invitation at cap (%s)', async invitation => {
    const { inviteUserByEmail, signInWithOtp } = setup({ invitation })
    expect((await send(request({ siteId, email: 'invitee@example.test' }))).status).toBe(402)
    expect(inviteUserByEmail).not.toHaveBeenCalled()
    expect(signInWithOtp).not.toHaveBeenCalled()
  })
  it('requires reservation when below capacity, rather than sending unactivatable email', async () => {
    const { inviteUserByEmail } = setup({ invitation: null, current: 4 })
    expect((await send(request({ siteId, email: 'invitee@example.test' }))).status).toBe(400)
    expect(inviteUserByEmail).not.toHaveBeenCalled()
  })
  it('sends reserved invitations using server-owned metadata and exclusion', async () => {
    const { rpc, inviteUserByEmail } = setup({ current: 4 })
    expect((await send(request({ siteId, email: 'invitee@example.test', role: 'owner', siteName: 'Injected' }))).status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('get_site_member_license', { p_site_id: siteId, p_member_id: memberId })
    expect(inviteUserByEmail).toHaveBeenCalledWith('invitee@example.test', expect.objectContaining({ data: expect.objectContaining({ role: 'admin', siteName: 'Trusted site' }) }))
  })
  it('does not send email or expose quota without manager authorization', async () => {
    const { rpc, inviteUserByEmail } = setup()
    jest.mocked(denyUnlessTeamManager).mockReturnValue(NextResponse.json({ success: false }, { status: 403 }))
    expect((await send(request({ siteId, email: 'invitee@example.test' }))).status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
    expect(inviteUserByEmail).not.toHaveBeenCalled()
  })
})
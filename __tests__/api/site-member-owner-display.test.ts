/** @jest-environment node */
import { GET } from '@/app/api/site-members/[siteId]/route'
import { createServiceSupabase, getSiteMemberAccess } from '@/lib/auth/site-member-request'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/auth/site-member-request', () => ({
  createServiceSupabase: jest.fn(), getSiteMemberAccess: jest.fn(), denyUnlessTeamManager: jest.fn(),
}))

const siteId = '11111111-1111-4111-8111-111111111111'
const ownerId = '22222222-2222-4222-8222-222222222222'

it('marks the trusted primary owner even when their membership role has not been updated', async () => {
  jest.mocked(getSiteMemberAccess).mockResolvedValue({ isOwner: true, isAdmin: false, isMember: true,
    userId: ownerId, ownerUserId: ownerId, supabase: {} as never })
  const members = [
    { id: 'owner-membership', site_id: siteId, user_id: ownerId, role: 'admin', status: 'active', email: 'owner@example.test' },
    { id: 'admin-membership', site_id: siteId, user_id: 'other-user', role: 'admin', status: 'active', email: 'admin@example.test' },
  ]
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({ data: members, error: null }) }
  jest.mocked(createServiceSupabase).mockReturnValue({
    from: jest.fn().mockReturnValue(query),
    auth: { admin: { getUserById: jest.fn().mockResolvedValue({ data: { user: { email_confirmed_at: '2026-01-01', last_sign_in_at: '2026-01-01' } }, error: null }) } },
  } as never)
  const response = await GET(new Request(`http://localhost/api/site-members/${siteId}`), { params: Promise.resolve({ siteId }) })
  expect(response.status).toBe(200)
  expect((await response.json()).members).toEqual([
    expect.objectContaining({ id: 'owner-membership', role: 'admin', is_primary_owner: true }),
    expect.objectContaining({ id: 'admin-membership', role: 'admin', is_primary_owner: false }),
  ])
})
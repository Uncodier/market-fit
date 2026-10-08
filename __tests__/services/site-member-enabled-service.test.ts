import { siteMembersService, type SiteMember } from '@/app/services/site-members-service'
import { BillingUpgradeRequired } from '@/lib/billing-limit-errors'
import { createClient } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const siteId = '10000000-0000-4000-8000-000000000001'
const memberId = '10000000-0000-4000-8000-000000000002'
const foreignId = '10000000-0000-4000-8000-000000000003'
const member: SiteMember = {
  id: memberId, site_id: siteId, user_id: foreignId, role: 'collaborator', added_by: null,
  created_at: '2026-01-01', updated_at: '2026-10-08', email: 'member@example.test',
  name: 'Member', position: null, status: 'active', blocked_screens: ['billing'],
  license_suspended: true, manually_disabled: true,
}
const payload = {
  kind: 'members', siteId, current: 5, limit: 5, requiredPlan: 'foundry',
  canUpgrade: true, message: 'Upgrade required',
}

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: jest.fn().mockResolvedValue(body) } as unknown as Response
}

beforeEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

describe('siteMembersService.setMemberEnabled', () => {
  it.each([true, false])('posts only the target and enabled=%s, returning the retained member', async enabled => {
    const updated = { ...member, manually_disabled: !enabled, license_suspended: !enabled }
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(response({ success: true, member: updated }))
    await expect(siteMembersService.setMemberEnabled(siteId, memberId, enabled)).resolves.toEqual(updated)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(`/api/site-members/${siteId}/enabled`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, enabled }),
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('encodes the site as a single path segment', async () => {
    const encodedSite = 'site/with?query'
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(response({ success: true, member: { ...member, site_id: encodedSite } }))
    await siteMembersService.setMemberEnabled(encodedSite, memberId, false)
    expect(fetch).toHaveBeenCalledWith(`/api/site-members/${encodeURIComponent(encodedSite)}/enabled`, expect.any(Object))
  })

  it('preserves a pending invitation without sending an email or changing its status', async () => {
    const pending = { ...member, user_id: null, status: 'pending' }
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(response({ success: true, member: pending }))
    await expect(siteMembersService.setMemberEnabled(siteId, memberId, false)).resolves.toEqual(pending)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([true, false])('throws a typed upgrade before a generic message with canUpgrade=%s', async canUpgrade => {
    const upgradeRequired = { ...payload, canUpgrade }
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(response({
      success: false, code: 'MEMBER_LIMIT', error: 'Generic failure must not win', upgradeRequired,
    }, 402))
    const error = await siteMembersService.setMemberEnabled(siteId, memberId, true).catch(error => error)
    expect(error).toBeInstanceOf(BillingUpgradeRequired)
    expect(error.payload).toEqual(upgradeRequired)
    expect(error.message).toBe('Upgrade required')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    { ...payload, siteId: foreignId }, { ...payload, requiredPlan: 'invented' },
    { ...payload, canUpgrade: undefined }, { ...payload, kind: 'accounts' }, {},
  ])('rejects untrusted or incomplete upgrade metadata %j as an ordinary error', async upgradeRequired => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ success: false, error: 'Cannot enable member', upgradeRequired }, 402))
    const error = await siteMembersService.setMemberEnabled(siteId, memberId, true).catch(error => error)
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(BillingUpgradeRequired)
    expect(error.message).toBe('Cannot enable member')
  })

  it.each([401, 403, 404, 409, 500, 503])('preserves safe server errors with status %s', async status => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ success: false, error: 'Member access unavailable' }, status))
    await expect(siteMembersService.setMemberEnabled(siteId, memberId, true)).rejects.toThrow('Member access unavailable')
  })

  it('does not convert an availability failure into an upgrade even if metadata is present', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ success: false, code: 'MEMBER_LICENSE_UNAVAILABLE', upgradeRequired: payload }, 503))
    const error = await siteMembersService.setMemberEnabled(siteId, memberId, true).catch(error => error)
    expect(error).not.toBeInstanceOf(BillingUpgradeRequired)
    expect(error.message).toBe('Failed to update member access')
  })

  it.each([null, {}, 'invalid', { success: false }, { success: 'true', member }, { error: { message: 'not a safe message' } }])('handles malformed response envelope %j', async body => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response(body))
    await expect(siteMembersService.setMemberEnabled(siteId, memberId, false)).rejects.toThrow('Failed to update member access')
  })

  it.each([null, undefined, [], 'invalid', { ...member, id: foreignId }, { ...member, site_id: foreignId }])('rejects an invalid or unscoped success row %j', async invalidMember => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ success: true, member: invalidMember }))
    await expect(siteMembersService.setMemberEnabled(siteId, memberId, false)).rejects.toThrow('Invalid member enabled response')
  })

  it('handles non-JSON failures without leaking the parser error', async () => {
    const nonJson = response(null, 502)
    jest.mocked(nonJson.json).mockRejectedValue(new SyntaxError('private HTML body'))
    jest.spyOn(global, 'fetch').mockResolvedValue(nonJson)
    await expect(siteMembersService.setMemberEnabled(siteId, memberId, true)).rejects.toThrow('Failed to update member access')
  })

  it('does not retry network failures', async () => {
    const networkError = new Error('Network unavailable')
    const fetch = jest.spyOn(global, 'fetch').mockRejectedValue(networkError)
    await expect(siteMembersService.setMemberEnabled(siteId, memberId, true)).rejects.toBe(networkError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
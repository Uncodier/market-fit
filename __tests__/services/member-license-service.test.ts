import { siteMembersService } from '@/app/services/site-members-service'
import { sendMagicLinkInvitation, resendMagicLinkInvitation, processTeamInvitation } from '@/app/services/magic-link-invitation-service'
import { BillingUpgradeRequired } from '@/lib/billing-limit-errors'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
const siteId = '10000000-0000-4000-8000-000000000001'
const payload = { kind: 'members', siteId, current: 5, limit: 5, requiredPlan: 'foundry', canUpgrade: false, message: 'Upgrade required' }
const license = { siteId, plan: 'engine', current: 5, total: 7, limit: 5, requiredPlan: 'foundry', canUpgrade: true }

function response(body: unknown, status = 200) {
  return { ok: status < 400, status, json: jest.fn().mockResolvedValue(body) } as unknown as Response
}

beforeEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

it('validates license response, including restoration demand', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response({ success: true, license }))
  await expect(siteMembersService.getLicense(siteId)).resolves.toEqual(license)
})

it.each([
  { ...license, plan: 'invented' }, { ...license, current: -1 }, { ...license, current: 1.5 },
  { ...license, siteId: '10000000-0000-4000-8000-000000000002' }, { ...license, limit: 50 },
  { ...license, canUpgrade: 'true' }, { ...license, total: 4 },
])('rejects unsafe license response %s', async invalidLicense => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response({ success: true, license: invalidLicense }))
  await expect(siteMembersService.getLicense(siteId)).rejects.toThrow('Invalid member license response')
})

it('throws typed upgrade on add402 without triggering the email endpoint', async () => {
  const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(response({ success: false, code: 'MEMBER_LIMIT', upgradeRequired: payload }, 402))
  await expect(siteMembersService.addMember(siteId, { email: 'new@example.test', role: 'admin' })).rejects.toBeInstanceOf(BillingUpgradeRequired)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('keeps unavailable migration failures ordinary rather than inventing an upgrade', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response({ success: false, code: 'MEMBER_LICENSE_UNAVAILABLE', error: 'Member licensing is temporarily unavailable' }, 503))
  await expect(siteMembersService.addMember(siteId, { email: 'new@example.test', role: 'admin' })).rejects.not.toBeInstanceOf(BillingUpgradeRequired)
})

it.each([sendMagicLinkInvitation, resendMagicLinkInvitation])('returns structured upgrade without generic error for send/resend', async service => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response({ success: false, code: 'MEMBER_LIMIT', upgradeRequired: payload }, 402))
  await expect(service({ siteId, email: 'new@example.test', siteName: 'Site', role: 'view' })).resolves.toEqual({ success: false, code: 'MEMBER_LIMIT', upgradeRequired: payload })
})

it('returns upgrade without an error for invitation processing', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response({ success: false, code: 'MEMBER_LIMIT', upgradeRequired: payload }, 402))
  await expect(processTeamInvitation({ siteId, userEmail: 'new@example.test', siteName: 'Site', role: 'view' })).resolves.toEqual({ success: false, upgradeRequired: payload })
})

it('preserves a raced send upgrade as typed upgrade rather than InviteEmailError', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValueOnce(response({ success: true, member: { id: 'member' } }))
    .mockResolvedValueOnce(response({ success: false, code: 'MEMBER_LIMIT', upgradeRequired: payload }, 402))
  await expect(siteMembersService.addMember(siteId, { email: 'new@example.test', role: 'admin' })).rejects.toBeInstanceOf(BillingUpgradeRequired)
})
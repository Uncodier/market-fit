import React, { type PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTeamMembers } from '@/app/components/settings/use-team-members'
import { siteMembersService, type SiteMember } from '@/app/services/site-members-service'
import { toast } from 'sonner'
import { BILLING_LIMIT_EVENT, BillingUpgradeRequired, type BillingLimitPayload } from '@/lib/billing-limit-errors'
import { siteMemberToFormMember } from '@/app/components/settings/team-types'
import type { SiteMemberLicense } from '@/lib/license-entitlements'
import type { SiteFormValues } from '@/app/components/settings/form-schema'
import { resendMagicLinkInvitation } from '@/app/services/magic-link-invitation-service'

jest.mock('@/app/services/site-members-service', () => ({
  siteMembersService: { getMembers: jest.fn(), getLicense: jest.fn(), addMember: jest.fn(), removeMember: jest.fn(), updateMember: jest.fn() },
  isInviteEmailError: () => false,
}))
jest.mock('@/app/services/magic-link-invitation-service', () => ({ resendMagicLinkInvitation: jest.fn() }))
jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: () => ({ capabilities: { is_owner: true, role: 'owner' } }) }))
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }))

const siteId = '11111111-1111-4111-8111-111111111111'
const owner: SiteMember = {
  id: 'owner', site_id: siteId, user_id: 'owner-user', email: 'owner@example.test', role: 'owner', status: 'active',
  name: 'Owner', position: null, created_at: '', updated_at: '',
  added_by: null,
}
const atCap: SiteMemberLicense = { siteId, plan: 'commission', current: 1, limit: 1, requiredPlan: 'engine', canUpgrade: true }
const blocked: BillingLimitPayload = { kind: 'members', siteId, current: 5, limit: 5, requiredPlan: 'foundry', canUpgrade: true }
const service = jest.mocked(siteMembersService)

function Wrapper({ children }: PropsWithChildren) {
  const form = useForm<SiteFormValues>({ defaultValues: { name: 'Test site', team_members: [] } })
  return <FormProvider {...form}>{children}</FormProvider>
}

describe('team member license admission', () => {
  let event: jest.Mock
  beforeEach(() => {
    jest.clearAllMocks()
    service.getMembers.mockResolvedValue([owner])
    service.getLicense.mockResolvedValue(atCap)
    event = jest.fn()
    window.addEventListener(BILLING_LIMIT_EVENT, event)
  })
  afterEach(() => window.removeEventListener(BILLING_LIMIT_EVENT, event))

  it('opens the upgrade modal directly from invite at cap without inserting a draft', async () => {
    const { result } = renderHook(() => useTeamMembers({ active: true, siteId }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.license).toEqual(atCap))
    act(() => result.current.addTeamMember())
    expect(result.current.teamList).toHaveLength(1)
    expect(event).toHaveBeenCalledTimes(1)
    expect(event.mock.calls[0][0].detail).toMatchObject({ kind: 'members', siteId, requiredPlan: 'engine', current: 1 })
    expect(service.addMember).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('opens the modal on a server race without a generic error toast and preserves the draft', async () => {
    service.getLicense.mockResolvedValue({ ...atCap, plan: 'engine', limit: 5 })
    service.addMember.mockRejectedValue(new BillingUpgradeRequired(blocked))
    const { result } = renderHook(() => useTeamMembers({ active: true, siteId }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.license?.limit).toBe(5))
    act(() => result.current.addTeamMember())
    act(() => result.current.updateLocalTeamMember(0, 'email', 'draft@example.test'))
    await act(async () => result.current.handleSaveTeamMembers())
    expect(event.mock.calls[0][0].detail).toEqual(blocked)
    expect(toast.error).not.toHaveBeenCalled()
    expect(result.current.teamList[0].email).toBe('draft@example.test')
    expect(result.current.teamList[0].id).toBeUndefined()
  })

  it('reserves local drafts against the site allowance before adding another row', async () => {
    service.getLicense.mockResolvedValue({ ...atCap, plan: 'engine', current: 4, limit: 5 })
    const { result } = renderHook(() => useTeamMembers({ active: true, siteId }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.license?.limit).toBe(5))
    act(() => result.current.addTeamMember())
    act(() => result.current.addTeamMember())
    expect(result.current.teamList.filter(member => !member.id)).toHaveLength(1)
    expect(event.mock.calls[0][0].detail).toMatchObject({ current: 5, requiredPlan: 'foundry' })
  })

  it('does not invent an Enterprise member maximum', async () => {
    service.getLicense.mockResolvedValue({ ...atCap, plan: 'enterprise', current: 50, limit: null, requiredPlan: 'enterprise' })
    const { result } = renderHook(() => useTeamMembers({ active: true, siteId }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.license?.plan).toBe('enterprise'))
    act(() => result.current.addTeamMember())
    expect(result.current.teamList.filter(member => !member.id)).toHaveLength(1)
    expect(event).not.toHaveBeenCalled()
  })

  it('preserves all remaining drafts after a partial batch reaches the member cap', async () => {
    service.getLicense.mockResolvedValue({ ...atCap, plan: 'engine', current: 4, limit: 5 })
    const saved: SiteMember = { ...owner, id: 'saved', user_id: null, email: 'second@example.test', role: 'collaborator', status: 'pending' }
    service.addMember.mockResolvedValue(saved)
    const { result } = renderHook(() => useTeamMembers({ active: true, siteId }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.license?.limit).toBe(5))
    // Two drafts fit locally before another member uses one of the available seats.
    service.getLicense.mockResolvedValue({ ...atCap, plan: 'engine', current: 3, limit: 5 })
    await act(async () => result.current.refreshLicense())
    act(() => result.current.addTeamMember())
    act(() => result.current.updateLocalTeamMember(0, 'email', 'first@example.test'))
    act(() => result.current.addTeamMember())
    act(() => result.current.updateLocalTeamMember(0, 'email', 'second@example.test'))
    service.getLicense.mockResolvedValue({ ...atCap, plan: 'engine', current: 4, limit: 5 })
    await act(async () => result.current.refreshLicense())
    service.getMembers.mockResolvedValue([owner, saved])
    service.getLicense.mockResolvedValue({ ...atCap, plan: 'engine', current: 5, limit: 5 })
    await act(async () => result.current.handleSaveTeamMembers())
    expect(service.addMember).toHaveBeenCalledTimes(1)
    expect(result.current.teamList.find(member => member.email === 'first@example.test')).toMatchObject({ email: 'first@example.test' })
    expect(result.current.teamList.find(member => member.email === 'first@example.test')?.id).toBeUndefined()
    expect(result.current.teamList.find(member => member.id === 'saved')?.status).toBe('pending')
    expect(event.mock.calls[0][0].detail.requiredPlan).toBe('foundry')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('does not assume capacity when the license RPC is unavailable', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {})
    service.getLicense.mockRejectedValue(new Error('Member license is unavailable'))
    const { result } = renderHook(() => useTeamMembers({ active: true, siteId }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.licenseError).toBe(true))
    act(() => result.current.addTeamMember())
    expect(result.current.license).toBeNull()
    expect(result.current.teamList).toHaveLength(1)
    expect(result.current.teamList[0].id).toBe('owner')
    expect(event).not.toHaveBeenCalled()
    expect(service.addMember).not.toHaveBeenCalled()
    log.mockRestore()
  })

  it('resending a suspended invitation opens the upgrade dialog without an error toast', async () => {
    jest.mocked(resendMagicLinkInvitation).mockResolvedValue({ success: false, upgradeRequired: blocked })
    const { result } = renderHook(() => useTeamMembers({ active: true, siteId }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.license).toEqual(atCap))
    await act(async () => result.current.handleResendInvitation({ id: 'pending', email: 'pending@example.test', status: 'pending', license_suspended: true, role: 'view' }))
    expect(event.mock.calls[0][0].detail).toEqual(blocked)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it.each(['active', 'pending'] as const)('preserves %s status independently of license suspension', status => {
    expect(siteMemberToFormMember({ ...owner, status, license_suspended: true })).toMatchObject({ status, license_suspended: true })
  })
})
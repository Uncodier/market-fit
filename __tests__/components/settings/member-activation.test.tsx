import React, { type PropsWithChildren } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { TeamMemberCard } from '@/app/components/settings/TeamMemberCard'
import { useTeamMembers } from '@/app/components/settings/use-team-members'
import { useOptionalPermissions } from '@/app/context/PermissionContext'
import { siteMembersService, type SiteMember } from '@/app/services/site-members-service'
import { siteMemberToFormMember } from '@/app/components/settings/team-types'
import type { SiteFormValues } from '@/app/components/settings/form-schema'
import { BILLING_LIMIT_EVENT, BillingUpgradeRequired } from '@/lib/billing-limit-errors'
import { toast } from 'sonner'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/components/settings/MemberBlockedScreens', () => ({ MemberBlockedScreens: () => null }))
jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: jest.fn() }))
jest.mock('@/app/services/site-members-service', () => ({
  siteMembersService: { getMembers: jest.fn(), getLicense: jest.fn(), setMemberEnabled: jest.fn(), removeMember: jest.fn() },
  isInviteEmailError: () => false,
}))
jest.mock('@/app/services/magic-link-invitation-service', () => ({ resendMagicLinkInvitation: jest.fn() }))
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }))

const siteId = '11111111-1111-4111-8111-111111111111'
const member: SiteMember = {
  id: 'member', site_id: siteId, user_id: 'user', email: 'member@example.test', name: 'Member',
  role: 'collaborator', status: 'active', position: 'Sales', license_suspended: false, manually_disabled: false,
  added_by: null, created_at: '', updated_at: '',
}
const license = { siteId, plan: 'engine' as const, current: 2, total: 2, limit: 5, requiredPlan: 'engine' as const, canUpgrade: true }
const service = jest.mocked(siteMembersService)
function Wrapper({ children }: PropsWithChildren) {
  const form = useForm<SiteFormValues>({ defaultValues: { name: 'Test site', team_members: [] } })
  return <FormProvider {...form}>{children}</FormProvider>
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useOptionalPermissions).mockReturnValue({ capabilities: { is_owner: true, role: 'owner' } } as never)
  service.getMembers.mockResolvedValue([member])
  service.getLicense.mockResolvedValue(license)
})

function renderCard(overrides: Partial<React.ComponentProps<typeof TeamMemberCard>> = {}) {
  const props: React.ComponentProps<typeof TeamMemberCard> = {
    member: siteMemberToFormMember(member), index: 0, canEditBlockedScreens: true, canManageTeam: true,
    isLoading: false, isSaving: false, isSavingThis: false, isResendingThis: false, isUpdatingStatus: false,
    hasChanges: false, canSave: false,
    validation: { canChangeRole: () => true, canDelete: () => true, getDeleteTooltip: () => '', getDeleteMessage: () => '', getRoleChangeMessage: () => '' },
    onUpdate: jest.fn(), onSave: jest.fn(), onSaveInvite: jest.fn(), onRemove: jest.fn(), onResend: jest.fn(), onEnabledChange: jest.fn(),
    ...overrides,
  }
  render(<TeamMemberCard {...props} />, { wrapper: Wrapper })
  return props
}

describe('team member activation switch', () => {
  it('replaces the active chip with a switch and never invokes removal or field editing', () => {
    const props = renderCard()
    const toggle = screen.getByRole('switch', { name: 'Member license for Member' })
    expect(toggle).toBeChecked()
    expect(screen.getByRole('heading', { name: 'Member' }).closest('.justify-between')).toHaveClass('items-center')
    fireEvent.click(toggle)
    expect(props.onEnabledChange).toHaveBeenCalledWith(false)
    expect(props.onRemove).not.toHaveBeenCalled()
    expect(props.onUpdate).not.toHaveBeenCalled()
  })

  it.each([{ role: 'owner' as const }, { role: 'admin' as const, is_primary_owner: true }])('shows the Owner badge without a license switch (%j)', ownership => {
    renderCard({ member: siteMemberToFormMember({ ...member, ...ownership }) })
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /Member license/ })).not.toBeInTheDocument()
  })

  it.each([{ manually_disabled: true, license_suspended: true }, { manually_disabled: false, license_suspended: true }])(
    'shows an off switch for a suspended member (%j)', flags => {
      const props = renderCard({ member: siteMemberToFormMember({ ...member, ...flags }) })
      const toggle = screen.getByRole('switch', { name: /Member license/ })
      expect(toggle).not.toBeChecked()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
      expect(screen.getByText(member.email)).toBeInTheDocument()
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
      fireEvent.click(toggle)
      expect(props.onEnabledChange).toHaveBeenCalledWith(true)
    }
  )

  it('collapses on deactivation and restores the same editable values on reactivation', () => {
    const props: React.ComponentProps<typeof TeamMemberCard> = {
      member: siteMemberToFormMember(member), index: 0, canEditBlockedScreens: true, canManageTeam: true,
      isLoading: false, isSaving: false, isSavingThis: false, isResendingThis: false, isUpdatingStatus: false,
      hasChanges: true, canSave: true,
      validation: { canChangeRole: () => true, canDelete: () => true, getDeleteTooltip: () => '', getDeleteMessage: () => '', getRoleChangeMessage: () => '' },
      onUpdate: jest.fn(), onSave: jest.fn(), onSaveInvite: jest.fn(), onRemove: jest.fn(), onResend: jest.fn(), onEnabledChange: jest.fn(),
    }
    const { rerender } = render(<TeamMemberCard {...props} />, { wrapper: Wrapper })
    expect(screen.getByLabelText('Name')).toHaveValue('Member')
    rerender(<TeamMemberCard {...props} member={{ ...props.member, manually_disabled: true }} />)
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Member license/ })).not.toBeChecked()
    expect(screen.getByTitle('Unsaved changes')).toBeInTheDocument()
    rerender(<TeamMemberCard {...props} />)
    expect(screen.getByLabelText('Name')).toHaveValue('Member')
    expect(screen.getByLabelText('Position')).toHaveValue('Sales')
    expect(screen.getByRole('switch', { name: /Member license/ })).toBeChecked()
  })

  it.each([{ canManageTeam: false }, { isUpdatingStatus: true }, { isSaving: true }, { isResendingThis: true }])(
    'disables the switch while unauthorized or busy (%j)', overrides => {
      const props = renderCard(overrides)
      const toggle = screen.getByRole('switch', { name: /Member license/ })
      expect(toggle).toBeDisabled()
      fireEvent.click(toggle)
      expect(props.onEnabledChange).not.toHaveBeenCalled()
    }
  )

  it('can release a pending invitation seat without marking the invitation accepted', () => {
    const props = renderCard({ member: siteMemberToFormMember({ ...member, status: 'pending' }) })
    expect(screen.getByText('Pending')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: /Member license/ }))
    expect(props.onEnabledChange).toHaveBeenCalledWith(false)
  })

  it('hides resend while an invitation is manually disabled', () => {
    renderCard({ member: siteMemberToFormMember({ ...member, status: 'pending', manually_disabled: true, license_suspended: true }) })
    expect(screen.queryByRole('button', { name: /Resend/ })).not.toBeInTheDocument()
  })

  it.each([{ id: undefined, status: undefined }, { status: 'rejected' as const }])('does not activate drafts or rejected invitations (%j)', overrides => {
    renderCard({ member: { ...siteMemberToFormMember(member), ...overrides } })
    expect(screen.queryByRole('switch', { name: /Member license/ })).not.toBeInTheDocument()
  })
})

describe('persisting member activation', () => {
  async function setup() {
    const hook = renderHook(() => useTeamMembers({ active: true, siteId }), { wrapper: Wrapper })
    await waitFor(() => expect(hook.result.current.teamList).toHaveLength(1))
    return hook
  }

  it('persists deactivation immediately, refreshes seats and retains unsaved edits and drafts', async () => {
    const disabled = { ...member, manually_disabled: true, license_suspended: true }
    service.setMemberEnabled.mockResolvedValue(disabled)
    const { result } = await setup()
    act(() => result.current.updateLocalTeamMember(0, 'name', 'Unsaved name'))
    act(() => result.current.addTeamMember())
    act(() => result.current.updateLocalTeamMember(0, 'email', 'draft@example.test'))
    service.getMembers.mockResolvedValue([disabled])
    service.getLicense.mockResolvedValue({ ...license, current: 1, total: 1 })
    await act(async () => result.current.handleSetMemberEnabled(result.current.teamList[1], false))
    expect(service.setMemberEnabled).toHaveBeenCalledWith(siteId, member.id, false)
    expect(service.removeMember).not.toHaveBeenCalled()
    expect(result.current.teamList[0]).toMatchObject({ email: 'draft@example.test' })
    expect(result.current.teamList[0].id).toBeUndefined()
    expect(result.current.teamList[1]).toMatchObject({ name: 'Unsaved name', id: member.id, status: 'active', manually_disabled: true, license_suspended: true })
    expect(result.current.hasMemberChanges(result.current.teamList[1])).toBe(true)
    expect(result.current.license?.current).toBe(1)
  })

  it('reactivates the same membership and leaves its invitation status unchanged', async () => {
    service.getMembers.mockResolvedValue([{ ...member, status: 'pending', license_suspended: true, manually_disabled: true }])
    const { result } = await setup()
    service.setMemberEnabled.mockResolvedValue({ ...member, status: 'pending' })
    service.getMembers.mockResolvedValue([{ ...member, status: 'pending' }])
    await act(async () => result.current.handleSetMemberEnabled(result.current.teamList[0], true))
    expect(result.current.teamList[0]).toMatchObject({ id: member.id, status: 'pending', manually_disabled: false, license_suspended: false })
  })

  it('opens the upgrade modal instead of a generic failure and keeps the switch off', async () => {
    service.getMembers.mockResolvedValue([{ ...member, license_suspended: true, manually_disabled: true }])
    const payload = { kind: 'members' as const, siteId, current: 5, limit: 5, requiredPlan: 'foundry' as const, canUpgrade: true }
    service.setMemberEnabled.mockRejectedValue(new BillingUpgradeRequired(payload))
    const event = jest.fn()
    window.addEventListener(BILLING_LIMIT_EVENT, event)
    try {
      const { result } = await setup()
      await act(async () => result.current.handleSetMemberEnabled(result.current.teamList[0], true))
      expect(event.mock.calls[0][0].detail).toEqual(payload)
      expect(result.current.teamList[0].manually_disabled).toBe(true)
      expect(toast.error).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener(BILLING_LIMIT_EVENT, event)
    }
  })

  it('retains the previous activation state when saving fails', async () => {
    service.setMemberEnabled.mockRejectedValue(new Error('Network error'))
    const { result } = await setup()
    await act(async () => result.current.handleSetMemberEnabled(result.current.teamList[0], false))
    expect(result.current.teamList[0].license_suspended).toBe(false)
    expect(result.current.isUpdatingMember).toBeNull()
    expect(toast.error).toHaveBeenCalledWith('Could not change member activation. Please try again.')
  })

  it('does not duplicate an in-flight change', async () => {
    let finish!: (value: SiteMember) => void
    service.setMemberEnabled.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const { result } = await setup()
    let pending!: Promise<void>
    act(() => { pending = result.current.handleSetMemberEnabled(result.current.teamList[0], false) })
    expect(result.current.isUpdatingMember).toBe(member.id)
    await act(async () => result.current.handleSetMemberEnabled(result.current.teamList[0], false))
    expect(service.setMemberEnabled).toHaveBeenCalledTimes(1)
    await act(async () => { finish(member); await pending })
    expect(result.current.isUpdatingMember).toBeNull()
  })

  it('keeps the confirmed state when refreshing the list fails after saving', async () => {
    const { result } = await setup()
    service.setMemberEnabled.mockResolvedValue({ ...member, manually_disabled: true, license_suspended: true })
    service.getMembers.mockRejectedValue(new Error('Refresh failed'))
    await act(async () => result.current.handleSetMemberEnabled(result.current.teamList[0], false))
    expect(result.current.teamList[0]).toMatchObject({ manually_disabled: true, license_suspended: true })
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('Member updated, but the team list could not be refreshed. Reload to see the latest status.')
  })

  it('does not apply an old-site response after switching sites', async () => {
    const otherSite = '33333333-3333-4333-8333-333333333333'
    let finish!: (value: SiteMember) => void
    service.setMemberEnabled.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const { result, rerender } = renderHook(({ selectedSite }) => useTeamMembers({ active: true, siteId: selectedSite }), {
      wrapper: Wrapper, initialProps: { selectedSite: siteId },
    })
    await waitFor(() => expect(result.current.teamList).toHaveLength(1))
    let pending!: Promise<void>
    act(() => { pending = result.current.handleSetMemberEnabled(result.current.teamList[0], false) })
    service.getMembers.mockResolvedValue([{ ...member, id: 'other-member', site_id: otherSite }])
    service.getLicense.mockResolvedValue({ ...license, siteId: otherSite })
    rerender({ selectedSite: otherSite })
    await waitFor(() => expect(result.current.teamList[0].id).toBe('other-member'))
    await act(async () => { finish({ ...member, manually_disabled: true, license_suspended: true }); await pending })
    expect(result.current.teamList[0]).toMatchObject({ id: 'other-member', manually_disabled: false })
    expect(result.current.license?.siteId).toBe(otherSite)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each(['owner', 'primary owner', 'unauthorized'])('guards %s changes even if called directly', async scenario => {
    if (scenario === 'owner') service.getMembers.mockResolvedValue([{ ...member, role: 'owner' }])
    else if (scenario === 'primary owner') service.getMembers.mockResolvedValue([{ ...member, role: 'admin', is_primary_owner: true }])
    else jest.mocked(useOptionalPermissions).mockReturnValue({ capabilities: { is_owner: false, role: 'collaborator' } } as never)
    const { result } = await setup()
    await act(async () => result.current.handleSetMemberEnabled(result.current.teamList[0], false))
    expect(service.setMemberEnabled).not.toHaveBeenCalled()
  })
})
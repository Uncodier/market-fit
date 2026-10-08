import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { TeamSection } from '@/app/components/settings/TeamSection'
import { useTeamMembers } from '@/app/components/settings/use-team-members'
import type { FormTeamMember } from '@/app/components/settings/team-types'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/components/settings/use-team-members', () => ({ useTeamMembers: jest.fn() }))
jest.mock('@/app/components/settings/TeamMemberCard', () => ({ TeamMemberCard: ({ member, index, onUpdate }: {
  member: FormTeamMember; index: number; onUpdate: (field: string, value: string) => void
}) => <div data-testid="member-card" data-form-index={index}>
  {member.status} status · {member.email}
  <button onClick={() => onUpdate('name', 'Edited')}>Edit {member.email}</button>
</div> }))
const hook = jest.mocked(useTeamMembers)
const siteId = '11111111-1111-4111-8111-111111111111'

describe('team section member license display', () => {
  beforeEach(() => {
    hook.mockReturnValue({
      teamList: [{ id: 'member', email: 'pending@example.test', role: 'view', status: 'pending', license_suspended: true }],
      license: { siteId, plan: 'engine', current: 5, limit: 5, requiredPlan: 'foundry', canUpgrade: true },
      licenseError: false, refreshLicense: jest.fn(), isLoading: false, isSaving: false,
      isResending: null, isSavingMember: null, isUpdatingMember: null, handleSetMemberEnabled: jest.fn(), canEditBlockedScreens: true, canManageTeam: true,
      validation: {} as ReturnType<typeof useTeamMembers>['validation'], addTeamMember: jest.fn(), removeTeamMember: jest.fn(), updateLocalTeamMember: jest.fn(),
      hasMemberChanges: () => false, canSaveMember: () => false, handleSaveMember: jest.fn(), handleSaveTeamMembers: jest.fn(), handleResendInvitation: jest.fn(),
    })
  })

  it('shows owner-inclusive per-site usage and suspension without replacing the original member status', () => {
    render(<TeamSection active siteId={siteId} />)
    expect(screen.getByLabelText('Member license usage')).toHaveTextContent('5 / 5 members')
    expect(screen.getByLabelText('Member license usage')).toHaveTextContent('Includes the owner, active members, and pending invitations.')
    expect(screen.getByText(/License suspended/)).toBeInTheDocument()
    expect(screen.getByText('pending status · pending@example.test')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invite New Member to Team' })).toBeEnabled()
  })

  it('does not show another site capacity or allow an invite before its license is loaded', () => {
    render(<TeamSection active siteId="another-site" />)
    expect(screen.queryByLabelText('Member license usage')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invite New Member to Team' })).toBeDisabled()
  })

  it('distinguishes manual deactivation from automatic license suspension', () => {
    hook.mockReturnValue({ ...hook({ active: true, siteId }), teamList: [{ id: 'member', email: 'member@example.test', role: 'view',
      status: 'active', license_suspended: true, manually_disabled: true }] })
    render(<TeamSection active siteId={siteId} />)
    expect(screen.getByText(/Deactivated · no member license used/)).toBeInTheDocument()
    expect(screen.queryByText(/access resumes when/)).not.toBeInTheDocument()
  })

  it('moves inactive cards to the bottom while keeping form indices and restoring enabled order', () => {
    const state = hook({ active: true, siteId })
    const members: FormTeamMember[] = [
      { id: 'inactive', email: 'inactive@example.test', role: 'view', status: 'active', manually_disabled: true },
      { id: 'owner', email: 'owner@example.test', role: 'admin', originalRole: 'owner', status: 'active' },
      { id: 'active', email: 'active@example.test', role: 'view', status: 'active' },
      { email: 'draft@example.test', role: 'view' },
      { id: 'suspended', email: 'suspended@example.test', role: 'view', status: 'pending', license_suspended: true },
    ]
    hook.mockReturnValue({ ...state, teamList: members })
    const { rerender } = render(<TeamSection active siteId={siteId} />)
    expect(screen.getAllByTestId('member-card').map(card => card.dataset.formIndex)).toEqual(['1', '2', '3', '0', '4'])
    fireEvent.click(screen.getByRole('button', { name: 'Edit inactive@example.test' }))
    expect(state.updateLocalTeamMember).toHaveBeenCalledWith(0, 'name', 'Edited')
    expect(members[0].id).toBe('inactive')

    hook.mockReturnValue({ ...state, teamList: members.map(member => member.id === 'inactive' ? { ...member, manually_disabled: false } : member) })
    rerender(<TeamSection active siteId={siteId} />)
    expect(screen.getAllByTestId('member-card').map(card => card.dataset.formIndex)).toEqual(['0', '1', '2', '3', '4'])
  })
})
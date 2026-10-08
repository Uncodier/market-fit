import React from 'react'
import { render, screen } from '@testing-library/react'
import { TeamSection } from '@/app/components/settings/TeamSection'
import { useTeamMembers } from '@/app/components/settings/use-team-members'
import type { FormTeamMember } from '@/app/components/settings/team-types'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/components/settings/use-team-members', () => ({ useTeamMembers: jest.fn() }))
jest.mock('@/app/components/settings/TeamMemberCard', () => ({ TeamMemberCard: ({ member }: { member: FormTeamMember }) => <div>{member.status} status · {member.email}</div> }))
const hook = jest.mocked(useTeamMembers)
const siteId = '11111111-1111-4111-8111-111111111111'

describe('team section member license display', () => {
  beforeEach(() => {
    hook.mockReturnValue({
      teamList: [{ id: 'member', email: 'pending@example.test', role: 'view', status: 'pending', license_suspended: true }],
      license: { siteId, plan: 'engine', current: 5, limit: 5, requiredPlan: 'foundry', canUpgrade: true },
      licenseError: false, refreshLicense: jest.fn(), isLoading: false, isSaving: false,
      isResending: null, isSavingMember: null, canEditBlockedScreens: true, canManageTeam: true,
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
})
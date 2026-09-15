import { decideInvitationAcceptance } from '@/lib/auth/team-invitation-acceptance'

describe('decideInvitationAcceptance', () => {
  const userId = 'user-1'

  it('activates only pending invitations owned by the email account', () => {
    expect(
      decideInvitationAcceptance({ user_id: null, status: 'pending' }, userId)
    ).toBe('activate')
    expect(
      decideInvitationAcceptance({ user_id: userId, status: 'pending' }, userId)
    ).toBe('activate')
  })

  it('does not reactivate rejected invitations', () => {
    expect(
      decideInvitationAcceptance({ user_id: null, status: 'rejected' }, userId)
    ).toBe('rejected')
  })

  it('recognizes an existing active membership', () => {
    expect(
      decideInvitationAcceptance({ user_id: userId, status: 'active' }, userId)
    ).toBe('already-active')
  })

  it('rejects missing invitations and memberships belonging to another user', () => {
    expect(decideInvitationAcceptance(null, userId)).toBe('missing')
    expect(
      decideInvitationAcceptance({ user_id: 'user-2', status: 'active' }, userId)
    ).toBe('wrong-user')
  })
})

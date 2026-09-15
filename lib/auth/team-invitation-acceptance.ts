export interface InvitationMembership {
  user_id: string | null
  status: 'pending' | 'active' | 'rejected'
}

export type InvitationAcceptanceDecision =
  | 'activate'
  | 'already-active'
  | 'missing'
  | 'rejected'
  | 'wrong-user'

export function decideInvitationAcceptance(
  invitation: InvitationMembership | null,
  userId: string
): InvitationAcceptanceDecision {
  if (!invitation) return 'missing'
  if (invitation.user_id && invitation.user_id !== userId) return 'wrong-user'
  if (invitation.status === 'rejected') return 'rejected'
  if (invitation.user_id === userId && invitation.status === 'active') {
    return 'already-active'
  }
  return 'activate'
}

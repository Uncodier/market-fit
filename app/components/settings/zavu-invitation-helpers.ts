export const PARTNER_LINK_TYPES = new Set(["whatsapp", "messenger"])

const TERMINAL_STATUSES = new Set(["connected", "expired", "cancelled"])

export type InvitationLike = {
  id?: string
  status?: string
  senderId?: string | null
  connectedAccount?: unknown
  failureReason?: string | null
}

export type ConnectionLike = {
  id?: string
  type?: string
  name?: string
  status?: string
  zavu_sender_id?: string
  zavu_invitation_id?: string
  connected_account?: unknown
  metadata?: Record<string, unknown>
}

export function mapInvitationStatus(status: string | undefined): string {
  if (status === "completed") return "connected"
  return status || "pending"
}

export function shouldSyncInvitation(channel: ConnectionLike | undefined): boolean {
  if (!channel?.zavu_invitation_id) return false
  if (!PARTNER_LINK_TYPES.has(channel.type || "")) return false
  if (TERMINAL_STATUSES.has(channel.status || "")) return false
  return true
}

function connectedAccountName(account: unknown): string | undefined {
  if (!account || typeof account !== "object") return undefined
  const name = (account as { name?: unknown }).name
  return typeof name === "string" && name.trim() ? name : undefined
}

export function mapInvitationToConnection(
  invitation: InvitationLike,
  channel: ConnectionLike
): ConnectionLike {
  const status = mapInvitationStatus(invitation.status)
  const accountName = connectedAccountName(invitation.connectedAccount)
  const failureReason = invitation.failureReason || undefined

  return {
    ...channel,
    status,
    zavu_sender_id: invitation.senderId || channel.zavu_sender_id,
    connected_account: invitation.connectedAccount ?? channel.connected_account,
    name: accountName || channel.name,
    metadata: {
      ...(channel.metadata || {}),
      ...(failureReason ? { failure_reason: failureReason } : {}),
    },
  }
}

export function hasConnectionChanged(previous: ConnectionLike, next: ConnectionLike): boolean {
  return (
    previous.status !== next.status ||
    previous.zavu_sender_id !== next.zavu_sender_id ||
    previous.name !== next.name ||
    JSON.stringify(previous.connected_account) !== JSON.stringify(next.connected_account) ||
    previous.metadata?.failure_reason !== next.metadata?.failure_reason
  )
}

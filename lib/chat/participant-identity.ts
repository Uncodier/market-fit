import { conversationChannel } from './conversation-routing'
import { getChannelLabel } from '@/lib/site-channels'

type IdentityConversation = { channel?: unknown; custom_data?: unknown; title?: unknown }
type IdentityLead = { name?: unknown; avatarUrl?: unknown }

export interface ParticipantIdentity {
  name: string
  avatarUrl?: string
  channel: string
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined
}

function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

function participantName(value: unknown): string | undefined {
  const name = text(value)
  return name && !/^(?:visitor|social user|instagram contact|unknown|anonymous)$/i.test(name) &&
    !/^(?:https?:\/\/|urn:)/i.test(name) && !/^\d+$/.test(name) ? name : undefined
}

function participantUsername(value: unknown): string | undefined {
  const username = text(value)?.replace(/^@/, '')
  return username && /^[a-z\d_.]{1,30}$/i.test(username) && !/^(unknown|anonymous)$/i.test(username)
    ? username : undefined
}

function profilePicture(value: unknown): string | undefined {
  const url = text(value)
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? url : undefined
  } catch {
    return undefined
  }
}

/** Display only: never infer a lead, username or participant from publishing-account metadata. */
export function resolveParticipantIdentity(
  conversation: IdentityConversation,
  lead?: IdentityLead | null,
): ParticipantIdentity {
  const custom = metadata(conversation.custom_data)
  const channel = conversationChannel(conversation)
  const participant = channel === 'instagram' && custom.source === 'outstand_dm' ? custom : {}
  const username = participantUsername(participant.participant_username)
  return {
    name: text(lead?.name) || participantName(participant.participant_display_name) ||
      (username ? `@${username}` : undefined) ||
      (channel === 'web' ? 'Visitor' : `${getChannelLabel(channel)} contact`),
    avatarUrl: profilePicture(lead?.avatarUrl) || profilePicture(participant.participant_profile_picture),
    channel,
  }
}

/** Preserve subjects/manual titles; only replace known generic Outstand DM titles. */
export function conversationDisplayTitle(conversation: IdentityConversation, leadName?: string): string {
  const title = text(conversation.title)
  const custom = metadata(conversation.custom_data)
  const participant = resolveParticipantIdentity(conversation, { name: leadName })
  const isOutstandDm = participant.channel === 'instagram' && custom.source === 'outstand_dm'
  if (isOutstandDm && (!title || title === text(custom.outstand_generated_title) || [
    'Untitled Conversation', 'Visitor', 'Chat with Visitor', 'Instagram direct message', 'Instagram contact',
  ].includes(title))) return participant.name
  if (!title || title === 'Untitled Conversation') {
    if (leadName) return `Chat with ${leadName}`
    if (participant.channel !== 'web') return participant.name
  }
  return title || 'Untitled Conversation'
}
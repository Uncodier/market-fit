import { normalizeChannel } from '@/lib/site-channels'

type Metadata = Record<string, unknown> | null | undefined

function normalizedChannel(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const channel = value.trim().toLowerCase()
  if (['call', 'zavu_inbound_voice', 'zavu_outbound_voice'].includes(channel)) return 'voice'
  return normalizeChannel(channel)
}

/** A saved failure can identify the channel, but only current eligibility can block a retry. */
export function getRetryChannelBlockReason(
  metadata: Metadata,
  conversationChannel?: string | null,
  blockReasons?: Readonly<Record<string, string>>,
): string | undefined {
  if (!blockReasons) return undefined
  const saved = normalizedChannel(metadata?.channel)
    ?? (metadata?.voice_mode === 'agent_call' ? 'voice' : undefined)
  const current = normalizedChannel(conversationChannel)
  const reason = (channel: string | undefined) =>
    (channel && Object.hasOwn(blockReasons, channel) ? blockReasons[channel] : undefined)
    ?? (channel === 'whatsapp' && (metadata?.requested_response_format ?? metadata?.response_format) === 'audio'
      ? blockReasons.whatsappAudio : undefined)

  // The retry endpoint resolves the persisted conversation channel at send time.
  // Do not offer a retry if either the saved or the effective route is blocked.
  if (saved || current) return reason(saved) ?? reason(current)
  return metadata?.error_code === 'WHATSAPP_RECIPIENT_UNVERIFIED' ? reason('whatsapp') : undefined
}

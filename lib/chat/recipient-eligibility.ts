import { COMMUNICATION_CHANNELS, getEnabledSiteChannels, normalizeChannel, type SiteChannelSource } from '@/lib/site-channels'
import { getVoiceCallBlock, type VoiceCallLead } from './voice-call-eligibility'

type Lead = VoiceCallLead & { origin?: string | null; email?: string | null; social_networks?: Record<string, unknown> | null }
type Turn = { role: string; metadata?: Record<string, unknown> }
type RecipientContext = {
  lead?: Lead | null
  visitorPhone?: unknown
  conversationData?: unknown
  conversationChannel?: string | null
  messages?: readonly Turn[]
}

const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const present = (v: unknown): v is string => typeof v === 'string' && !!v.trim()
const explicit = (v: unknown) => {
  if (typeof v !== 'string') return undefined
  const number = v.replace(/[ ().-]/g, '').replace(/^whatsapp:/, '')
  return /^\+[1-9]\d{6,14}$/.test(number) ? number : undefined
}
const providerPhone = (v: unknown) => typeof v === 'string' && /^(?:whatsapp:)?\+?[1-9]\d{6,14}$/.test(v)
  ? `+${v.replace(/^whatsapp:/, '').replace(/^\+/, '')}` : undefined

/** UI preflight only. The API remains authoritative and revalidates the saved row on send. */
function whatsAppBlock(ctx: RecipientContext, allowLeadRepair = true) {
  const contacts = [ctx.visitorPhone, record(ctx.conversationData).whatsapp_phone]
  const turns = (ctx.messages ?? []).filter(({ role }) => role === 'user' || role === 'visitor')
  const latest = turns.at(-1)
  const verified = new Set<string>()
  let latestCanBeVerified = false
  for (const turn of turns) {
    const { metadata } = turn
    const d = metadata ?? {}, twilio = record(d.twilio_whatsapp_inbound)
    const legacyHint = d.source === 'whatsapp' && d.status === 'received' && d.origin_message_id == null
      && present(d.whatsapp_message_id) && /^SM[0-9a-f]{32}$/i.test(d.whatsapp_message_id) && providerPhone(d.whatsapp_phone)
    let from: string | undefined
    if (d.source === 'zavu_inbound_message' && d.channel === 'whatsapp' && present(d.connection_id) && present(d.zavu_sender_id)) {
      from = providerPhone(d.zavu_from)
    } else if (present(twilio.sid) && /^SM[0-9a-f]{32}$/i.test(twilio.sid) && twilio.sid === d.origin_message_id
      && present(twilio.account) && /^AC[0-9a-f]{32}$/i.test(twilio.account) && explicit(twilio.to) && present(twilio.received_at)
      && Number.isFinite(Date.parse(twilio.received_at)) && (d.channel == null || d.channel === 'whatsapp')) {
      from = providerPhone(twilio.from)
    }
    if (from) verified.add(from)
    if (turn === latest) {
      latestCanBeVerified = Boolean(legacyHint || (from && d.source === 'zavu_inbound_message' && present(d.origin_message_id)))
    }
    // Legacy numbers can corroborate or contradict a reply, but are not proof.
    contacts.push(d.whatsapp_phone, d.from_number, d.from)
  }
  const deferLead = allowLeadRepair && normalizeChannel(ctx.conversationChannel) === 'whatsapp' && !!ctx.lead?.id && latestCanBeVerified
  const legacyCandidate = deferLead ? providerPhone(latest?.metadata?.whatsapp_phone) : undefined
  const recipient = verified.values().next().value ?? legacyCandidate
    ?? [ctx.lead?.phone, ctx.visitorPhone, record(ctx.conversationData).whatsapp_phone].map(explicit).find(Boolean)
  if (!deferLead) contacts.push(ctx.lead?.phone)
  if (verified.size > 1 || (recipient && contacts.some(v => v != null && v !== ''
    && providerPhone(typeof v === 'string' ? v.replace(/[ ().-]/g, '') : v) !== recipient))) {
    return 'chat.recipient.conflict'
  }
  return recipient ? undefined : 'chat.recipient.whatsappPhone'
}

function socialAddress(channel: string, ctx: RecipientContext) {
  const d = record(ctx.conversationData)
  if (normalizeChannel(ctx.conversationChannel) === channel && channel === 'instagram' && d.source === 'outstand_dm' && present(d.outstand_conversation_id)) return true
  // An external chat ID is not a telephone number. A numeric legacy lead.phone
  // is a Telegram chat ID only when its origin corroborates that interpretation.
  if (ctx.messages?.some(({ role, metadata: m }) => (role === 'user' || role === 'visitor') && m?.source === 'zavu_inbound_message'
    && m.channel === channel && present(m.connection_id) && present(m.zavu_sender_id) && present(m.zavu_from))) return true
  const profiles = ctx.lead?.social_networks ?? {}
  const aliases = channel === 'messenger' ? ['messenger', 'facebook'] : channel === 'x' ? ['x', 'twitter'] : [channel]
  const identity = (v: unknown) => present(v) && /^[\w@.-]{1,128}$/.test(v) && !v.includes('..') && v !== '.'
  return aliases.some(key => {
    const entry = profiles[key], profile = record(entry)
    return identity(entry) || ((!profile.channel || profile.channel === channel) && ['channel_user_id', 'chat_id', 'external_user_id', 'recipient_id', 'user_id', 'username', 'id'].some(k => identity(profile[k])))
  }) || (channel === 'telegram' && ctx.lead?.origin === 'telegram' && /^-?\d+$/.test(ctx.lead.phone ?? ''))
}

export function recipientBlockKey(channel: string, ctx: RecipientContext): string | undefined {
  switch (normalizeChannel(channel)) {
    case 'web': return undefined
    case 'whatsapp': return whatsAppBlock(ctx)
    case 'sms': return explicit(ctx.visitorPhone || ctx.lead?.phone) ? undefined : 'chat.recipient.internationalPhone'
    case 'email': return typeof ctx.lead?.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ctx.lead.email) && ctx.lead.email !== 'no-email@example.com'
      ? undefined : 'chat.recipient.email'
    case 'voice': {
      const block = getVoiceCallBlock(ctx.lead)
      if (block?.code === 'VOICE_LEAD_REQUIRED') return 'chat.input.leadRequired'
      if (block?.code === 'VOICE_DO_NOT_CALL') return ctx.lead?.do_not_call ? 'chat.input.doNotCall' : 'chat.input.callOptOut'
      return !block && explicit(ctx.lead?.phone) ? undefined : 'chat.recipient.internationalPhone'
    }
    default: return socialAddress(normalizeChannel(channel), ctx) ? undefined : 'chat.recipient.channelIdentity'
  }
}

export function chatChannelBlockReasons(site: SiteChannelSource | null | undefined, ctx: RecipientContext): Readonly<Record<string, string>> {
  const enabled = getEnabledSiteChannels(site)
  const reasons: Record<string, string> = {}
  for (const channel of COMMUNICATION_CHANNELS) {
    if (channel === 'web') continue
    const reason = enabled.includes(channel) ? recipientBlockKey(channel, ctx) : 'chat.input.channelUnavailable'
    if (reason) reasons[channel] = reason
  }
  if (!reasons.whatsapp) {
    const strict = whatsAppBlock(ctx, false)
    if (strict) reasons.whatsappAudio = strict
  }
  return reasons
}
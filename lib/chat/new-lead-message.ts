import { z } from 'zod'
import { getChannelRoutingMetadata, getEnabledSiteChannels, type SiteChannelSource, type CommunicationChannel } from '@/lib/site-channels'
import { recipientBlockKey } from './recipient-eligibility'

// Only routes that can start a thread from a saved CRM address, without an inbound reply target.
const outboundChannels = ['email', 'whatsapp', 'sms', 'telegram'] as const satisfies readonly CommunicationChannel[]

const draftFields = {
  channel: z.enum(outboundChannels),
  subject: z.string().trim().min(1).max(200).regex(/^[^\r\n\u0000]+$/).optional(),
  asset_id: z.string().uuid().optional(),
}
const validSubject = (draft: { channel: string; subject?: string }) => draft.channel === 'email' ? !!draft.subject : !draft.subject
export const newLeadMessageSchema = z.object({ lead_id: z.string().uuid(), ...draftFields }).strict().refine(validSubject)
export const newSupplierMessageSchema = z.object({
  ...draftFields, channel: z.enum(['email', 'whatsapp', 'sms']), supplier_id: z.string().uuid(), version: z.number().int().nonnegative(),
}).strict().refine(validSubject)

export type NewLeadMessage = z.infer<typeof newLeadMessageSchema>
export type NewSupplierMessage = z.infer<typeof newSupplierMessageSchema>

export function leadMessageMediaType(channel: string, mime: string) {
  if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mime)) return undefined
  const major = mime.toLowerCase().split('/')[0]
  const type = major === 'image' || major === 'video' || major === 'audio' ? major : 'document'
  // A newly created WhatsApp thread never has an inbound response window.
  return ['email', 'telegram'].includes(channel) ? type : undefined
}

export function isLeadMessageAssetUrl(value: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash &&
      url.origin === new URL(supabaseUrl ?? '').origin &&
      /^\/storage\/v1\/object\/public\/assets\/assets\/[a-z0-9_.-]+$/i.test(url.pathname)
  } catch { return false }
}

export function newLeadMessageChannels(site: SiteChannelSource | null | undefined, lead: Parameters<typeof recipientBlockKey>[1]['lead']) {
  const enabled = getEnabledSiteChannels(site)
  return outboundChannels.filter(channel => enabled.includes(channel) && !recipientBlockKey(channel, { lead }) &&
    ((channel !== 'sms' && channel !== 'telegram') || Boolean(getChannelRoutingMetadata(site, channel)?.sender_id)) &&
    (channel !== 'telegram' || (lead?.origin === 'telegram' && /^-?\d+$/.test(lead.phone ?? ''))))
}
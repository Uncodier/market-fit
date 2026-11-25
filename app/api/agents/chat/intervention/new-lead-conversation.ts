import type { requireSiteAccess } from '@/lib/auth/api-site-access'
import { findSiteSupportAgent } from '@/lib/agents/find-site-support-agent'
import { isLeadMessageAssetUrl, leadMessageMediaType, newLeadMessageChannels, type NewLeadMessage, type NewSupplierMessage } from '@/lib/chat/new-lead-message'
import { getChannelRoutingMetadata } from '@/lib/site-channels'
import { supplierMessageContacts } from '@/app/suppliers/supplier-message-recipient'
import { supplierContactSchema } from '@/app/suppliers/schema'
import { z } from 'zod'

type SiteAccess = Extract<Awaited<ReturnType<typeof requireSiteAccess>>, { userId: string }>

export async function createOutboundConversation(access: SiteAccess, siteId: string, draft: NewLeadMessage | NewSupplierMessage) {
  const { supabase, userId } = access
  const [site, recipient] = await Promise.all([
    supabase.from('sites').select('settings, tracking').eq('id', siteId).maybeSingle(),
    'supplier_id' in draft
      ? supabase.from('suppliers').select('id, name, version, supplier_contacts(id, name, email, phone, role, is_primary)').eq('site_id', siteId).eq('id', draft.supplier_id).maybeSingle()
      : supabase.from('leads').select('id, name, email, phone, origin, social_networks').eq('site_id', siteId).eq('id', draft.lead_id).maybeSingle(),
  ])

  if (site.error || recipient.error) return { status: 503, error: 'Unable to verify the recipient and channel.' } as const
  if (!site.data || !recipient.data) return { status: 404, error: 'Recipient not found in this workspace.' } as const

  let supplierTarget: { supplier_id: string; version: number; contact_id: string; channel: string } | undefined
  if ('supplier_id' in draft) {
    if (recipient.data.version !== draft.version) return { status: 409, error: 'Supplier contacts changed. Reload the supplier before sending.' } as const
    const contacts = z.array(supplierContactSchema.extend({ id: z.string().uuid() })).max(50).safeParse(recipient.data.supplier_contacts)
    const route = contacts.success && supplierMessageContacts(site.data, { ...recipient.data, contacts: contacts.data }).get(draft.channel)
    if (!route || !route.id) return { status: 409, error: 'This channel is not available for the selected supplier.' } as const
    supplierTarget = { supplier_id: recipient.data.id, version: draft.version, contact_id: route.id, channel: draft.channel }
  } else if (!newLeadMessageChannels(site.data, recipient.data).includes(draft.channel)) {
    return { status: 409, error: 'This channel is not available for the selected lead.' } as const
  }

  let media: { message_type: string; media_url: string; mime_type: string } | undefined
  if (draft.asset_id) {
    const { data: asset, error: assetError } = await supabase.from('assets').select('file_path, file_type')
      .eq('site_id', siteId).eq('id', draft.asset_id).eq('is_public', true).maybeSingle()
    if (assetError) return { status: 503, error: 'Unable to verify the attachment.' } as const
    const mime = asset?.file_type
    const url = asset?.file_path
    const type = typeof mime === 'string' ? leadMessageMediaType(draft.channel, mime) : undefined
    if (!type || typeof url !== 'string' || typeof mime !== 'string' || !isLeadMessageAssetUrl(url)) {
      return { status: 409, error: 'This attachment is unavailable for the selected channel.' } as const
    }
    media = { message_type: type, media_url: url, mime_type: mime }
  }

  const { data: agent, error: agentError } = await findSiteSupportAgent(supabase, siteId)
  if (agentError || !agent) return { status: 409, error: 'The workspace needs a Customer Support agent to send messages.' } as const

  const usesConnectedSender = Boolean(getChannelRoutingMetadata(site.data, draft.channel)?.sender_id)
  const { data, error } = await supabase.from('conversations').insert({
    site_id: siteId, user_id: userId, agent_id: agent.id, lead_id: supplierTarget ? null : recipient.data.id,
    title: draft.subject ?? `Chat with ${recipient.data.name}`,
    channel: draft.channel, custom_data: { channel: draft.channel, lead_composer: true,
      ...(supplierTarget ? { supplier_target: supplierTarget } : {}),
      ...(usesConnectedSender || draft.channel === 'sms' ? { channel_delivery: true } : {}) },
    status: 'active', is_archived: false, last_message_at: new Date().toISOString(),
  }).select('id, site_id, agent_id, lead_id, visitor_id, channel, custom_data').single()

  if (error || !data) return { status: 503, error: 'Unable to create the conversation.' } as const
  return { conversation: data, media } as const
}
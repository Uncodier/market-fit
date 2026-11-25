import { isLeadMessageAssetUrl, leadMessageMediaType, newLeadMessageChannels, newLeadMessageSchema } from '@/lib/chat/new-lead-message'
import { getChatAttachments } from '@/lib/chat/attachments'

const leadId = '00000000-0000-4000-8000-000000000006'
const site = { settings: { channels: {
  email: { enabled: true, status: 'connected' },
  whatsapp: { enabled: true, status: 'connected' },
  connections: [
    { type: 'telegram', status: 'connected', zavu_sender_id: 'telegram-sender' },
    { type: 'sms', status: 'connected', zavu_sender_id: 'sms-sender', license_suspended: true },
    { type: 'instagram', status: 'connected', zavu_sender_id: 'instagram-sender' },
  ],
} } }

it('requires both a live workspace channel and a valid saved recipient', () => {
  expect(newLeadMessageChannels(site, { id: leadId, email: 'test@example.test', phone: '+15005550006', social_networks: { instagram: 'handle' } }))
    .toEqual(['email', 'whatsapp'])
  expect(newLeadMessageChannels(site, { id: leadId, email: 'invalid', phone: '5005550006' })).toEqual([])
  expect(newLeadMessageChannels(site, { id: leadId, origin: 'telegram', phone: '12345' })).toEqual(['telegram'])
  expect(newLeadMessageChannels(null, { id: leadId, email: 'test@example.test' })).toEqual([])
})

it('requires a single-line email subject and rejects caller-supplied media URLs', () => {
  const draft = { lead_id: leadId, channel: 'email' }
  expect(newLeadMessageSchema.safeParse(draft).success).toBe(false)
  expect(newLeadMessageSchema.safeParse({ ...draft, subject: 'Hello\nBcc: test@example.test' }).success).toBe(false)
  expect(newLeadMessageSchema.safeParse({ ...draft, subject: 'Hello', media_url: 'https://example.test' }).success).toBe(false)
  expect(newLeadMessageSchema.safeParse({ ...draft, subject: 'Hello' }).success).toBe(true)
})

it('only accepts public files from configured storage and attachments on supported new threads', () => {
  const origin = 'https://storage.example.test'
  const url = `${origin}/storage/v1/object/public/assets/assets/spec.pdf`
  expect(isLeadMessageAssetUrl(url, origin)).toBe(true)
  expect(isLeadMessageAssetUrl(url, 'https://other.example.test')).toBe(false)
  expect(isLeadMessageAssetUrl(`${url}?token=123`, origin)).toBe(false)
  expect(isLeadMessageAssetUrl(url.replace('/public/', '/sign/'), origin)).toBe(false)
  expect(leadMessageMediaType('email', 'application/pdf')).toBe('document')
  expect(leadMessageMediaType('whatsapp', 'image/png')).toBeUndefined()
  expect(getChatAttachments({ dispatch_owner: 'chat_intervention', media_url: url, message_type: 'document', mime_type: 'application/pdf' }))
    .toEqual([expect.objectContaining({ kind: 'document', url })])
})
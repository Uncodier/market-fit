import { chatChannelBlockReasons, recipientBlockKey } from '@/lib/chat/recipient-eligibility'

const phone = '+14155550100'
const lead = { id: 'lead', phone: '4155550100', email: 'person@example.test' }
const inbound = (from: string) => ({ role: 'user', metadata: { source: 'zavu_inbound_message', channel: 'whatsapp',
  connection_id: 'connection', zavu_sender_id: 'sender', zavu_from: from, origin_message_id: 'provider-message' } })
const site = { settings: { channels: { connections: ['whatsapp','sms','voice','email','telegram'].map(type => ({ type, status: 'connected' })) } } }

it('blocks a local-only phone on each phone channel without disabling a valid alternative', () => {
  const reasons = chatChannelBlockReasons(site, { lead })
  expect(reasons).toMatchObject({ whatsapp: 'chat.recipient.whatsappPhone', sms: 'chat.recipient.internationalPhone', voice: 'chat.recipient.internationalPhone' })
  expect(reasons.email).toBeUndefined(); expect(reasons.web).toBeUndefined()
  expect(reasons.messenger).toBe('chat.input.channelUnavailable')
})
it('unblocks as soon as an international phone is supplied, without modifying stored digits', () => {
  for (const channel of ['whatsapp','voice','sms']) expect(recipientBlockKey(channel, { lead: { ...lead, phone: '+1 (415) 555-0100' } })).toBeUndefined()
  for (const number of ['1234', '0014155550100', '+1abc4155550100', '14155550100']) expect(recipientBlockKey('whatsapp', { lead: { ...lead, phone: number } })).toBeTruthy()
})
it('allows verified inbound WhatsApp or a scoped visitor, but rejects conflicting numbers and outbound hints', () => {
  const ctx = { lead: { ...lead, phone: phone.slice(1) }, messages: [inbound(`whatsapp:${phone.slice(1)}`)] }
  expect(recipientBlockKey('whatsapp', ctx)).toBeUndefined(); expect(recipientBlockKey('sms', ctx)).toBeTruthy()
  expect(recipientBlockKey('whatsapp', { visitorPhone: phone })).toBeUndefined()
  expect(recipientBlockKey('whatsapp', { ...ctx, visitorPhone: '+14155550109' })).toBe('chat.recipient.conflict')
  expect(recipientBlockKey('whatsapp', { ...ctx, messages: [{ ...inbound(phone), role: 'team_member' }] })).toBeTruthy()
  expect(recipientBlockKey('whatsapp', { lead: { ...lead, phone: '14155550100' }, messages: [{ role: 'user', metadata: { origin_message_id: 'event', zavu_from: phone } }] })).toBeTruthy()
})
it('recognizes a signed Twilio turn but not a mismatched SID', () => {
  const sid = 'SM' + '0'.repeat(32)
  const metadata = { origin_message_id: sid, twilio_whatsapp_inbound: { sid, account: 'AC'+'1'.repeat(32), from: phone, to: '+14155550101', received_at: '2026-11-01T00:00:00Z' } }
  expect(recipientBlockKey('whatsapp', { messages: [{ role: 'user', metadata }] })).toBeUndefined()
  expect(recipientBlockKey('whatsapp', { messages: [{ role: 'user', metadata: { ...metadata, origin_message_id: 'other' } }] })).toBeTruthy()
})
it.each([inbound(phone), { role: 'user', metadata: { source: 'whatsapp', status: 'received',
  whatsapp_phone: phone, whatsapp_message_id: 'SM' + '1'.repeat(32) } }])(
  'defers a stale lead phone to the API for WhatsApp text only', turn => {
    const ctx = { conversationChannel: 'whatsapp', lead: { ...lead, phone: '+14155550109' }, messages: [turn] }
    const reasons = chatChannelBlockReasons(site, ctx)
    expect(reasons.whatsapp).toBeUndefined()
    expect(reasons.whatsappAudio).toBe('chat.recipient.conflict')
    expect(chatChannelBlockReasons(site, { ...ctx, visitorPhone: '+14155550108' }).whatsapp).toBe('chat.recipient.conflict')
    expect(chatChannelBlockReasons(site, { ...ctx, conversationChannel: 'email' }).whatsapp).toBe('chat.recipient.conflict')
  })
it('checks the actual recipient shape for each other channel', () => {
  for (const email of [undefined, '', 'bad@', 'a b@example.test', 'no-email@example.com']) expect(recipientBlockKey('email', { lead: { email } })).toBe('chat.recipient.email')
  expect(recipientBlockKey('voice', { lead: { ...lead, phone, do_not_call: true } })).toBe('chat.input.doNotCall')
  expect(recipientBlockKey('telegram', { lead })).toBe('chat.recipient.channelIdentity')
  expect(recipientBlockKey('telegram', { lead: { ...lead, origin: 'telegram' } })).toBeUndefined()
  expect(recipientBlockKey('messenger', { lead: { ...lead, social_networks: { facebook: { chat_id: 'recipient' } } } })).toBeUndefined()
  expect(recipientBlockKey('instagram', { lead: { social_networks: { instagram: {} } } })).toBeTruthy()
})
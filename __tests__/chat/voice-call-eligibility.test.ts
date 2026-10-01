import { getVoiceCallBlock } from '@/lib/chat/voice-call-eligibility'

const lead = {
  id: 'lead-1', phone: '+12025550123', do_not_call: false,
  voice_call_consent_status: 'granted', voice_call_consent_at: '2026-01-01T00:00:00Z',
}

it.each([undefined, null, {}])('requires a linked lead: %j', value => {
  expect(getVoiceCallBlock(value)?.code).toBe('VOICE_LEAD_REQUIRED')
})

it.each(['unknown', 'granted', null, undefined, 'GRANTED'])('allows calls without requiring granted consent: %s', status => {
  expect(getVoiceCallBlock({ ...lead, voice_call_consent_status: status, voice_call_consent_at: null })).toBeNull()
})

it.each([null, undefined, '', 'not-a-date'])('does not require a consent timestamp: %s', timestamp => {
  expect(getVoiceCallBlock({ ...lead, voice_call_consent_at: timestamp })).toBeNull()
})

it('allows a valid linked recipient without consent fields', () => {
  expect(getVoiceCallBlock({ id: lead.id, phone: lead.phone })).toBeNull()
})

it.each(['revoked', 'denied'])('blocks explicit opt-outs even without a grant timestamp: %s', status => {
  expect(getVoiceCallBlock({ ...lead, voice_call_consent_status: status, voice_call_consent_at: null }))
    .toMatchObject({ code: 'VOICE_DO_NOT_CALL', status: 403, message: expect.stringContaining('explicitly opted out') })
})

it('prioritizes do-not-call even when consent was previously granted', () => {
  expect(getVoiceCallBlock({ ...lead, do_not_call: true })?.code).toBe('VOICE_DO_NOT_CALL')
})

it.each([null, '', '2025550123', '+0123456789', '+12345', '+1234567890123456'])('rejects invalid international numbers: %s', phone => {
  expect(getVoiceCallBlock({ ...lead, phone })?.code).toBe('VOICE_PHONE_REQUIRED')
})

it.each(['+12025550123', '+1 (202) 555-0123'])('matches API normalization for eligible phones: %s', phone => {
  expect(getVoiceCallBlock({ ...lead, phone })).toBeNull()
})
import { getVoiceCallBlock } from '@/lib/chat/voice-call-eligibility'

const lead = {
  id: 'lead-1', phone: '+12025550123', do_not_call: false,
  voice_call_consent_status: 'granted', voice_call_consent_at: '2026-01-01T00:00:00Z',
}

it.each([undefined, null, {}])('requires a linked lead: %j', value => {
  expect(getVoiceCallBlock(value)?.code).toBe('VOICE_LEAD_REQUIRED')
})

it.each(['unknown', 'revoked', null, undefined, 'GRANTED'])('requires explicit granted consent: %s', status => {
  expect(getVoiceCallBlock({ ...lead, voice_call_consent_status: status })?.code).toBe('VOICE_CONSENT_REQUIRED')
})

it.each([null, undefined, '', 'not-a-date'])('requires a valid consent timestamp: %s', timestamp => {
  expect(getVoiceCallBlock({ ...lead, voice_call_consent_at: timestamp })?.code).toBe('VOICE_CONSENT_REQUIRED')
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
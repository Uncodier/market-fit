import { VOICE_LEAD_REQUIRED } from './conversation-routing'

export type VoiceCallLead = {
  id?: string | null
  phone?: string | null
  do_not_call?: boolean | null
  voice_call_consent_status?: string | null
  voice_call_consent_at?: string | null
}

type VoiceCallBlock = {
  code: 'VOICE_LEAD_REQUIRED' | 'VOICE_DO_NOT_CALL' | 'VOICE_PHONE_REQUIRED'
  message: string
  status: 403 | 409
}

/** Mirror API recipient/opt-out admission; the provider API must still recheck before dialing. */
export function getVoiceCallBlock(lead?: VoiceCallLead | null): VoiceCallBlock | null {
  if (!lead?.id) return { code: 'VOICE_LEAD_REQUIRED', message: VOICE_LEAD_REQUIRED, status: 409 }
  if (lead.do_not_call === true) {
    return {
      code: 'VOICE_DO_NOT_CALL', status: 403,
      message: 'No call started. This lead is on the do-not-call list. Outbound calls are blocked.',
    }
  }
  if (lead.voice_call_consent_status === 'revoked' || lead.voice_call_consent_status === 'denied') {
    return {
      code: 'VOICE_DO_NOT_CALL', status: 403,
      message: 'No call started. This lead has explicitly opted out of outbound calls. Outbound calls are blocked.',
    }
  }
  const phone = typeof lead.phone === 'string' ? lead.phone.replace(/[^\d+]/g, '') : ''
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    return {
      code: 'VOICE_PHONE_REQUIRED', status: 409,
      message: 'No call started. Add a valid international phone number, including the country code, to the linked lead.',
    }
  }
  return null
}
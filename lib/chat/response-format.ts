import { isTemplateRetryBlocked } from './template-delivery'

export type ChatResponseFormat = 'text' | 'audio'

export function supportsAudioResponse(channel: string): boolean {
  return ['whatsapp', 'telegram', 'messenger'].includes(channel)
}

export function isChatResponseFormat(value: unknown): value is ChatResponseFormat {
  return value === 'text' || value === 'audio'
}

export function isAudioRetryBlocked(metadata: Record<string, unknown> | null | undefined): boolean {
  const receipt = metadata?.audio_delivery
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false
  return (receipt as Record<string, unknown>).state !== 'ready'
}

export function isDeliveryRetryBlocked(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata) return false
  // A stale command failure does not release an active or provider-owned delivery.
  return isAudioRetryBlocked(metadata) || isTemplateRetryBlocked(metadata) || metadata.whatsapp_text_delivery != null ||
    Boolean(metadata.comment_delivery_status || metadata.provider_call_id) || metadata.command_status === 'success' ||
    ['sent', 'delivered', 'sending', 'queued', 'running', 'in_progress', 'placement_unknown', 'needs_reconciliation'].includes(String(metadata.status)) ||
    metadata.needs_reconciliation === true ||
    ['placing', 'queued', 'ringing', 'in_progress', 'completed', 'placement_unknown'].includes(String(metadata.call_status))
}

export function requestedResponseFormat(metadata: Record<string, unknown> | null | undefined): unknown {
  return metadata?.requested_response_format ?? metadata?.response_format
}
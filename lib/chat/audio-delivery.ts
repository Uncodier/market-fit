type Metadata = Record<string, unknown> | null | undefined

/** Receipt evidence, not command completion, determines audio delivery. */
export function getAudioDeliveryStatus(metadata: Metadata): {
  labelKey: string
  confirmed: boolean
  failed: boolean
} | undefined {
  const receipt = metadata?.audio_delivery
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return undefined
  const row = receipt as Record<string, unknown>
  const state = row.delivery_status ?? row.state
  if (state === 'read') return { labelKey: 'chat.status.read', confirmed: true, failed: false }
  if (state === 'delivered') return { labelKey: 'chat.status.delivered', confirmed: true, failed: false }
  if (['failed', 'rejected', 'preparation_failed'].includes(String(state)) || metadata?.status === 'failed') {
    return { labelKey: 'chat.status.failed', confirmed: false, failed: true }
  }
  if (['sent', 'accepted', 'queued'].includes(String(state))) {
    return { labelKey: 'chat.status.sent', confirmed: false, failed: false }
  }
  if (['preparing', 'ready', 'dispatching'].includes(String(state))) {
    return { labelKey: 'chat.status.sending', confirmed: false, failed: false }
  }
  return { labelKey: 'chat.status.deliveryUnconfirmed', confirmed: false, failed: false }
}
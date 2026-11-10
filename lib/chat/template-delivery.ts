type Metadata = Record<string, unknown> | null | undefined

export function hasTemplateDelivery(metadata: Metadata): boolean {
  return metadata?.delivery_format === 'template' || metadata?.template_delivery != null
}

function templateReceipt(metadata: Metadata): Record<string, unknown> | undefined {
  const receipt = metadata?.template_delivery
  return receipt && typeof receipt === 'object' && !Array.isArray(receipt)
    ? receipt as Record<string, unknown> : undefined
}

/** The workflow owns all template receipts, including ready and rejected receipts. */
export function isTemplateRetryBlocked(metadata: Metadata): boolean {
  return hasTemplateDelivery(metadata)
}

/** Delivery receipts take precedence over stale command results. Never infer an audio attachment. */
export function getTemplateDeliveryStatus(metadata: Metadata): {
  label: string
  commandStatus: 'pending' | 'success' | 'failed'
} | undefined {
  if (!hasTemplateDelivery(metadata)) return undefined
  const receipt = templateReceipt(metadata)
  const state = receipt?.state
  const deliveryStatus = receipt?.delivery_status

  // A durable delivered/read receipt is stronger than stale failure/command flags.
  // The API owns webhook ordering; the browser must not infer it from command completion.
  if (state === 'read' || deliveryStatus === 'read') {
    return { label: 'Template read', commandStatus: 'success' }
  }
  if (state === 'delivered' || deliveryStatus === 'delivered') {
    return { label: 'Template delivered', commandStatus: 'success' }
  }
  if (state === 'failed' || state === 'rejected' || deliveryStatus === 'failed' || metadata?.status === 'failed') {
    return { label: 'Template delivery failed', commandStatus: 'failed' }
  }
  if (state === 'unknown' || metadata?.status === 'placement_unknown' ||
    metadata?.status === 'needs_reconciliation' || metadata?.needs_reconciliation === true) {
    return { label: 'Template delivery unconfirmed', commandStatus: 'pending' }
  }
  if (deliveryStatus === 'sent') {
    return { label: 'Sent as template', commandStatus: 'success' }
  }
  if (deliveryStatus === 'sending') {
    return { label: 'Sending template', commandStatus: 'pending' }
  }
  // Legacy state:'sent' only recorded provider acceptance. HTTP status:'sent'
  // also remains an acceptance response for wire compatibility, not delivery proof.
  if (state === 'accepted' || state === 'sent') {
    return { label: 'Template accepted', commandStatus: 'pending' }
  }
  if (['creating', 'submitting', 'pending'].includes(String(state))) {
    return { label: 'Pending template approval', commandStatus: 'pending' }
  }
  if (state === 'ready' || state === 'dispatching') {
    return { label: state === 'ready' ? 'Template ready to send' : 'Sending template', commandStatus: 'pending' }
  }
  if (state === undefined && (deliveryStatus === 'queued' || metadata?.status === 'sent' || metadata?.status === 'accepted')) {
    return { label: 'Template accepted', commandStatus: 'pending' }
  }
  return { label: 'Template delivery unconfirmed', commandStatus: 'pending' }
}
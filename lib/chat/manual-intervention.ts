const owner = 'chat_intervention'

/** Delivery can go back to pending; that never turns a dispatched row into a proposal. */
export function isManualIntervention(role: string, metadata?: Record<string, unknown> | null) {
  return role === 'team_member' && (metadata?.dispatch_owner === owner || metadata?.command_status != null)
}

// Same predicate, negated, for PostgREST. Include missing JSON keys explicitly (SQL NULL).
export const PROPOSAL_FILTER = `role.neq.team_member,and(custom_data->>command_status.is.null,or(custom_data->>dispatch_owner.is.null,custom_data->>dispatch_owner.neq.${owner}))`

export const sendingManualMetadata = { dispatch_owner: owner, status: 'sending', command_status: 'pending' } as const

/** Only called after validated HTTP success, never while reconciling a failure. */
export function acceptedManualMetadata(saved?: Record<string, unknown> | null) {
  return {
    ...saved, dispatch_owner: owner,
    command_status: saved?.status === 'failed' ? 'failed' : saved?.command_status ?? 'pending',
    status: !saved?.status || saved.status === 'pending' ? 'accepted' : saved.status,
  }
}

/** Receipts from immediate-dispatch channels can supersede the row's approval status. */
export function manualReceiptLabel(metadata?: Record<string, unknown>) {
  const textReceipt = metadata?.whatsapp_text_delivery as Record<string, unknown> | undefined
  const state = textReceipt?.delivery_status ?? textReceipt?.state ?? metadata?.comment_delivery_status
  if (state === 'read') return 'chat.status.read'
  if (state === 'delivered') return 'chat.status.delivered'
  if (state === 'failed' || state === 'rejected' || (textReceipt && metadata?.status === 'failed')) return 'chat.status.failed'
  if (metadata?.needs_reconciliation || metadata?.status === 'placement_unknown' ||
    metadata?.status === 'needs_reconciliation' || metadata?.call_status === 'placement_unknown') return 'chat.status.deliveryUnconfirmed'
  if (state === 'sent') return 'chat.status.sent'
  if (state === 'accepted') return 'chat.status.deliveryUnconfirmed'
  if (state === 'attempting' || state === 'sending' || state === 'queued') return 'chat.status.sending'
  if (state != null || textReceipt) return 'chat.status.deliveryUnconfirmed'
}

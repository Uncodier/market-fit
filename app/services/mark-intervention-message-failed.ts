import { createClient } from "../../lib/supabase/client"

export class InterventionRequestError extends Error {
  messageId?: string
  savedMessageId?: string
  conversationId?: string
  executionStarted?: false

  constructor(
    message: string,
    extras?: { message_id?: string; saved_message_id?: string; conversation_id?: string; execution_started?: false }
  ) {
    super(message)
    this.name = "InterventionRequestError"
    this.messageId = extras?.message_id
    this.savedMessageId = extras?.saved_message_id
    this.conversationId = extras?.conversation_id
    this.executionStarted = extras?.execution_started
  }
}

export function interventionErrorMessageId(error: unknown): string | undefined {
  if (error instanceof InterventionRequestError) return error.messageId
  return undefined
}

/** A persisted row whose voice placement is unconfirmed, not a failure to replay. */
export function interventionSavedMessageId(error: unknown): string | undefined {
  return error instanceof InterventionRequestError ? error.savedMessageId : undefined
}

/** True only when the API identified a saved row whose delivery never started. */
export function shouldMarkInterventionFailedFromClient(error: unknown): boolean {
  return Boolean(interventionErrorMessageId(error))
}

export type MarkInterventionFailedParams = {
  conversationId: string
  userId: string
  content: string
  errorMessage: string
  userName?: string
  avatarUrl?: string | null
  messageId?: string
}

export type MarkedInterventionMessage = {
  id: string
  created_at: string
  custom_data: Record<string, unknown>
}

function failedCustomData(params: MarkInterventionFailedParams, existing?: Record<string, unknown> | null) {
  return {
    ...(existing || {}),
    user_name: params.userName,
    avatar_url: params.avatarUrl,
    command_status: "failed",
    error_message: params.errorMessage,
  }
}

async function updateMessageCustomData(
  supabase: ReturnType<typeof createClient>,
  id: string,
  customData: Record<string, unknown>,
  params: MarkInterventionFailedParams,
  previousCustomData: Record<string, unknown> | null
): Promise<MarkedInterventionMessage | null> {
  let update = supabase
    .from("messages")
    .update({ custom_data: customData })
    .eq("id", id)
    .eq("conversation_id", params.conversationId)
    .eq("user_id", params.userId)
    .eq("role", "team_member")
  // A webhook/worker may advance the row between the read and this write.
  update = previousCustomData === null
    ? update.is('custom_data', null)
    : update.eq('custom_data', JSON.stringify(previousCustomData))
  const { data, error } = await update
    .select("id, created_at, custom_data")
    .single()

  if (error || !data) {
    console.error("Failed to update intervention message status:", error)
    return null
  }

  return data as MarkedInterventionMessage
}

export async function markInterventionMessageFailed(
  params: MarkInterventionFailedParams
): Promise<MarkedInterventionMessage | null> {
  if (!params.messageId) return null
  const supabase = createClient()

  if (params.messageId) {
    const { data: existing, error } = await supabase
      .from("messages")
      .select("id, created_at, custom_data")
      .eq("id", params.messageId)
      .eq("conversation_id", params.conversationId)
      .eq("user_id", params.userId)
      .eq("role", "team_member")
      .single()

    if (!error && existing?.id) {
      const state = existing.custom_data as Record<string, unknown> | null
      // A saved failure is authoritative too. Do not replace its diagnostic with
      // the proxy's generic delivery error or overwrite server-owned metadata.
      if ((state?.command_status === 'failed' || state?.status === 'failed' || state?.call_status === 'failed') &&
        typeof state.error_message === 'string' && state.error_message.trim()) {
        return existing as MarkedInterventionMessage
      }
      // The call/webhook may have advanced while the HTTP error was in flight.
      if (state?.provider_call_id || state?.status === 'placement_unknown' ||
        state?.call_status === 'placement_unknown' || state?.status === 'sent' ||
        state?.status === 'delivered' || state?.command_status === 'success' ||
        state?.workflow_id || state?.workflowId ||
        ['sending', 'queued', 'running', 'in_progress'].includes(String(state?.status))) {
        return existing as MarkedInterventionMessage
      }
      return updateMessageCustomData(
        supabase,
        existing.id,
        failedCustomData(params, existing.custom_data as Record<string, unknown> | null),
        params,
        existing.custom_data as Record<string, unknown> | null
      )
    }
    // A returned API ID is authoritative. Never mutate a different same-text
    // message or fabricate a replacement if that row cannot be read.
    return null
  }

  return null
}

export async function clearInterventionMessageFailedStatus(messageId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: existing, error } = await supabase
    .from("messages")
    .select("custom_data")
    .eq("id", messageId)
    .single()

  if (error || !existing) {
    console.error("Failed to load intervention message before retry:", error)
    return false
  }

  const customData = { ...((existing.custom_data as Record<string, unknown>) || {}) }
  delete customData.command_status
  delete customData.error_message

  const { error: updateError } = await supabase
    .from("messages")
    .update({ custom_data: customData })
    .eq("id", messageId)

  if (updateError) {
    console.error("Failed to clear intervention failed status:", updateError)
    return false
  }

  return true
}

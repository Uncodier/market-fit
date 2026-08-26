import { createClient } from "../../lib/supabase/client"

export const INTERVENTION_FAILED_LOOKBACK_MS = 10 * 60 * 1000

export class InterventionRequestError extends Error {
  messageId?: string
  conversationId?: string

  constructor(
    message: string,
    extras?: { message_id?: string; conversation_id?: string }
  ) {
    super(message)
    this.name = "InterventionRequestError"
    this.messageId = extras?.message_id
    this.conversationId = extras?.conversation_id
  }
}

export function interventionErrorMessageId(error: unknown): string | undefined {
  if (error instanceof InterventionRequestError) return error.messageId
  return undefined
}

/** True only when the API responded that Temporal never started (has message_id). */
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
  customData: Record<string, unknown>
): Promise<MarkedInterventionMessage | null> {
  const { data, error } = await supabase
    .from("messages")
    .update({ custom_data: customData })
    .eq("id", id)
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
  const supabase = createClient()

  if (params.messageId) {
    const { data: existing, error } = await supabase
      .from("messages")
      .select("id, created_at, custom_data")
      .eq("id", params.messageId)
      .single()

    if (!error && existing?.id) {
      return updateMessageCustomData(
        supabase,
        existing.id,
        failedCustomData(params, existing.custom_data as Record<string, unknown> | null)
      )
    }
  }

  const since = new Date(Date.now() - INTERVENTION_FAILED_LOOKBACK_MS).toISOString()
  const { data: matches, error: lookupError } = await supabase
    .from("messages")
    .select("id, created_at, custom_data")
    .eq("conversation_id", params.conversationId)
    .eq("user_id", params.userId)
    .eq("role", "team_member")
    .eq("content", params.content)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)

  if (lookupError) {
    console.error("Failed to look up intervention message for failed status:", lookupError)
  }

  const existing = Array.isArray(matches) ? matches[0] : matches
  if (existing?.id) {
    return updateMessageCustomData(
      supabase,
      existing.id,
      failedCustomData(params, existing.custom_data as Record<string, unknown> | null)
    )
  }

  const { data: inserted, error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      role: "team_member",
      user_id: params.userId,
      content: params.content,
      custom_data: failedCustomData(params),
    })
    .select("id, created_at, custom_data")
    .single()

  if (insertError || !inserted) {
    console.error("Failed to persist failed intervention message:", insertError)
    return null
  }

  return inserted as MarkedInterventionMessage
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

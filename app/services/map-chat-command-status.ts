export type ChatCommandStatus = "failed" | "pending" | "success"

export function mapChatCommandStatus(
  customData: Record<string, unknown> | null | undefined
): ChatCommandStatus | undefined {
  if (!customData || typeof customData !== "object") return undefined

  if (customData.voice_mode === 'agent_call') {
    // Provider state is authoritative for voice, including rows written before
    // the API synchronized command_status and ambiguous Temporal activity results.
    const callStatus = customData.call_status ?? customData.status
    if (callStatus === 'placement_unknown') return 'pending'
    if (callStatus === 'completed') return 'success'
    if (['failed', 'busy', 'no_answer', 'canceled', 'cancelled'].includes(String(callStatus))) return 'failed'
  }

  const commandStatus = customData.command_status
  if (commandStatus === "failed" || commandStatus === "pending" || commandStatus === "success") {
    return commandStatus
  }

  if (customData.status === "failed") return "failed"
  return undefined
}

export function withMappedCommandStatus(
  customData: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  if (!customData || typeof customData !== "object") return undefined

  const command_status = mapChatCommandStatus(customData)
  if (!command_status) return { ...customData }
  return { ...customData, command_status }
}

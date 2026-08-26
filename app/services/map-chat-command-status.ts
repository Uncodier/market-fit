export type ChatCommandStatus = "failed" | "pending" | "success"

export function mapChatCommandStatus(
  customData: Record<string, unknown> | null | undefined
): ChatCommandStatus | undefined {
  if (!customData || typeof customData !== "object") return undefined

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

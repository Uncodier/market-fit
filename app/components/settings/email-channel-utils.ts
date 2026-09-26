interface EmailReceivingResponse {
  emailReceivingEnabled?: boolean
  sender?: {
    emailReceivingEnabled?: boolean
    channels?: unknown
  }
  channels?: unknown
}

export function resolveEmailReceivingEnabled(
  responseData: unknown
): boolean | undefined {
  if (!responseData || typeof responseData !== "object") {
    return undefined
  }

  const response = responseData as EmailReceivingResponse
  const returnedValue =
    response.sender?.emailReceivingEnabled ??
    response.emailReceivingEnabled

  return typeof returnedValue === "boolean" ? returnedValue : undefined
}

export function isEmailChannelActive(responseData: unknown): boolean {
  if (!responseData || typeof responseData !== "object") {
    return false
  }

  const response = responseData as EmailReceivingResponse
  const channels = response.sender?.channels ?? response.channels

  return Array.isArray(channels) && channels.includes("email")
}

interface EmailReceivingResponse {
  emailReceivingEnabled?: boolean
  sender?: {
    emailReceivingEnabled?: boolean
    channels?: unknown
  }
  channels?: unknown
}

export function resolveEmailReceivingEnabled(
  responseData: unknown,
  requestedValue: boolean
): boolean {
  if (!responseData || typeof responseData !== "object") {
    return requestedValue
  }

  const response = responseData as EmailReceivingResponse
  const returnedValue =
    response.sender?.emailReceivingEnabled ??
    response.emailReceivingEnabled

  return typeof returnedValue === "boolean" ? returnedValue : requestedValue
}

export function isEmailChannelActive(responseData: unknown): boolean {
  if (!responseData || typeof responseData !== "object") {
    return false
  }

  const response = responseData as EmailReceivingResponse
  const channels = response.sender?.channels ?? response.channels

  return Array.isArray(channels) && channels.includes("email")
}

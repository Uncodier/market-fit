import { timingSafeEqual } from "node:crypto"

/**
 * Validates server-to-server API keys configured outside source control.
 */
export function isValidApiKey(apiKey: string | null | undefined): boolean {
  if (!apiKey) return false

  const configuredKeys = [
    process.env.API_KEY,
    ...(process.env.API_KEYS || "").split(","),
  ]
    .map((key) => key?.trim())
    .filter((key): key is string => Boolean(key))

  return configuredKeys.some((configuredKey) => {
    const provided = Buffer.from(apiKey)
    const expected = Buffer.from(configuredKey)
    return (
      provided.length === expected.length &&
      timingSafeEqual(provided, expected)
    )
  })
}

/**
 * Reads API keys only from headers so credentials never enter URLs or logs.
 */
export function getApiKeyFromRequest(
  headers: Headers
): string | null {
  const authHeader = headers.get("Authorization")
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7).trim() || null
  }

  return headers.get("X-API-Key")?.trim() || null
}

export const INVALID_API_KEY_RESPONSE = {
  error: "Invalid API key",
  status: 401,
  message: "Provide a valid API key via the Authorization or X-API-Key header",
}
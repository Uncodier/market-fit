/** Public, allowlisted feedback only. Never render upstream/provider error text. */
export const openRouterFeedback = {
  api_unavailable: "The integration API could not be reached. This is a service connection problem, not a site-role denial. Check that the API server is running, then reload.",
  api_not_configured: "The integration API is not configured. Contact your administrator or check the API server configuration.",
  invalid_response: "The integration API returned an unexpected response. Reload or check that the web and API versions match.",
} as const

export function openRouterFailureMessage(status: number, code?: string | null): string {
  if (status === 502 && code === "api_unavailable") return openRouterFeedback.api_unavailable
  if (status === 503 && code === "api_not_configured") return openRouterFeedback.api_not_configured
  if (status === 502 && code === "invalid_response") return openRouterFeedback.invalid_response
  const messages: Record<number, string> = {
    401: "Your session could not be verified. Please sign in again.",
    403: "Access to OpenRouter settings was denied for this site. An owner or administrator must have an active session with site access.",
    404: "The integration API endpoint is unavailable. Check that the updated API server is running.",
    409: "Configuration changed or activation is not available. Reload before trying again.",
    422: "This model configuration is not available.",
    429: "Too many requests. Please try again later.",
    502: "The integration API request failed. Reload its status before retrying a change.",
    503: "The integration service is temporarily unavailable. Please try again later.",
  }
  return messages[status] || "Request could not be confirmed. Reload before trying again."
}
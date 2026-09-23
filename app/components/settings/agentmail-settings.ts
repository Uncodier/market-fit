export const AGENTMAIL_API_KEY_SECRET = {
  provider: "agentmail",
  useCase: "integrations",
  name: "AgentMail API Key (BYOK)",
} as const

export const AGENTMAIL_WEBHOOK_SECRET = {
  provider: "agentmail",
  useCase: "webhook",
  name: "AgentMail Webhook Signing Secret",
} as const

export const AGENTMAIL_MESSAGE_RECEIVED_WEBHOOK_PATH =
  "/api/integrations/agentmail/webhook/message-received"

export function buildAgentMailWebhookUrl(apiServerUrl?: string): string {
  const baseUrl = apiServerUrl?.trim().replace(/\/+$/, "")
  if (!baseUrl) return ""

  return `${baseUrl}${AGENTMAIL_MESSAGE_RECEIVED_WEBHOOK_PATH}`
}

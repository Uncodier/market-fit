import { apiClient } from "@/app/services/api-client-service"

export async function deleteAgentMailInbox(inboxId: string): Promise<void> {
  const response = await apiClient.delete(
    `/api/integrations/agentmail/inboxes/${encodeURIComponent(inboxId)}`,
  )

  if (!response.success && response.status !== 404) {
    throw new Error(response.error?.message || "Failed to delete inbox")
  }
}

import { apiClient } from "@/app/services/api-client-service"

export async function requestVoiceAgentResync(siteId: string): Promise<void> {
  try {
    const response = await apiClient.patch("/api/integrations/zavu/voice", { siteId })
    if (!response.success) {
      console.error(
        "Voice agent background synchronization failed:",
        response.error?.message || "Unknown error"
      )
    }
  } catch (error) {
    console.error("Voice agent background synchronization failed:", error)
  }
}

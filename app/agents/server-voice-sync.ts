import "server-only"
import { createClient } from "@/lib/supabase/server"

export async function requestServerVoiceAgentResync(siteId: string): Promise<void> {
  const baseUrl =
    process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_SERVER_URL
  if (!baseUrl) return

  try {
    const normalizedBaseUrl = /^https?:\/\//i.test(baseUrl)
      ? baseUrl
      : `${baseUrl.startsWith("localhost") ? "http" : "https"}://${baseUrl}`
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const response = await fetch(
      new URL("/api/integrations/zavu/voice", normalizedBaseUrl),
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ siteId }),
        cache: "no-store",
      }
    )
    if (!response.ok) {
      console.error(
        `Voice agent background synchronization failed with status ${response.status}`
      )
    }
  } catch (error) {
    console.error("Voice agent background synchronization failed:", error)
  }
}

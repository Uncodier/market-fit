import { createClient } from "@/lib/supabase/client"
import { apiClient, isDemoModeActive } from "@/app/services/api-client-service"

export interface ImprentaExecutionResponse {
  success: boolean
  data?: unknown
  status?: number
  error?: {
    message: string
    details?: unknown
  }
}

export async function executeImprentaNode(
  payload: Record<string, unknown>,
): Promise<ImprentaExecutionResponse> {
  try {
    if (await isDemoModeActive()) {
      return apiClient.post("/api/robots/instance/assistant", payload)
    }

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    }
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }

    const response = await fetch("/api/robots/instance/assistant", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    })
    const contentType = response.headers.get("content-type") ?? ""

    if (response.ok && contentType.includes("text/event-stream")) {
      const reader = response.body?.getReader()
      if (reader) {
        void (async () => {
          try {
            while (!(await reader.read()).done) {
              // Keep the workflow stream connected until durable logs are written.
            }
          } catch {
            // Realtime node updates remain the source of truth for rendering.
          } finally {
            reader.releaseLock()
          }
        })()
      }
      return { success: true, data: { streaming: true }, status: response.status }
    }

    const text = await response.text()
    let parsed: any
    try {
      parsed = text ? JSON.parse(text) : {}
    } catch {
      parsed = { message: text || response.statusText }
    }

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error: {
          message: parsed?.error?.message ?? parsed?.error ?? parsed?.message ?? "Execution failed",
          details: parsed,
        },
      }
    }
    return { success: true, data: parsed, status: response.status }
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to execute node",
        details: error,
      },
    }
  }
}

import { createClient } from "@/lib/supabase/client"
import type { InstanceLog } from "../types"

function apiBaseUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_API_SERVER_URL?.trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, "")
  const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$)/i.test(value)
  return `${local ? "http" : "https"}://${value.replace(/\/+$/, "")}`
}

export async function fetchLiveInstanceLogs(
  instanceId: string,
): Promise<InstanceLog[]> {
  const baseUrl = apiBaseUrl()
  if (!baseUrl) return []

  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) return []

  const response = await fetch(
    `${baseUrl}/api/instances/${encodeURIComponent(instanceId)}/logs?live_only=true`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    },
  )
  if (!response.ok) {
    throw new Error(`Live log request failed with status ${response.status}`)
  }
  const payload = await response.json() as { logs?: InstanceLog[] }
  return Array.isArray(payload.logs) ? payload.logs : []
}

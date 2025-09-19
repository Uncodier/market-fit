import { createClient } from "@/lib/supabase/client"
import type { Agent } from "@/app/types/agents"

// Client-safe version of checkApiServerAvailability
const API_SERVER_URL = process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || ''

function getFullApiUrl(baseUrl: string) {
  if (!baseUrl) return ''
  let apiUrl = baseUrl
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    const url = new URL(baseUrl)
    const protocol = url.protocol
    const port = url.port
    if (typeof window !== 'undefined' && url.hostname === 'localhost') {
      const origin = window.location.origin
      const originUrl = new URL(origin)
      if (originUrl.hostname !== 'localhost' && /^\d+\.\d+\.\d+\.\d+$/.test(originUrl.hostname)) {
        apiUrl = `${protocol}//${originUrl.hostname}:${port}`
      }
    }
    return apiUrl
  }
  return `http://${baseUrl}`
}

const FULL_API_SERVER_URL = getFullApiUrl(API_SERVER_URL)

export async function checkApiServerAvailability(): Promise<boolean> {
  try {
    const API_URL = `${FULL_API_SERVER_URL}/`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort('Request timeout after 3 seconds'), 3000)
    try {
      await fetch(API_URL, { method: 'GET', mode: 'no-cors', signal: controller.signal })
      clearTimeout(timeoutId)
      return true
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('Request timeout'))) {
        return false
      }
      return false
    }
  } catch {
    return false
  }
}

export async function getAgentForConversation(agentId: string): Promise<Agent | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single()

  if (error) return null

  return {
    id: data.id,
    name: data.name,
    description: data.description || "",
    type: data.type,
    status: data.status,
    conversations: data.conversations,
    successRate: data.success_rate,
    lastActive: data.last_active || new Date().toISOString(),
    icon: data.icon || 'User',
    role: data.role || undefined,
    tools: data.tools || {},
    activities: data.activities || {},
    integrations: data.integrations || {},
    supervisor: data.supervisor || undefined
  }
}





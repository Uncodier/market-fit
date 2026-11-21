import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getCachedAgents, invalidateAgentsCache, setCachedAgents } from "../agents-cache"
import { buildAgentList, type AgentListRow, type ListedAgent } from "./agent-list-model"

// Do not select tools, prompts or provider configuration for the directory;
// only the instance origin is needed to distinguish setup cards.
const columns = "id,name,description,type,status,conversations,success_rate,last_active,role,supervisor,agentOrigin:configuration->>agentOrigin"
const pageSize = 250

export function useAgentList(siteId?: string, userId?: string) {
  const scope = siteId && userId ? `${siteId}:${userId}` : undefined
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ scope?: string; agents: ListedAgent[]; error?: boolean } | null>(null)
  useEffect(() => {
    if (!scope || !siteId) return
    let active = true
    const load = async () => {
      const client = createClient()
      const rows: AgentListRow[] = []
      const seen = new Set<string>()
      let total: number | null = null
      for (let page = 0; active && page < 100; page++) {
        const { data, error, count } = await client.from("agents").select(columns, { count: 'exact' }).eq("site_id", siteId)
          .order("created_at").order("id").range(rows.length, rows.length + pageSize - 1)
        if (error || !Array.isArray(data) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || (total !== null && total !== count)) break
        total = count
        for (const agent of data as AgentListRow[]) {
          if (!agent.id || seen.has(agent.id)) throw new Error('Inconsistent agent list')
          seen.add(agent.id); rows.push(agent)
        }
        if (rows.length === count) {
          if (!active) return
          const agents = buildAgentList(rows)
          setCachedAgents(agents, scope)
          setResult({ scope, agents })
          return
        }
        if (!data.length || rows.length > count) break
      }
      if (active) throw new Error('Incomplete agent list')
    }
    void load().catch(() => {
      if (!active) return
      invalidateAgentsCache()
      setResult({ scope, agents: [], error: true })
    })
    return () => { active = false }
  }, [scope, siteId, revision])

  const current = result?.scope === scope ? result : null
  const agents = current?.agents ?? getCachedAgents<ListedAgent>(scope)
  return {
    agents: agents || [], isLoading: !agents, error: current?.error,
    reload: () => { setResult(null); setRevision(value => value + 1) },
  }
}
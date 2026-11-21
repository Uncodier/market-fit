"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useWatch } from "react-hook-form"
import { z } from "zod"
import type { SiteFormValues } from "./form-schema"

const agentId = z.string().uuid()
const assignment = z.object({ connectionId: z.string(), agentId: agentId.nullable(), revision: z.number().int().nonnegative() })
const directory = z.object({
  agents: z.array(z.object({ id: agentId, name: z.string(), role: z.string().nullable(), status: z.string() })),
  connections: z.array(z.object({ id: z.string(), type: z.string(), label: z.string(), account: z.string(),
    status: z.enum(["active", "inactive", "pending", "unknown"]) })).optional(),
  assignments: z.array(assignment), defaultAgentId: agentId.nullable(), voiceDefaultAgentId: agentId.nullable(),
  voiceAgentIdsByConnection: z.record(agentId.nullable()), connectionIds: z.array(z.string()),
  canManage: z.boolean(), assignmentsAvailable: z.boolean().optional(),
})
type Directory = z.infer<typeof directory>
// Only transports with an inbound message branch use the legacy text responder.
// The site can store other transport keys before their runtime is implemented.
const messageTransports = new Set(['email', 'whatsapp', 'telegram', 'messenger', 'facebook',
  'instagram', 'threads', 'linkedin', 'x', 'twitter', 'youtube'])
export function servingChannelAgentId(data: Directory | null, id?: string, type?: string) {
  if (!data || !type) return null
  if (type === 'voice') return data.voiceAgentIdsByConnection[id || ''] ?? null
  return (type === 'website' && id === 'website') || messageTransports.has(type) ? data.defaultAgentId : null
}
type Assignment = z.infer<typeof assignment>
type Context = {
  data: Directory | null
  failed: boolean
  reload: () => Promise<Directory | null>
  save: (change: { connectionId: string; agentId: string | null; expectedRevision: number }) => Promise<"saved" | "conflict" | "error">
}
const AssignmentContext = createContext<Context | null>(null)
export const useChannelAgentAssignments = () => useContext(AssignmentContext)

export function SettingsChannelAgentAssignmentsProvider({ siteId, children }: { siteId?: string; children: ReactNode }) {
  const connections = useWatch<SiteFormValues, "channels.connections">({ name: "channels.connections" })
  const inventory = JSON.stringify(connections?.map(c => [c.id, c.type, c.status, c.zavu_sender_id, c.metadata?.zavu_agent_id]))
  return <ChannelAgentAssignmentsProvider siteId={siteId} inventory={inventory}>{children}</ChannelAgentAssignmentsProvider>
}

export function ChannelAgentAssignmentsProvider({ siteId, children, inventory }: { siteId?: string; children: ReactNode; inventory?: string }) {
  // Discard the previous site's directory and any open dialog before rendering new rows.
  return <SiteChannelAgents key={siteId || ""} siteId={siteId} inventory={inventory}>{children}</SiteChannelAgents>
}

function SiteChannelAgents({ siteId, children, inventory }: { siteId?: string; children: ReactNode; inventory?: string }) {
  const [data, setData] = useState<Directory | null>(null)
  const latest = useRef<Directory | null>(null)
  const [failed, setFailed] = useState(false)
  const endpoint = siteId ? `/api/agent-channels/${encodeURIComponent(siteId)}/assignments` : null
  const activeRead = useRef<{ controller: AbortController; receipts: Map<string, Assignment> } | null>(null)
  const activeWrite = useRef<AbortController | null>(null)
  const reload = useCallback(async () => {
    if (!endpoint) return null
    activeRead.current?.controller.abort()
    const controller = new AbortController()
    const read = { controller, receipts: new Map<string, Assignment>() }
    activeRead.current = read
    // Only an initial read or a retry without a directory needs placeholders.
    // Leave a verified directory visible during focus/inventory revalidation.
    setFailed(false)
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal })
      if (!response.ok) throw new Error("Directory unavailable")
      const fresh = directory.parse(await response.json())
      if (activeRead.current !== read) return null
      // A focus read and a save can settle in either order. Retain the higher
      // assignment revision, but always use this read's inventory and permissions.
      if (fresh.assignmentsAvailable !== false && read.receipts.size) {
        const byId = new Map(fresh.assignments.map(a => [a.connectionId, a]))
        for (const [id, receipt] of read.receipts) {
          if (fresh.connectionIds.includes(id) && (byId.get(id)?.revision ?? 0) < receipt.revision) byId.set(id, receipt)
        }
        fresh.assignments = [...byId.values()]
      }
      latest.current = fresh
      setData(fresh); setFailed(false)
      return fresh
    } catch {
      if (activeRead.current === read) { latest.current = null; setData(null); setFailed(true) }
      return null
    } finally { clearTimeout(timeout); if (activeRead.current === read) activeRead.current = null }
  }, [endpoint])
  useEffect(() => {
    let mounted = true
    queueMicrotask(() => { if (mounted) void reload() })
    window.addEventListener("focus", reload)
    return () => {
      mounted = false
      activeRead.current?.controller.abort()
      activeRead.current = null
      window.removeEventListener("focus", reload)
    }
  }, [inventory, reload])
  useEffect(() => () => {
    activeWrite.current?.abort()
    activeWrite.current = null
  }, [])

  const save: Context["save"] = async change => {
    const snapshot = latest.current
    if (!endpoint || activeWrite.current || !snapshot?.canManage || snapshot.assignmentsAvailable === false || !snapshot.connectionIds.includes(change.connectionId)) return "error"
    if (change.agentId && !snapshot.agents.some(a => a.id === change.agentId && a.status === 'active')) return "error"
    if ((snapshot.assignments.find(a => a.connectionId === change.connectionId)?.revision ?? 0) !== change.expectedRevision) return "conflict"
    const controller = new AbortController()
    activeWrite.current = controller
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetch(endpoint, { method: "PATCH", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) })
      if (activeWrite.current !== controller) return "error"
      if (!response.ok) {
        await reload()
        return response.status === 409 ? "conflict" : "error"
      }
      const saved: Assignment = assignment.parse((await response.json()).assignment)
      if (activeWrite.current !== controller) return "error"
      if (saved.connectionId !== change.connectionId || saved.agentId !== change.agentId || saved.revision !== change.expectedRevision + 1) {
        throw new Error("Unexpected assignment receipt")
      }
      const current = latest.current
      if (!current || current.assignmentsAvailable === false || !current.connectionIds.includes(saved.connectionId)) return "error"
      const observed = current.assignments.find(a => a.connectionId === saved.connectionId)
      if (observed && (observed.revision > saved.revision || (observed.revision === saved.revision && observed.agentId !== saved.agentId))) return "conflict"
      activeRead.current?.receipts.set(saved.connectionId, saved)
      latest.current = { ...current, assignments: [...current.assignments.filter(a => a.connectionId !== saved.connectionId), saved] }
      setData(latest.current)
      return "saved"
    } catch {
      // A timeout is not proof that the write failed. Reconcile; never replay it.
      if (activeWrite.current === controller) await reload()
      return "error"
    } finally { clearTimeout(timeout); activeWrite.current = null }
  }
  return <AssignmentContext.Provider value={{ data, failed: failed || !endpoint, reload, save }}>{children}</AssignmentContext.Provider>
}
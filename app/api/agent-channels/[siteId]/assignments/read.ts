import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { isSiteManagerRole } from "@/lib/auth/api-site-access"
import { assignment, AssignmentError, missingAssignmentTable, readError } from "./contract"
import { agentRow, projectInventory } from "./inventory"

const ASSIGNMENTS = "channel_agent_assignments"
const PAGE_SIZE = 200
const MAX_PAGES = 50

// JSON path projection avoids reading an agent's prompt, tools or encrypted
// Voice webhook secret. No configuration JSON (or provider IDs) leaves the API.
const agentColumns = "id,name,role,status,created_at,updated_at,provider_agent:configuration->zavu->agent_id,agent_origin:configuration->>agentOrigin"
const assignmentColumns = "connectionId:connection_id,agentId:agent_id,revision"

async function readPages<T extends { id: string } | { connectionId: string }>(
  client: SupabaseClient, siteId: string, table: string, columns: string,
  order: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, signal: AbortSignal,
) {
  const rows: T[] = []
  const seen = new Set<string>()
  let total: number | null = null
  for (let page = 0; page < MAX_PAGES; ++page) {
    const { data, error, count } = await client.from(table).select(columns, { count: "exact" })
      .eq("site_id", siteId).order(order).range(rows.length, rows.length + PAGE_SIZE - 1).abortSignal(signal)
    if (error) {
      if (page === 0 && table === ASSIGNMENTS && missingAssignmentTable(error)) return null
      throw readError(error)
    }
    if (!Array.isArray(data) || count == null || !Number.isSafeInteger(count) || count < 0 ||
      (total !== null && total !== count)) break
    total = count
    for (const item of data) {
      const row = schema.parse(item)
      const key = "id" in row ? row.id : row.connectionId
      if (seen.has(key)) throw new AssignmentError(503, "Inconsistent channel inventory")
      seen.add(key); rows.push(row)
    }
    if (rows.length === total) return rows
    if (!data.length || rows.length > total) break
  }
  throw new AssignmentError(503, "Incomplete channel inventory")
}

async function readConnections(client: SupabaseClient, siteId: string, signal: AbortSignal) {
  const { data, error } = await client.from("settings").select("connections:channels->connections,websiteChat:channels->website->enable_chat")
    .eq("site_id", siteId).abortSignal(signal).maybeSingle()
  if (error) throw readError(error)
  return { rows: data?.connections ?? [], websiteChat: data?.websiteChat }
}

export async function readAssignments(client: SupabaseClient, siteId: string, role: string, signal: AbortSignal) {
  const [agents, connections, assignments] = await Promise.all([
    readPages(client, siteId, "agents", agentColumns, "id", agentRow, signal),
    readConnections(client, siteId, signal),
    readPages(client, siteId, ASSIGNMENTS, assignmentColumns, "connection_id", assignment, signal),
  ])
  if (!agents) throw new AssignmentError(503, "Agents could not be loaded")
  return {
    ...projectInventory(agents, connections.rows, connections.websiteChat),
    assignments: assignments ?? [],
    canManage: assignments !== null && isSiteManagerRole(role),
    ...(assignments === null ? { assignmentsAvailable: false } : {}),
  }
}
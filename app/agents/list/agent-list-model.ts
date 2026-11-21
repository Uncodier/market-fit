import { AGENT_ROLE_KEY_MAPPING } from "../agent-defaults"
import { INDEPENDENT_AGENT_ORIGIN } from "@/lib/agents/agent-origin"
import { agents as templateCards } from "@/app/data/mock-agents"
import type { Agent } from "@/app/types/agents"
import { indexSupervisors } from "./agent-supervisors"

export interface AgentListRow {
  id: string
  name: string
  role: string | null
  supervisor: string | null
  description: string | null
  type: Agent["type"]
  status: "active" | "inactive" | "training"
  conversations: number | null
  success_rate: number | null
  last_active: string | null
  agentOrigin: string | null
}

export interface ListedAgent extends Agent {
  isDisabled?: boolean
  templateId?: string
  dbData?: Pick<Agent, "id" | "name" | "description" | "type" | "status" | "supervisor" | "conversations" | "successRate" | "lastActive"> & { role: string }
}

function savedCard(row: AgentListRow, supervisor: Agent["supervisor"], slot?: Agent): ListedAgent {
  const dbData = {
    id: row.id, name: row.name, role: row.role || "", supervisor, description: row.description || "", type: row.type,
    status: row.status === "training" ? "learning" as const : row.status,
    conversations: row.conversations ?? 0, successRate: row.success_rate ?? 0, lastActive: row.last_active || "",
  }
  return {
    ...dbData, dbData, templateId: slot?.id, icon: slot?.icon || "User",
    // Legacy workflow shortcuts run site-wide, not with an arbitrary agent's
    // tools. Additional agents must never inherit these from a matching role.
    activities: slot?.activities || [],
  }
}

/** Template slots retain setup routes and legacy activities. They are never reporting lines. */
export function buildAgentList(rows: AgentListRow[]): ListedAgent[] {
  const slots = new Map<string, ListedAgent>()
  const additional: ListedAgent[] = []
  const remainingParents = indexSupervisors(rows)
  for (const row of rows) {
    if (!remainingParents.has(row.id)) continue
    const slot = row.agentOrigin === INDEPENDENT_AGENT_ORIGIN ? undefined : templateCards.find(card => card.name === row.role && !slots.has(card.id))
    const card = savedCard(row, remainingParents.get(row.id), slot)
    remainingParents.delete(row.id)
    if (slot) slots.set(slot.id, card)
    else additional.push(card)
  }
  return [...templateCards.map(slot => slots.get(slot.id) || {
    ...slot, templateId: slot.id, status: "inactive" as const, lastActive: "", conversations: 0, successRate: 0,
  }), ...additional]
}

export function agentDetailHref(agent: ListedAgent): string {
  if (agent.dbData) return `/agents/${agent.dbData.id}`
  const key = Object.keys(AGENT_ROLE_KEY_MAPPING).find(key => AGENT_ROLE_KEY_MAPPING[key] === agent.name)
  return `/agents/${key || encodeURIComponent(agent.id)}`
}

export function matchesAgentSearch(agent: ListedAgent, query: string) {
  const term = query.trim().toLowerCase()
  return [agent.name, agent.description, agent.role].some(field => field?.toLowerCase().includes(term))
}
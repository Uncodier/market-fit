import {
  AGENT_ROLE_KEY_MAPPING,
  DEFAULT_AGENT_TEMPLATES,
  getDefaultActivitiesForRole,
  getDefaultAgentTemplate,
  getDefaultIntegrationsForRole,
  getDefaultToolsForRole,
  getDefaultTriggersForRole,
} from "@/app/agents/agent-defaults"
import type { AgentDbStatus } from "@/app/agents/save-agent"
import { INDEPENDENT_AGENT_ORIGIN } from "@/lib/agents/agent-origin"
import type { AgentActivity } from "@/app/types/agents"

export type EditorFile = { id: string; name: string; path: string }
type NamedItem = { id: string; name: string; description: string }
type SwitchableItem = NamedItem & { enabled: boolean }
type Integration = NamedItem & { connected: boolean }

export type EditorProfile = {
  // Only a matching, RLS-visible database row may supply this identifier.
  persistedId: string | null
  supervisor: string | null
  name: string
  description: string
  status: AgentDbStatus
  type: string
  role: string
  prompt: string
  backstory: string
  tools: SwitchableItem[]
  triggers: SwitchableItem[]
  integrations: Integration[]
  activities: AgentActivity[]
  contextFiles: EditorFile[]
}

export function findTemplate(role: string | null) {
  return DEFAULT_AGENT_TEMPLATES.find((template) => template.role === role ||
    (role && template.role === AGENT_ROLE_KEY_MAPPING[role]))
}

export function createDraft(routeId: string, roleHint: string | null): EditorProfile | null {
  const blank = routeId === "new"
  if (!blank && !findTemplate(routeId)) return null
  const template = getDefaultAgentTemplate(routeId, blank, roleHint)
  return {
    persistedId: null,
    supervisor: null,
    name: template.name,
    description: template.description,
    status: "inactive",
    prompt: template.promptTemplate,
    backstory: template.backstory,
    role: template.role,
    type: template.type,
    tools: blank ? [] : getDefaultToolsForRole(),
    integrations: blank ? [] : getDefaultIntegrationsForRole(),
    triggers: blank ? [] : getDefaultTriggersForRole(),
    activities: blank ? [] : getDefaultActivitiesForRole(template.role),
    contextFiles: [],
  }
}

type StoredProfile = {
  id: string; role: string; name: string; description: string | null; type: string
  supervisor: string | null
  status: AgentDbStatus; prompt: string | null; backstory: string | null
  tools: unknown; integrations: unknown; activities: unknown; configuration: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readItems<T extends NamedItem>(
  value: unknown, fallback: () => T[], decode: (item: NamedItem, data: Record<string, unknown>) => T,
): T[] {
  if (!value || typeof value !== "object") return fallback()
  const items = Object.entries(value).flatMap(([key, data]: [string, unknown]) => {
    if (!isRecord(data)) return []
    const id = Array.isArray(value) && typeof data.id === "string" ? data.id : key
    return [decode({ id, name: typeof data.name === "string" ? data.name : id,
      description: typeof data.description === "string" ? data.description : "" }, data)]
  })
  return items.length ? items : fallback()
}

export function readProfile(row: StoredProfile): EditorProfile {
  const config = isRecord(row.configuration) ? row.configuration : {}
  const independent = config.agentOrigin === INDEPENDENT_AGENT_ORIGIN
  const toggle = (item: NamedItem, data: Record<string, unknown>) => ({ ...item, enabled: !!data.enabled })
  return {
    persistedId: row.id,
    supervisor: row.supervisor,
    name: row.name, description: row.description ?? "", type: row.type, status: row.status,
    role: row.role, prompt: row.prompt ?? "", backstory: row.backstory ?? "",
    tools: readItems(row.tools, () => independent ? [] : getDefaultToolsForRole(), toggle),
    triggers: readItems(config.triggers, () => independent ? [] : getDefaultTriggersForRole(), toggle),
    integrations: readItems<Integration>(row.integrations, () => independent ? [] : getDefaultIntegrationsForRole(),
      (item, data) => ({ ...item, connected: !!data.connected })),
    activities: readItems<AgentActivity>(row.activities, () => independent ? [] : getDefaultActivitiesForRole(),
      (item, { status, enabled }) => ({ ...item, status: status === "available" ||
        status === "deprecated" || status === "in_progress" ? status : enabled ? "available" : "deprecated" })),
    contextFiles: Array.isArray(config.contextFiles) ? config.contextFiles.filter((f): f is EditorFile =>
      isRecord(f) && typeof f.id === "string" && typeof f.name === "string" && typeof f.path === "string") : [],
  }
}
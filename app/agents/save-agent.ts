import { INDEPENDENT_AGENT_ORIGIN, TEMPLATE_AGENT_FILTER } from "@/lib/agents/agent-origin"
import { requestVoiceAgentResync } from "@/app/agents/voice-sync"
import { AGENT_ROLE_KEY_MAPPING, DEFAULT_AGENT_TEMPLATES } from "./agent-defaults"
import { v5 as uuidv5 } from "uuid"
import { checkSupervisor } from "@/lib/agents/check-supervisor"

export const AGENT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isAgentUuid(id: string): boolean {
  return AGENT_UUID_RE.test(id)
}

export type AgentDbType = "sales" | "support" | "marketing"
export type AgentDbStatus = "active" | "inactive" | "training"
export type SavedProfileSection = 'basic' | 'prompt' | 'backstory' | 'activities'

export type AgentUpsertInput = {
  agentId: string
  isNewAgent: boolean
  creationId?: string
  siteId: string
  userId: string
  name: string
  description: string
  type: string
  status: AgentDbStatus
  prompt: string
  backstory: string
  role: string
  tools: Record<string, unknown>
  activities: Record<string, unknown>
  integrations: Record<string, unknown>
  configuration: Record<string, unknown>
  // Omission preserves the current relationship; null explicitly removes it.
  supervisor?: string | null
  supervisorOnly?: boolean
  section?: SavedProfileSection
}

type AgentQueryResult = { data: { id: string; role?: string | null; supervisor?: string | null; agentOrigin?: string | null; configuration?: Record<string, unknown> | null } | null; error: unknown }
type AgentQuery = {
  select(fields: string): AgentQuery
  eq(field: string, value: string): AgentQuery
  or(filter: string): AgentQuery
  maybeSingle(): PromiseLike<AgentQueryResult>
  single(): PromiseLike<AgentQueryResult>
}
export type AgentsClient = {
  from(table: "agents"): {
    select(fields: string): AgentQuery
    update(fields: Record<string, unknown>): AgentQuery
    insert(rows: Record<string, unknown>[]): AgentQuery
  }
}

export function normalizeAgentType(type: string): AgentDbType {
  if (type === "sales" || type === "support" || type === "marketing") return type
  return "marketing"
}

export function buildAgentRow(input: AgentUpsertInput) {
  return {
    name: input.name,
    description: input.description,
    type: normalizeAgentType(input.type),
    status: input.status,
    prompt: input.prompt,
    backstory: input.backstory || null,
    ...(input.supervisor !== undefined && { supervisor: input.supervisor }),
    role: input.role,
    tools: input.tools,
    activities: input.activities,
    integrations: input.integrations,
    configuration: input.configuration,
    site_id: input.siteId,
    user_id: input.userId,
    updated_at: new Date().toISOString(),
  }
}

function throwIfError(error: unknown, editingHierarchy = false): void {
  if (editingHierarchy && error && typeof error === 'object' && 'code' in error) {
    if (error.code === '40001') throw new Error('The hierarchy changed. Review the supervisor and retry.')
    if (error.code === '23514' || error.code === '23503') throw new Error('Invalid supervisor for this agent')
  }
  if (error) throw error
}

function savedSectionFields(input: AgentUpsertInput, updated_at: string) {
  switch (input.section) {
    case 'basic': return { name: input.name, description: input.description, status: input.status, updated_at,
      ...(input.supervisor !== undefined && { supervisor: input.supervisor }) }
    case 'prompt': return { prompt: input.prompt, updated_at }
    case 'backstory': return { backstory: input.backstory || null, updated_at }
    case 'activities': return { activities: input.activities, updated_at }
  }
}

async function syncCustomerSupportVoiceAgent(
  siteId: string,
  role: string
): Promise<void> {
  if (role !== "Customer Support") return
  await requestVoiceAgentResync(siteId)
}

function mergeConfiguration(
  stored: Record<string, unknown> | null | undefined,
  edited: Record<string, unknown>
): Record<string, unknown> {
  const editable = { ...edited }
  delete editable.agentOrigin
  delete editable.creationFingerprint
  return { ...(stored || {}), ...editable }
}

async function createIndependentAgent(input: AgentUpsertInput): Promise<string> {
  if (!input.creationId || !isAgentUuid(input.creationId)) throw new Error("A draft identity is required")
  const { siteId, creationId, name, description, role, prompt, backstory } = input
  const response = await fetch("/api/agents/create", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId, creationId, name, description, role, prompt, backstory, supervisor: input.supervisor }),
  })
  const result = await response.json()
  if (!response.ok || typeof result.id !== "string" || !isAgentUuid(result.id)) {
    throw new Error(result.error || "Agent creation could not be confirmed")
  }
  return result.id
}

/** Persist each mode using its own identity: draft, existing UUID, or legacy setup role. */
export async function upsertAgentRecord(
  supabase: AgentsClient,
  input: AgentUpsertInput
): Promise<string> {
  if (input.supervisor != null && !isAgentUuid(input.supervisor)) throw new Error('Invalid supervisor ID')
  if (input.supervisorOnly && (!isAgentUuid(input.agentId) || input.supervisor === undefined || input.isNewAgent)) throw new Error('Supervisor changes require a saved agent')
  if (input.isNewAgent || input.agentId === "new") return createIndependentAgent(input)
  const row = buildAgentRow(input)
  const { site_id, user_id, ...fields } = row
  const hasUuid = isAgentUuid(input.agentId)
  if (!hasUuid && !(AGENT_ROLE_KEY_MAPPING[input.agentId] === input.role ||
    DEFAULT_AGENT_TEMPLATES.some(t => t.role === input.agentId && t.role === input.role))) {
    throw new Error("Unknown agent template")
  }
  const scopedEdit = hasUuid && input.section !== undefined
  const lookup = supabase.from("agents").select(input.supervisorOnly ? "id" : scopedEdit
    ? 'id, role, agentOrigin:configuration->>agentOrigin' : 'id, role, configuration').eq("site_id", site_id)
  const scopedLookup = hasUuid ? lookup.eq("id", input.agentId) : lookup
    .eq("role", input.role).eq("user_id", user_id).or(TEMPLATE_AGENT_FILTER)
  // An ambiguous legacy role must never result in picking a row to overwrite.
  const { data: existing, error: lookupError } = await scopedLookup.maybeSingle()
  throwIfError(lookupError)
  if ((scopedEdit || input.supervisorOnly) && !existing) throw new Error('Agent unavailable for this site')
  const id = existing?.id ?? (hasUuid ? input.agentId : uuidv5(JSON.stringify([
    "agent-template", input.siteId, input.userId, input.role,
  ]), uuidv5.URL))
  if (input.supervisor) {
    const check = await checkSupervisor(id, input.supervisor, parent => supabase.from('agents').select('id,supervisor')
      .eq('site_id', site_id).eq('id', parent).maybeSingle())
    if (check !== 'valid') throw new Error(check === 'error' ? 'Could not verify the supervisor' : 'Invalid supervisor for this agent')
  }
  if (existing) {
    // Never move agents between sites or reattribute the creator on edit.
    const role = existing.role || row.role
    const payload = input.supervisorOnly ? { supervisor: input.supervisor } : (scopedEdit ? savedSectionFields(input, row.updated_at) : null) ?? {
      ...fields, role, configuration: mergeConfiguration(existing.configuration, row.configuration),
    }
    const { data, error } = await supabase.from("agents").update(payload).eq("id", existing.id).eq("site_id", input.siteId).select("id").single()
    throwIfError(error, input.supervisor !== undefined)
    if (!data?.id) throw new Error("Agent was not saved")
    const origin = scopedEdit ? existing.agentOrigin : existing.configuration?.agentOrigin
    if (!input.supervisorOnly && origin !== INDEPENDENT_AGENT_ORIGIN) await syncCustomerSupportVoiceAgent(input.siteId, role)
    return data.id
  }
  // Keep missing-UUID insert compatibility, but never upsert across a hidden
  // row. Concurrent attempts to set up the same default share a primary key.
  const { data, error } = await supabase.from("agents").insert([{
    ...row, id, configuration: mergeConfiguration(null, row.configuration),
  }]).select("id").single()
  if (!hasUuid && error && typeof error === "object" && "code" in error && error.code === "23505") {
    // A concurrent setup may have won after our lookup. Return only the
    // matching legacy setup identity, never an arbitrary same-role instance.
    const winner = await supabase.from("agents").select("id,supervisor").eq("id", id).eq("site_id", input.siteId)
      .eq("user_id", input.userId).eq("role", input.role).or(TEMPLATE_AGENT_FILTER).maybeSingle()
    throwIfError(winner.error)
    if (winner.data?.id === id && (input.supervisor === undefined || winner.data.supervisor === input.supervisor)) return id
  }
  throwIfError(error, input.supervisor !== undefined)
  if (!data?.id) {
    throw new Error("Agent was not created")
  }
  await syncCustomerSupportVoiceAgent(input.siteId, row.role)
  return data.id
}

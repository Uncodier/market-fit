export const AGENT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isAgentUuid(id: string): boolean {
  return AGENT_UUID_RE.test(id)
}

export type AgentDbType = "sales" | "support" | "marketing"
export type AgentDbStatus = "active" | "inactive" | "training"

export type AgentUpsertInput = {
  agentId: string
  isNewAgent: boolean
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
}

export type AgentsClient = {
  from: (table: string) => any
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

function throwIfError(error: unknown): void {
  if (error) throw error
}

/**
 * Inserts the agent when it does not exist, otherwise updates it.
 * Required columns (name, type, status, prompt) are always sent so a
 * never-created or partially-created agent can still be persisted.
 */
export async function upsertAgentRecord(
  supabase: AgentsClient,
  input: AgentUpsertInput
): Promise<string> {
  const row = buildAgentRow(input)
  const hasUuid = !input.isNewAgent && isAgentUuid(input.agentId)

  if (hasUuid) {
    const { data: existing, error: existingError } = await supabase
      .from("agents")
      .select("id, role")
      .eq("id", input.agentId)
      .maybeSingle()

    throwIfError(existingError)

    const payload = {
      ...row,
      id: input.agentId,
      role: existing?.role || row.role,
    }

    const { data, error } = await supabase
      .from("agents")
      .upsert(payload, { onConflict: "id", ignoreDuplicates: false })
      .select("id")
      .single()

    throwIfError(error)
    return data?.id || input.agentId
  }

  const { data: existingByRole, error: lookupError } = await supabase
    .from("agents")
    .select("id")
    .eq("role", input.role)
    .eq("user_id", input.userId)
    .eq("site_id", input.siteId)
    .maybeSingle()

  throwIfError(lookupError)

  if (existingByRole?.id) {
    const { data, error } = await supabase
      .from("agents")
      .update(row)
      .eq("id", existingByRole.id)
      .select("id")
      .single()

    throwIfError(error)
    return data?.id || existingByRole.id
  }

  const { data, error } = await supabase
    .from("agents")
    .insert(row)
    .select("id")
    .single()

  throwIfError(error)
  if (!data?.id) {
    throw new Error("Agent was not created")
  }
  return data.id
}

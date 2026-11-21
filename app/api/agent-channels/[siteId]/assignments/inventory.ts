import { z } from "zod"
import { AssignmentError, connectionId, uuid } from "./contract"
import { isActiveAgentChannel, isManuallyDisabledAgentChannel } from "@/lib/agent-channel-state"
import { isOutreachChannel } from "@/lib/outreach-settings"
import { getAssignedPhoneNumber, formatPhoneNumber } from "@/app/components/settings/zavu-phone-number-utils"
import { INDEPENDENT_AGENT_ORIGIN } from "@/lib/agents/agent-origin"

// PostgREST returns UTC timestamptz. Keep sub-millisecond precision: multiple
// agents can be created in one millisecond. A tied legacy lookup has no tie-break.
const timestamp = z.string().datetime({ offset: true }).transform(value => {
  const micros = (value.match(/\.(\d+)/)?.[1] ?? "").padEnd(6, "0").slice(3, 6)
  return BigInt(Date.parse(value)) * BigInt(1000) + BigInt(micros)
})

export const agentRow = z.object({
  id: uuid, name: z.string(), role: z.string().nullable(), status: z.string(),
  created_at: timestamp, updated_at: timestamp, provider_agent: z.unknown(), agent_origin: z.unknown(),
})
type Agent = z.infer<typeof agentRow>

const connection = z.object({ id: connectionId, type: z.unknown(), metadata: z.unknown() }).passthrough()
const voiceMetadata = z.object({ zavu_agent_id: z.string().min(1) })

function text(value: unknown) { return typeof value === 'string' ? value.trim().slice(0, 200) : '' }

function displayConnection(row: z.infer<typeof connection>) {
  const type = isOutreachChannel(row.type) ? row.type : 'unknown'
  const meta = z.object({ from_address: z.unknown(), bot_username: z.unknown(), activation_pending: z.unknown(),
    provider_channel_active: z.unknown(), emailChannelActive: z.unknown() }).safeParse(row.metadata).data
  const phone = ['voice', 'sms', 'whatsapp'].includes(type) ? text(getAssignedPhoneNumber(row)) : ''
  const account = phone ? formatPhoneNumber(phone) : type === 'email' ? text(meta?.from_address)
    : type === 'telegram' && text(meta?.bot_username) ? `@${text(meta?.bot_username).replace(/^@/, '')}` : ''
  const awaitingActivation = meta?.activation_pending === true || meta?.provider_channel_active === false || (type === 'email' && meta?.emailChannelActive !== true)
  const status = isActiveAgentChannel(row) ? (awaitingActivation ? 'pending' : 'active') : row.enabled === false || row.license_suspended === true
    || isManuallyDisabledAgentChannel(row) || ['disabled', 'disconnected', 'license_suspended', 'failed', 'expired', 'cancelled'].includes(text(row.status))
    ? 'inactive' : ['pending', 'in_progress', 'not_configured'].includes(text(row.status)) ? 'pending' : 'unknown'
  // Never return connected_account, metadata, credentials, or provider IDs.
  return { id: row.id, type, label: text(row.name), account, status }
}

function latest(agents: Agent[], key: "created_at" | "updated_at") {
  let maximum: bigint | undefined
  let result: string | null = null
  for (const agent of agents) {
    if (maximum === undefined || agent[key] > maximum) {
      maximum = agent[key]; result = agent.id
    } else if (agent[key] === maximum) result = null
  }
  return result
}

export function projectInventory(agents: Agent[], rawConnections: unknown, websiteChat: unknown) {
  if (!Array.isArray(rawConnections)) throw new AssignmentError(503, "Invalid connection inventory")
  const connections = rawConnections.flatMap(row => {
    const parsed = connection.safeParse(row)
    return parsed.success ? [parsed.data] : []
  })
  const counts = new Map<string, number>()
  for (const { id } of connections) counts.set(id, (counts.get(id) ?? 0) + 1)
  if (counts.has("website")) throw new AssignmentError(409, "A connection conflicts with the reserved website identity")

  // A local registration is evidence only for this exact persisted provider ID;
  // it is not evidence of provider readiness, a live call, or successful routing.
  const registrations = new Map<string, string | null>()
  for (const agent of agents) {
    if (typeof agent.provider_agent === "string" && agent.provider_agent.length > 0) {
      registrations.set(agent.provider_agent, registrations.has(agent.provider_agent) ? null : agent.id)
    }
  }
  const connectionIds = ["website"]
  const cards = [{ id: 'website', type: 'website', label: '', account: '',
    status: websiteChat === true ? 'active' : websiteChat === false ? 'inactive' : 'unknown' }]
  const voice: Array<[string, string | null]> = []
  for (const row of connections) {
    if (counts.get(row.id) !== 1) continue
    connectionIds.push(row.id)
    cards.push(displayConnection(row))
    if (row.type !== "voice") continue
    const metadata = voiceMetadata.safeParse(row.metadata)
    voice.push([row.id, metadata.success ? registrations.get(metadata.data.zavu_agent_id) ?? null : null])
  }
  const support = agents.filter(agent => agent.role === "Customer Support" && agent.agent_origin !== INDEPENDENT_AGENT_ORIGIN)
  return {
    agents: agents.map(({ id, name, role, status }) => ({ id, name, role, status })),
    connectionIds,
    connections: cards,
    voiceAgentIdsByConnection: Object.fromEntries(voice),
    defaultAgentId: latest(support.filter(agent => agent.status === "active"), "created_at"),
    // Legacy Voice synchronization candidate, not the connection's recorded agent.
    voiceDefaultAgentId: latest(support, "updated_at"),
  }
}
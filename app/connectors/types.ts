import { z } from "zod"
import { supportPublication } from "./support-publication"

const strings = z.array(z.string())
const accessMode = z.enum(["workspace", "explicit"]).optional()
const toolAccessMode = z.enum(["all", "selected"])
export type ToolAccessMode = z.infer<typeof toolAccessMode>
export const toolkitSchema = z.object({
  slug: z.string(), name: z.string(), description: z.string(), logo: z.string().nullable(),
  domains: strings, skills: strings, tools_count: z.number().nonnegative(),
  auth_schemes: strings, connection_count: z.number().nonnegative(),
})
export const connectorSchema = z.object({
  id: z.string(), toolkit_slug: z.string(), display_name: z.string(),
  provider_status: z.string(), enabled: z.boolean(), revocation_pending: z.boolean(),
  revocation_dispatched: z.boolean().optional(),
  can_verify_supabase_project: z.boolean().optional(),
  revision: z.number().int(), verified_at: z.string().nullable(), can_use: z.boolean(),
  access_mode: accessMode,
})
export const connectionsSchema = z.object({ items: z.array(connectorSchema) })
const integrationCount = z.number().int().nonnegative()
export const connectorDomainCountsSchema = z.object({
  total: integrationCount,
  counts: z.record(z.string().regex(/^[a-z0-9_-]{1,80}$/), integrationCount),
})
export const catalogSchema = z.object({
  items: z.array(toolkitSchema),
  domains: z.array(z.object({ id: z.string(), label: z.string(), skill_slugs: strings })),
  next_cursor: z.string().nullable(), can_manage: z.boolean(), configured: z.boolean(),
  total: z.number().nonnegative().nullable(),
  credential_source: z.enum(["byok", "platform"]).optional(),
  current_page: z.number().int().positive().optional(), total_pages: z.number().int().positive().nullable().optional(),
})
export const detailSchema = z.object({
  toolkit: toolkitSchema, connections: z.array(connectorSchema),
  auth_configs: z.array(z.object({ id: z.string(), name: z.string(), auth_scheme: z.string() })),
  can_create_managed_oauth: z.boolean().optional(),
  can_manage: z.boolean(),
  credential_source: z.enum(["byok", "platform"]).optional(),
})
const memberSchema = z.object({
  user_id: z.string(), can_view: z.boolean(), can_use: z.boolean(), expires_at: z.string().nullable(),
  revoked_at: z.string().nullable().optional(),
})
const agentSchema = z.object({
  agent_id: z.string(), enabled: z.boolean(), expires_at: z.string().nullable(), revoked_at: z.string().nullable().optional(),
})
const optionSchema = z.object({ id: z.string(), label: z.string() })
export const accessSchema = z.object({
  connector_id: z.string(), revision: z.number().int(),
  access_mode: accessMode,
  members: z.array(memberSchema), agents: z.array(agentSchema),
  policy: z.object({ tool_access_mode: toolAccessMode.optional(), allowed_tools: strings, allowed_hosts: strings, require_approval: z.boolean(), support_publication: supportPublication.nullable().optional() }),
  member_options: z.array(optionSchema), agent_options: z.array(optionSchema), can_manage: z.boolean(),
  reviewed_tools: z.array(z.object({ slug: z.string(), description: z.string() })).optional(),
})
export const authAttemptSchema = z.object({ attempt_id: z.string(), redirect_url: z.string().url() })
export type Toolkit = z.infer<typeof toolkitSchema>
export type Connector = z.infer<typeof connectorSchema>

export function isUsableConnector(connector: Connector) {
  return connector.can_use && connector.enabled && !connector.revocation_pending && connector.provider_status === 'ACTIVE'
}
export type Catalog = z.infer<typeof catalogSchema>
export type ConnectorDetail = z.infer<typeof detailSchema>
export type ConnectorAccess = z.infer<typeof accessSchema>
export type MemberGrant = z.infer<typeof memberSchema>
export type AgentGrant = z.infer<typeof agentSchema>
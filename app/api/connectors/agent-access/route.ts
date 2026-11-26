import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import { agentConnectorDirectorySchema, agentGrantIsCurrent, connectorAccountSchema } from "@/app/connectors/agent-access-contract"
import { connectorProxyFailure } from "../proxy"

const uuid = z.string().uuid().transform(value => value.toLowerCase())
const scope = z.object({ site_id: uuid, agent_id: uuid }).strict()
const accountRows = z.array(connectorAccountSchema.extend({
  enabled: z.boolean(), provider_status: z.string(), revocation_pending: z.boolean(),
  grants: z.array(z.object({ enabled: z.boolean(), revoked_at: z.string().nullable(), expires_at: z.string().nullable() })).max(1),
}))
const columns = "id,toolkit_slug,display_name,revision,enabled,provider_status,revocation_pending,grants:connector_agents!connector_agents_connector_id_site_id_fkey(enabled,revoked_at,expires_at)"

export async function GET(request: Request) {
  if (!isSameOriginApiRequest(request)) return connectorProxyFailure(403, "ACCESS_DENIED")
  const query = new URL(request.url).searchParams
  const parsed = scope.safeParse(Object.fromEntries(query))
  if (!parsed.success || [...query].length !== 2) return connectorProxyFailure(400, "INVALID_REQUEST")
  const { site_id: siteId, agent_id: agentId } = parsed.data

  try {
    const supabase = await createClient(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) return connectorProxyFailure(401, "UNAUTHORIZED")
    const permission = await supabase.rpc("connector_site_access", { p_site_id: siteId, p_user_id: user.id })
    if (permission.error) return connectorProxyFailure(503, "STORAGE_UNAVAILABLE")
    const access = Array.isArray(permission.data) ? permission.data[0] : permission.data
    // Agent grant rows are manager-only under connector RLS. Never infer grants from member visibility.
    if (access?.can_view !== true || access?.can_manage !== true) return connectorProxyFailure(403, "ACCESS_DENIED")

    const agent = await supabase.from("agents").select("id,status").eq("site_id", siteId).eq("id", agentId)
      .abortSignal(request.signal).maybeSingle()
    if (agent.error) return connectorProxyFailure(503, "STORAGE_UNAVAILABLE")
    if (!agent.data) return connectorProxyFailure(404, "NOT_FOUND")

    const accounts = await supabase.from("connectors").select(columns, { count: "exact" })
      .eq("site_id", siteId).eq("grants.agent_id", agentId).order("display_name").order("id").abortSignal(request.signal)
    const rows = accountRows.safeParse(accounts.data)
    if (accounts.error || !rows.success || accounts.count !== rows.data.length) return connectorProxyFailure(503, "STORAGE_UNAVAILABLE")

    const directory: z.input<typeof agentConnectorDirectorySchema> = { active: agent.data.status === "active", assigned: [], available: [] }
    const now = Date.now()
    for (const row of rows.data) {
      const { grants: [grant], enabled, provider_status, revocation_pending, ...account } = row
      const available = enabled && provider_status === "ACTIVE" && !revocation_pending
      if (grant && agentGrantIsCurrent(grant, now)) directory.assigned.push({ ...account, available })
      else if (available) directory.available.push(account)
    }
    return Response.json(directory, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return connectorProxyFailure(503, "STORAGE_UNAVAILABLE")
  }
}
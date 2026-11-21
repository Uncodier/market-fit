import { createHash } from "node:crypto"
import { v5 as uuidv5 } from "uuid"
import { z } from "zod"
import { DEFAULT_AGENT_TEMPLATES } from "@/app/agents/agent-defaults"
import { INDEPENDENT_AGENT_ORIGIN } from "@/lib/agents/agent-origin"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { checkSupervisor } from "@/lib/agents/check-supervisor"

const schema = z.object({
  siteId: z.string().uuid(), creationId: z.string().uuid(),
  name: z.string().trim().min(1).max(200), role: z.string().max(100),
  description: z.string().max(8_000), prompt: z.string().max(32_000), backstory: z.string().max(32_000),
  supervisor: z.string().uuid().transform(id => id.toLowerCase()).nullable().optional(),
}).strict()
const headers = { "Cache-Control": "private, no-store" }
const failure = (error: string, status: number) => Response.json({ error }, { status, headers })

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginApiRequest(request)) return failure("Origin not allowed", 403)
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return failure("JSON content type required", 415)
  }
  let input: z.infer<typeof schema>
  try {
    const body = decodeRequestBody(await readLimitedRequestBody(request, 300_000))
    input = schema.parse(JSON.parse(body))
  } catch (error) {
    return failure("Invalid agent details", error instanceof RequestBodyTooLargeError ? 413 : 400)
  }
  const template = DEFAULT_AGENT_TEMPLATES.find(t => t.role === input.role)
  if (!template) return failure("Select a supported agent role", 400)

  const access = await requireSiteAccess(request, input.siteId)
  if (access.error) return access.error
  const { supabase, userId } = access
  if (!await userCanOnSite(supabase, input.siteId, "insert")) return failure("Agent creation is not permitted", 403)

  // Namespace each draft by its authorized tenant and actor. The PK arbitrates
  // concurrent inserts; a retry can recover its exact result but cannot edit it.
  const id = uuidv5(`independent-agent:${userId}:${input.creationId}`, input.siteId)
  const { supervisor, ...draft } = input
  // Keep omitted/null equivalent and preserve existing no-supervisor retry identities.
  const fingerprint = createHash("sha256").update(JSON.stringify(supervisor ? { ...draft, supervisor } : draft)).digest("hex")
  if (supervisor) {
    try {
      const check = await checkSupervisor(id, supervisor, parent => supabase.from('agents').select('id,supervisor')
        .eq('site_id', input.siteId).eq('id', parent).abortSignal(request.signal).maybeSingle())
      if (check === 'error') return failure('Could not verify the supervisor', 503)
      if (check !== 'valid') return failure('Invalid supervisor for this agent', 422)
    } catch {
      return failure('Could not verify the supervisor', 503)
    }
  }
  const { data, error } = await supabase.from("agents").insert({
    id, user_id: userId, site_id: input.siteId, name: input.name, description: input.description,
    role: template.role, type: template.type, prompt: input.prompt, backstory: input.backstory || null,
    supervisor: supervisor ?? null, status: "inactive", tools: {}, activities: {}, integrations: {},
    configuration: { agentOrigin: INDEPENDENT_AGENT_ORIGIN, creationFingerprint: fingerprint },
  }).select("id").single()
  if (!error && data?.id === id) return Response.json({ id }, { status: 201, headers })
  if (error?.code === "23505") {
    const result = await supabase.from("agents").select("id")
      .eq("id", id).eq("site_id", input.siteId).eq("user_id", userId)
      .eq("configuration->>agentOrigin", INDEPENDENT_AGENT_ORIGIN).eq("configuration->>creationFingerprint", fingerprint)
      .maybeSingle()
    if (!result.error && result.data?.id === id) return Response.json({ id }, { headers })
    if (!result.error) return failure("This draft conflicts with an existing agent. Reopen the agent list.", 409)
  }
  if (error?.code === "42501") return failure("Agent creation is not permitted", 403)
  if (supervisor && (error?.code === "23514" || error?.code === "23503")) return failure("Supervisor unavailable or invalid hierarchy", 422)
  if (error?.code === "40001") return failure("The hierarchy changed. Review the supervisor and retry.", 409)
  return failure("Agent creation could not be confirmed. Retry this draft.", 503)
}
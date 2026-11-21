import { NextResponse } from "next/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import { readLocationRestrictionState } from "@/lib/permissions/location-boundary"
import { assignment, AssignmentError, patch, patchError, uuid } from "./contract"
import { readAssignments } from "./read"

type Context = { params: Promise<{ siteId: string }> }
const headers = { "Cache-Control": "private, no-store" }

async function authorize(request: Request, context: Context, requireManager: boolean) {
  const { siteId } = await context.params
  if (!uuid.safeParse(siteId).success) throw new AssignmentError(400, "Invalid site")
  const access = await requireSiteAccess(request, siteId, { requireManager })
  if (access.error) return { error: access.error }
  // The migration and the workspace inventory use public.*. Do not mix identities
  // with an alternate agent/runtime schema, even if the UUIDs happen to match.
  const schema = process.env.NEXT_PUBLIC_APPS_TENANT_SCHEMA || process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public"
  if (schema !== "public") throw new AssignmentError(503, "Assignments are unavailable for this tenant schema")
  // agents/settings are unscoped resources under the global location ACL too.
  // An empty RLS-filtered read is not proof that there are no agents or defaults.
  const restricted = await readLocationRestrictionState(access.supabase)
  if (restricted === null) throw new AssignmentError(503, "Location access could not be verified")
  if (restricted) throw new AssignmentError(403, "Forbidden")
  return { siteId, client: access.supabase, role: access.role }
}

function failure(cause: unknown) {
  const error = cause instanceof AssignmentError ? cause : new AssignmentError(503, "Channel assignments are unavailable")
  return NextResponse.json({ error: error.message }, { status: error.status, headers })
}

export async function GET(request: Request, context: Context) {
  try {
    const access = await authorize(request, context, false)
    if (access.error) return access.error
    const data = await readAssignments(access.client, access.siteId, access.role, request.signal)
    return NextResponse.json(data, { headers })
  } catch (error) { return failure(error) }
}

async function parsePatch(request: Request) {
  try {
    return patch.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 2048))))
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw new AssignmentError(413, "Assignment request is too large")
    throw new AssignmentError(400, "Invalid assignment request")
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const access = await authorize(request, context, true)
    if (access.error) return access.error
    const input = await parsePatch(request)
    const { data, error } = await access.client.rpc("set_channel_agent_assignment", {
      p_site_id: access.siteId, p_connection_id: input.connectionId, p_agent_id: input.agentId,
      p_expected_revision: input.expectedRevision,
    })
    if (error) throw patchError(error)
    const saved = assignment.safeParse(data)
    if (!saved.success || saved.data.connectionId !== input.connectionId || saved.data.agentId !== input.agentId ||
      saved.data.revision !== input.expectedRevision + 1) throw new AssignmentError(503, "Could not confirm assignment")
    return NextResponse.json({ assignment: saved.data }, { headers })
  } catch (error) { return failure(error) }
}
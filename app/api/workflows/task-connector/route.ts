import 'server-only'
import { isDeepStrictEqual } from 'node:util'
import { describeWorkflowOperation } from './descriptor'
import { z } from 'zod'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { createServiceClient } from '@/lib/supabase/server'
import { isSameOriginApiRequest } from '@/lib/http/api-proxy-security'
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'
import { graphDigest, toolId, taskConnectorResult, taskConnectorReview, taskConnectorRevocation } from '@/app/components/workflows/task-connector-contract'

const scope = z.object({ site_id: z.string().uuid(), instance_id: z.string().uuid(), node_id: z.string().uuid() })
const input = z.discriminatedUnion('action', [
  scope.extend({ action: z.literal('describe'), tool_slug: toolId }).strict(),
  scope.extend({ action: z.literal('review'), tool_slug: toolId, arguments: z.record(z.unknown()) }).strict(),
  scope.extend({ action: z.literal('publish'), digest: graphDigest, tool_slug: toolId, arguments: z.record(z.unknown()) }).strict(),
  scope.extend({ action: z.literal('revoke') }).strict(),
  scope.extend({ action: z.literal('result') }).strict(),
])
const headers = { 'Cache-Control': 'private, no-store' }
const deny = (status: number, message: string) => Response.json({ error: message }, { status, headers })

// Private member control plane only. The scheduler has its own non-browser entry point.
export async function POST(request: Request) {
  if (!request.headers.get('origin') || !isSameOriginApiRequest(request)) return deny(403, 'Origin denied.')
  if (new URL(request.url).search) return deny(400, 'Unexpected parameters.')
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return deny(415, 'JSON required.')
  try {
    const intent = input.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 16384))))
    const access = await requireSiteAccess(request, intent.site_id, { requireManager: true })
    if (access.error) { access.error.headers.set('Cache-Control', headers['Cache-Control']); return access.error }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(24000)])
    // Row visibility is checked with the actual member's session, not a site-level service lookup.
    const node = await access.supabase.from('instance_nodes').select('id,task_connector_id').eq('id', intent.node_id)
      .eq('type', 'wf-step').eq('instance_id', intent.instance_id).eq('site_id', intent.site_id).abortSignal(signal).maybeSingle()
    if (node.error) return deny(503, 'Task access could not be verified.')
    if (node.data?.id !== intent.node_id) return deny(403, 'Task is not accessible.')
    const { data: permission, error: accessError } = await access.supabase.rpc('connector_site_access', {
      p_site_id: intent.site_id, p_user_id: access.userId,
    }).abortSignal(signal)
    if (accessError) return deny(503, 'Connector access could not be verified.')
    const actor = Array.isArray(permission) ? permission[0] : permission
    if (actor?.can_manage !== true || actor.can_view !== true) return deny(403, 'Connector management is required.')

    let operation
    if ('tool_slug' in intent) {
      if (!z.string().uuid().safeParse(node.data.task_connector_id).success) return deny(409, 'Save the selected account before reviewing it.')
      const { data: { session }, error } = await access.supabase.auth.getSession()
      if (error || session?.user?.id !== access.userId || !session.access_token) return deny(401, 'Authentication required.')
      const described = await describeWorkflowOperation(request, session.access_token, { site_id: intent.site_id,
        connector_id: node.data.task_connector_id, tool_slug: intent.tool_slug, ...('arguments' in intent && { arguments: intent.arguments }) })
      if ('status' in described) return deny(described.status, 'This operation, account or argument set could not be verified for scheduled use.')
      if (intent.action === 'describe') return Response.json(described.descriptor, { headers })
      const { connector_id, toolkit_slug, tool_slug, toolkit_version, schema_hash } = described.descriptor
      operation = { connector_id, toolkit_slug, tool_slug, toolkit_version, schema_hash, arguments: intent.arguments }
    }
    const service = await createServiceClient(true)
    const { data, error } = await service.rpc(`workflow_connector_${intent.action}`, {
      p_instance: intent.instance_id, p_node: intent.node_id, p_actor: access.userId,
      ...(intent.action === 'publish' && { p_digest: intent.digest }), ...(operation && { p_operation: operation }),
    }).abortSignal(signal)
    if (error?.code === '42501') return deny(403, 'No eligible authorization or private result for this task.')
    if (error?.code === '40001' || error?.code === '23505') return deny(409, 'The task or authorization changed. Review it again.')
    if (error?.code === '22023') return deny(422, 'Unsupported task configuration.')
    if (error) return deny(503, 'The operation could not be confirmed.')
    if (intent.action === 'result' || intent.action === 'revoke') {
      const receipt = (intent.action === 'result' ? taskConnectorResult : taskConnectorRevocation).safeParse(data)
      return receipt.success ? Response.json(receipt.data, { headers }) : deny(503, 'The operation could not be confirmed.')
    }
    const review = taskConnectorReview.safeParse(data)
    if (!review.success || review.data.instance_id !== intent.instance_id || review.data.node_id !== intent.node_id ||
      review.data.principal_id !== access.userId || !operation || review.data.operation !== operation.tool_slug ||
      review.data.connector_id !== operation.connector_id || review.data.toolkit_slug !== operation.toolkit_slug || review.data.toolkit_version !== operation.toolkit_version ||
      review.data.schema_hash !== operation.schema_hash || !isDeepStrictEqual(review.data.arguments, operation.arguments) || (intent.action === 'publish' && (!review.data.published || review.data.digest !== intent.digest))) {
      return deny(503, 'The operation could not be confirmed.')
    }
    return Response.json(review.data, { headers })
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return deny(413, 'Request too large.')
    if (error instanceof SyntaxError) return deny(400, 'Invalid task request.')
    if (error instanceof z.ZodError) return deny(400, 'Invalid task contract.')
    return deny(503, 'The operation could not be confirmed.')
  }
}
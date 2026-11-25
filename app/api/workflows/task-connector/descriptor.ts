import 'server-only'
import { configuredApiUrl } from '@/lib/http/api-proxy-security'
import { decodeRequestBody, readLimitedRequestBody } from '@/lib/http/read-limited-request-body'
import { taskConnectorDescriptor, type TaskConnectorDescriptor } from '@/app/components/workflows/task-connector-contract'

/** Only the independently authenticated provider catalogue may pin the operation. No caller-supplied host, version, hash or account credential. */
export async function describeWorkflowOperation(request: Request, token: string, value: {
  site_id: string; connector_id: string; tool_slug: string; arguments?: Record<string, unknown>
}): Promise<{ descriptor: TaskConnectorDescriptor } | { status: number }> {
  const url = configuredApiUrl(request, '/api/connectors/workflow-operation')
  if (!url) return { status: 503 }
  try {
    const upstream = await fetch(url, { method: 'POST', cache: 'no-store', redirect: 'error',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(value),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    })
    if (!upstream.ok) return { status: [400,401,403,404,409,422,429].includes(upstream.status) ? upstream.status : 503 }
    const parsed = taskConnectorDescriptor.safeParse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(upstream, 131072))))
    if (!parsed.success || parsed.data.connector_id !== value.connector_id || parsed.data.tool_slug !== value.tool_slug) return { status: 503 }
    return { descriptor: parsed.data }
  } catch { return { status: 503 } }
}

import { z } from 'zod'
import { isSameOriginApiRequest } from '@/lib/http/api-proxy-security'
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'
import { failure, proxySetup, siteSchema, workflowSite } from './setup-proxy'

export const maxDuration = 30
const inputSchema = z.object({ site_id: siteSchema })

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginApiRequest(request)) return failure('Origin not allowed', 403)
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return failure('JSON content type required', 415)
  }
  let siteId: string
  try {
    siteId = inputSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 4_096)))).site_id
  } catch (error) {
    return failure('Invalid site setup request', error instanceof RequestBodyTooLargeError ? 413 : 400)
  }

  return proxySetup(request, siteId)
}

export async function GET(request: Request): Promise<Response> {
  if (!isSameOriginApiRequest(request)) return failure('Origin not allowed', 403)
  const query = new URL(request.url).searchParams
  const workflowId = query.get('workflow_id')
  const siteId = workflowSite(workflowId)
  if (!siteId || !workflowId || query.getAll('workflow_id').length !== 1) {
    return failure('A valid site setup workflow_id is required.', 400, 'INVALID_REQUEST')
  }
  return proxySetup(request, siteId, workflowId)
}
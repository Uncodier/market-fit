import { z } from 'zod'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { userCanOnSite } from '@/lib/permissions/site-access'
import { configuredApiUrl } from '@/lib/http/api-proxy-security'
import { decodeRequestBody, readLimitedRequestBody } from '@/lib/http/read-limited-request-body'

export const siteSchema = z.string().uuid().transform(id => id.toLowerCase())
const feedbackSchema = z.object({
  workflow_id: z.string().min(1).max(300), site_id: siteSchema,
  status: z.enum(['accepted', 'running', 'completed', 'failed', 'canceled', 'cancelled', 'terminated', 'timed_out']),
  setup_status: z.enum(['pending', 'complete', 'partial', 'failed', 'unconfirmed']),
  cause: z.enum(['WORKFLOW_ACCEPTED', 'WORKFLOW_RUNNING', 'WORKFLOW_DID_NOT_COMPLETE',
    'SETUP_COMPLETE', 'SETUP_PARTIAL', 'SETUP_FAILED', 'SETUP_RESULT_UNCONFIRMED']),
  steps: z.object({
    agents: z.enum(['completed', 'partial', 'skipped', 'failed']).optional(),
    segments: z.enum(['completed', 'partial', 'skipped', 'failed']).optional(),
    account_manager: z.enum(['completed', 'partial', 'skipped', 'failed']).optional(),
    follow_up_email: z.enum(['completed', 'partial', 'skipped', 'failed']).optional(),
  }).optional(),
  step_causes: z.record(z.enum(['agents', 'segments', 'account_manager', 'follow_up_email']),
    z.enum(['missing_user_id', 'missing_site_url', 'missing_contact_email', 'disabled',
      'agent_creation_incomplete', 'agent_creation_failed', 'segment_creation_incomplete', 'segment_creation_failed',
      'account_manager_assignment_failed', 'follow_up_email_failed', 'account_manager_api_unavailable', 'email_provider_skipped',
      'setup_email_delivery_unconfirmed', 'setup_email_service_unconfigured'])).optional(),
})

export function workflowSite(workflowId: string | null): string | null {
  const match = workflowId?.match(/^site-setup-([0-9a-f-]{36})-(\d{1,20})$/)
  const parsed = siteSchema.safeParse(match?.[1])
  return parsed.success ? parsed.data : null
}

export function failure(message: string, status: number, code = 'SETUP_UNCONFIRMED', workflowId?: string) {
  return Response.json({ success: false, error: { code, message },
    ...(workflowId ? { data: { workflow_id: workflowId, setup_status: 'unconfirmed' } } : {}),
  }, { status, headers: { 'Cache-Control': 'no-store, private' } })
}

async function proxyAuthorizedSetup(request: Request, siteId: string, workflowId?: string): Promise<Response> {
  const access = await requireSiteAccess(request, siteId, { requireManager: true })
  if (access.error) return access.error
  if (!await userCanOnSite(access.supabase, siteId, 'update')) return failure('Site setup is not permitted.', 403, 'FORBIDDEN')
  const { data: { session }, error } = await access.supabase.auth.getSession()
  if (error || !session?.access_token || session.user?.id !== access.userId) {
    return failure('Please sign in again to configure this site.', 401, 'UNAUTHORIZED')
  }
  const target = configuredApiUrl(request, '/api/site/setup')
  if (!target) return failure('Site setup API is not configured.', 503, 'SETUP_API_UNAVAILABLE')
  if (workflowId) target.searchParams.set('workflow_id', workflowId)
  try {
    const upstream = await fetch(target, {
      method: workflowId ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(!workflowId ? { body: JSON.stringify({ site_id: siteId }) } : {}),
      cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(22_000)]),
    })
    if (!upstream.headers.get('content-type')?.includes('application/json')) {
      await upstream.body?.cancel()
      return failure('Site setup could not be confirmed. Check its status before retrying.', 502)
    }
    const body = JSON.parse(decodeRequestBody(await readLimitedRequestBody(upstream as unknown as Request, 16_000)))
    if (!upstream.ok) {
      const status = [400, 401, 403, 409, 429, 503].includes(upstream.status) ? upstream.status : 502
      const id = typeof body?.data?.workflow_id === 'string' && workflowSite(body.data.workflow_id) === siteId
        ? body.data.workflow_id : undefined
      const billingFailed = body?.error?.code === 'BILLING_INITIALIZATION_FAILED'
      return failure(status === 401 ? 'Please sign in again to configure this site.'
        : status === 403 ? 'Site setup is not permitted.'
        : billingFailed ? 'Background setup was not started because billing could not be confirmed.'
        : 'Site setup could not be confirmed. Check its status before retrying.', status,
      billingFailed ? 'BILLING_INITIALIZATION_FAILED' : status === 401 ? 'UNAUTHORIZED'
        : status === 403 ? 'FORBIDDEN' : 'SETUP_UNCONFIRMED', id)
    }
    const parsed = feedbackSchema.safeParse(body?.data)
    if (body?.success !== true || !parsed.success || parsed.data.site_id !== siteId
      || workflowSite(parsed.data.workflow_id) !== siteId
      || (workflowId && parsed.data.workflow_id !== workflowId)) {
      return failure('Site setup could not be confirmed. Check its status before retrying.', 502)
    }
    return Response.json({ success: true, data: parsed.data }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch {
    return failure('Site setup could not be confirmed. Check its status before retrying.', 502, 'SETUP_UNCONFIRMED', workflowId)
  }
}

export async function proxySetup(request: Request, siteId: string, workflowId?: string): Promise<Response> {
  try {
    return await proxyAuthorizedSetup(request, siteId, workflowId)
  } catch {
    return failure('Site setup authorization is unavailable. Check its status before retrying.', 503, 'SETUP_UNCONFIRMED', workflowId)
  }
}
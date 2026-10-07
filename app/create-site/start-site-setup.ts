import { z } from 'zod'
import { isSiteSetupWorkflowId, setupFeedback, setupIdSchema, setupStatusSchema,
  unconfirmedSetup, type SiteSetupFeedback } from './site-setup-feedback'

export { SETUP_UNCONFIRMED_MESSAGE, unconfirmedSetup, type SiteSetupFeedback } from './site-setup-feedback'
const feedbackSchema = z.object({
  workflow_id: z.string(),
  setup_status: setupStatusSchema,
  step_causes: z.record(z.string()).optional(),
})

async function requestSetup(siteId: string, workflowId?: string): Promise<SiteSetupFeedback> {
  if (!setupIdSchema.safeParse(siteId).success
    || (workflowId !== undefined && !isSiteSetupWorkflowId(workflowId, siteId))) return unconfirmedSetup()
  // Retain a separately validated identity even if the remaining DTO is malformed.
  let knownWorkflowId = workflowId
  try {
    const endpoint = workflowId ? `/api/site/setup?workflow_id=${encodeURIComponent(workflowId)}` : '/api/site/setup'
    // Same-origin cookie session only; no browser API key, demo mock, or contact/name required.
    const response = await fetch(endpoint, {
      method: workflowId ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(!workflowId ? { body: JSON.stringify({ site_id: siteId }) } : {}),
      signal: AbortSignal.timeout(25_000),
    })
    const body = await response.json()
    const candidateId = isSiteSetupWorkflowId(body?.data?.workflow_id, siteId) ? body.data.workflow_id : undefined
    knownWorkflowId ||= candidateId
    const parsed = feedbackSchema.safeParse(body?.data)
    if (!response.ok || body?.success !== true || !parsed.success || !candidateId
      || parsed.data.workflow_id !== knownWorkflowId
      || (body.data.site_id !== undefined && body.data.site_id !== siteId.toLowerCase())
      || (workflowId && parsed.data.workflow_id !== workflowId)) {
      const code = body?.error?.code
      return setupFeedback('unconfirmed', knownWorkflowId, code === 'BILLING_INITIALIZATION_FAILED'
        ? 'billing_unconfirmed' : response.status === 401 ? 'session_required'
          : response.status === 403 ? 'forbidden' : undefined)
    }
    const status = parsed.data.setup_status
    const causes = Object.values(parsed.data.step_causes || {})
    const detail = causes.includes('setup_email_delivery_unconfirmed') ? 'setup_email_delivery_unconfirmed'
      : causes.includes('setup_email_service_unconfigured') ? 'setup_email_service_unconfigured'
      : causes.includes('missing_site_url') ? 'missing_site_url'
      : causes.includes('missing_contact_email') ? 'missing_contact_email'
        : causes.includes('account_manager_api_unavailable') ? 'account_manager_api_unavailable' : undefined
    return setupFeedback(status, knownWorkflowId, detail)
  } catch {
    return unconfirmedSetup(knownWorkflowId)
  }
}

/** Never automatically replay an ambiguous workflow start. */
export function startSiteSetup(siteId: string): Promise<SiteSetupFeedback> {
  return requestSetup(siteId)
}

export function checkSiteSetup(siteId: string, workflowId: string): Promise<SiteSetupFeedback> {
  return requestSetup(siteId, workflowId)
}
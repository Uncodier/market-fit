import { z } from 'zod'

export const setupIdSchema = z.string().uuid()
export const setupStatusSchema = z.enum(['pending', 'complete', 'partial', 'failed', 'unconfirmed'])
export const setupDetailSchema = z.enum(['missing_site_url', 'missing_contact_email',
  'account_manager_api_unavailable', 'setup_email_delivery_unconfirmed', 'setup_email_service_unconfigured',
  'billing_unconfirmed', 'session_required', 'forbidden'])
export const SETUP_UNCONFIRMED_MESSAGE = 'Your project was created, but background setup is unconfirmed. Check its status before retrying setup.'

export type SiteSetupFeedback = {
  status: z.infer<typeof setupStatusSchema>
  workflowId?: string
  detail?: z.infer<typeof setupDetailSchema>
  message: string
}

/** A workflow ID is only a tracking identifier, never evidence of authorization. */
export function isSiteSetupWorkflowId(value: unknown, siteId: string): value is string {
  if (typeof value !== 'string' || !setupIdSchema.safeParse(siteId).success) return false
  const match = value.match(/^site-setup-([0-9a-f-]{36})-(\d{1,20})$/)
  return !!match && setupIdSchema.safeParse(match[1]).success && match[1] === siteId.toLowerCase()
}

export function setupFeedback(status: SiteSetupFeedback['status'], workflowId?: string,
  detail?: SiteSetupFeedback['detail']): SiteSetupFeedback {
  const reason = detail === 'missing_site_url' ? ' Add a website URL in project settings to enable segmentation.'
    : detail === 'missing_contact_email' ? ' Contact-dependent steps were skipped because no contact email was available.'
    : detail === 'account_manager_api_unavailable' ? ' Account manager assignment is unavailable.'
    : detail === 'setup_email_delivery_unconfirmed' ? ' Setup email delivery is unconfirmed; do not resend it automatically.'
    : detail === 'setup_email_service_unconfigured' ? ' The setup email service is unavailable.' : ''
  const message = status === 'complete' ? 'Background setup is complete.'
    : status === 'partial' ? `Your project was created, but background setup is partial. Some steps were skipped or failed.${reason} Review project settings before retrying setup.`
    : status === 'failed' ? 'Your project was created, but background setup failed. Review project settings and workflow status before retrying setup.'
    : status === 'pending' ? 'Your project was created. Background setup is pending; completion is not yet confirmed.'
    : detail === 'billing_unconfirmed' ? 'Your project was created, but background setup was not started because billing could not be confirmed.'
    : detail === 'session_required' ? 'Your project was created, but setup needs a valid session. Please sign in again.'
    : detail === 'forbidden' ? 'Your project was created, but you do not have permission to configure background setup.'
    : SETUP_UNCONFIRMED_MESSAGE
  return { status, workflowId, detail, message }
}

export function unconfirmedSetup(workflowId?: string): SiteSetupFeedback {
  return setupFeedback('unconfirmed', workflowId)
}
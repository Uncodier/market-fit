import messages from '@/app/context/locales/screens/account-en.json'
import { setupFeedback, type SiteSetupFeedback } from './site-setup-feedback'

type Translator = (key: string, params?: Record<string, string | number>) => string

const setupTextKeys = Object.entries(messages)
  .filter(([key]) => key.startsWith('account.setup.'))
  .reduce<Record<string, string>>((keys, [key, message]) => ({ ...keys, [message]: key }), {})

/** Localize known application messages, leaving upstream details untouched. */
export function localizeSetupText(message: string, t: Translator): string {
  const key = setupTextKeys[message]
  return key ? t(key) : message
}

const partialReasons: Partial<Record<NonNullable<SiteSetupFeedback['detail']>, string>> = {
  missing_site_url: 'account.setup.missingUrl',
  missing_contact_email: 'account.setup.missingEmail',
  account_manager_api_unavailable: 'account.setup.managerUnavailable',
  setup_email_delivery_unconfirmed: 'account.setup.emailUnconfirmed',
  setup_email_service_unconfigured: 'account.setup.emailUnavailable',
}

/** Derive display text without translating or mutating persisted feedback. */
export function localizeSetupFeedback(feedback: SiteSetupFeedback, t: Translator): string {
  const canonical = setupFeedback(feedback.status, feedback.workflowId, feedback.detail)
  if (feedback.message !== canonical.message) return localizeSetupText(feedback.message, t)
  if (feedback.status === 'partial') {
    const reasonKey = feedback.detail ? partialReasons[feedback.detail] : undefined
    return t('account.setup.partialMessage', { reason: reasonKey ? t(reasonKey) : '' })
  }
  return localizeSetupText(feedback.message, t)
}
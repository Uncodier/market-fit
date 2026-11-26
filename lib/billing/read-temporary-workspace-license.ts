import { snapshotPostgrestError } from '@/lib/supabase/postgrest-error'
import type { Site } from '@/app/context/site-types'

type StoredSocialAccount = NonNullable<NonNullable<Site['settings']>['social_media']>[number] & Record<string, unknown>
type SocialBillingSettings = Pick<NonNullable<Site['settings']>, 'id' | 'channels'> & {
  social_media?: StoredSocialAccount[] | null
  updated_at?: string | null
}
type SocialBillingFields = Pick<NonNullable<Site['billing']>, 'plan' | 'auto_renew' | 'addons_count' |
  'trial_started_at' | 'trial_ends_at' | 'trial_converted_at' | 'temporary_workspace_license' |
  'subscription_status' | 'paid_subscription_period_start' | 'paid_subscription_period_end'>

export type SocialBillingSiteRow = {
  settings: SocialBillingSettings | SocialBillingSettings[] | null
  billing: SocialBillingFields | SocialBillingFields[] | null
}

export function isMissingTemporaryWorkspaceLicense(error: unknown): boolean {
  const { code, message } = snapshotPostgrestError(error)
  return (code === '42703' && /\bcolumn\s+(?:[\w".]+\.)?"?temporary_workspace_license"?\s+does not exist/i.test(message)) ||
    (code === 'PGRST204' && /Could not find the 'temporary_workspace_license' column/i.test(message))
}

export async function readWithTemporaryWorkspaceLicense<T>(
  read: (includeTemporaryLicense: boolean) => PromiseLike<{ data: T | null; error: unknown }>,
) {
  const result = await read(true)
  return result.error && isMissingTemporaryWorkspaceLicense(result.error) ? read(false) : result
}
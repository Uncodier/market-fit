import { ANNUAL_BILLING_FIELDS, BASE_SITE_BILLING_READ_FIELDS, LEGACY_SITE_BILLING_READ_FIELDS, SITE_BILLING_READ_FIELDS, TRIAL_BILLING_FIELDS, PRE_TRIAL_SITE_BILLING_READ_FIELDS } from './site-billing-data'
import { snapshotPostgrestError } from '@/lib/supabase/postgrest-error'
import { isMissingTemporaryWorkspaceLicense } from '@/lib/billing/read-temporary-workspace-license'

/** Read-only rollout compatibility; never hide auth, network, or balance-schema errors. */
export async function readSiteBilling<T>(
  read: (fields: string) => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<{ data: T | null; error: unknown }> {
  let result = await read(SITE_BILLING_READ_FIELDS)
  let withTemporaryLicense = true
  let withTrial = true
  for (let attempt = 0; result.error && attempt < 3; attempt++) {
    if (withTemporaryLicense && isMissingTemporaryWorkspaceLicense(result.error)) {
      withTemporaryLicense = false
      result = await read(BASE_SITE_BILLING_READ_FIELDS)
      continue
    }
    const error = snapshotPostgrestError(result.error)
    if (!['42703', 'PGRST204'].includes(error.code)) return result
    const missing = error.message.match(/column\s+(?:billing\.)?["']?(\w+)["']?\s+does not exist/i)?.[1]
      ?? error.message.match(/Could not find the ['"](\w+)['"] column/i)?.[1]
    if (!missing) return result
    if ((ANNUAL_BILLING_FIELDS as readonly string[]).includes(missing)) return read(LEGACY_SITE_BILLING_READ_FIELDS)
    if (!(TRIAL_BILLING_FIELDS as readonly string[]).includes(missing) || !withTrial) return result
    // Missing trial schema retains ordinary billing but cannot grant trial permissions.
    result = await read(PRE_TRIAL_SITE_BILLING_READ_FIELDS)
    withTrial = withTemporaryLicense = false
  }
  return result
}
import { ANNUAL_BILLING_FIELDS, LEGACY_SITE_BILLING_READ_FIELDS, SITE_BILLING_READ_FIELDS, TRIAL_BILLING_FIELDS, PRE_TRIAL_SITE_BILLING_READ_FIELDS } from './site-billing-data'
import { snapshotPostgrestError } from '@/lib/supabase/postgrest-error'

/** Read-only rollout compatibility; never hide auth, network, or balance-schema errors. */
export async function readSiteBilling<T>(
  read: (fields: string) => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<{ data: T | null; error: unknown }> {
  let result = await read(SITE_BILLING_READ_FIELDS)
  for (let attempt = 0; result.error && attempt < 2; attempt++) {
    const error = snapshotPostgrestError(result.error)
    if (!['42703', 'PGRST204'].includes(error.code)) return result
    const missing = error.message.match(/column\s+(?:billing\.)?["']?(\w+)["']?\s+does not exist/i)?.[1]
      ?? error.message.match(/Could not find the ['"](\w+)['"] column/i)?.[1]
    if (!missing) return result
    if ((ANNUAL_BILLING_FIELDS as readonly string[]).includes(missing)) return read(LEGACY_SITE_BILLING_READ_FIELDS)
    if (!(TRIAL_BILLING_FIELDS as readonly string[]).includes(missing) || attempt > 0) return result
    // Missing trial schema retains ordinary billing but cannot grant trial permissions.
    result = await read(PRE_TRIAL_SITE_BILLING_READ_FIELDS)
  }
  return result
}
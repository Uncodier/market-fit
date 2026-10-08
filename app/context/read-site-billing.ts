import { ANNUAL_BILLING_FIELDS, LEGACY_SITE_BILLING_READ_FIELDS, SITE_BILLING_READ_FIELDS } from './site-billing-data'
import { snapshotPostgrestError } from '@/lib/supabase/postgrest-error'

/** Read-only rollout compatibility; never hide auth, network, or balance-schema errors. */
export async function readSiteBilling<T>(
  read: (fields: string) => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<{ data: T | null; error: unknown }> {
  const result = await read(SITE_BILLING_READ_FIELDS)
  if (!result.error) return result
  const error = snapshotPostgrestError(result.error)
  if (!['42703', 'PGRST204'].includes(error.code)) return result
  const missing = error.message.match(/column\s+(?:billing\.)?["']?(\w+)["']?\s+does not exist/i)?.[1]
    ?? error.message.match(/Could not find the ['"](\w+)['"] column/i)?.[1]
  if (!missing || !(ANNUAL_BILLING_FIELDS as readonly string[]).includes(missing)) return result
  return read(LEGACY_SITE_BILLING_READ_FIELDS)
}
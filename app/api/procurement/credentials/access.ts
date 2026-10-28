import { createClient } from '@/lib/supabase/server'
import { procurementError } from '../http'
import { isSameOriginApiRequest } from '@/lib/http/api-proxy-security'

export async function credentialAccess(request: Request) {
  if (request.method !== 'GET' && !isSameOriginApiRequest(request)) {
    return { error: procurementError('Origin not allowed', 403) } as const
  }
  if (/(?:^|;\s*)market_fit_demo_site_id=/.test(request.headers.get('cookie') ?? '')) {
    return { error: procurementError('Credentials are unavailable in demo mode', 403) } as const
  }
  const supabase = await createClient(true)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { error: procurementError('Authentication required', 401) } as const
  return { supabase, user: data.user } as const
}
export function credentialDatabaseError(code: string | undefined) {
  if (code === '42501') return procurementError('Credential access denied', 403)
  if (code === '40001') return procurementError('The record changed or its limit was reached. Reload before retrying.', 409)
  if (code === '22023' || code === '22007' || code === '23514') return procurementError('Invalid evidence input', 400)
  return procurementError('Evidence is temporarily unavailable', 503)
}
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { isSameOriginApiRequest } from '@/lib/http/api-proxy-security'
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'
import { procurementError, privateHeaders } from '../http'
import { uuid } from '../http'
import { requireSiteAccess } from '@/lib/auth/api-site-access'

export async function operationalRequestAccess(request: Request, decision = false) {
  const params = new URL(request.url).searchParams
  const site = uuid.safeParse(params.get('site_id'))
  if (!site.success || params.getAll('site_id').length !== 1) return { error: procurementError('A valid workspace is required', 400) } as const
  if (/(?:^|;\s*)market_fit_demo_site_id=/.test(request.headers.get('cookie') ?? '')) return { error: procurementError('Requests are unavailable in demo mode', 403) } as const
  const access = await requireSiteAccess(request, site.data)
  if (access.error) return access
  const permission = await access.supabase.rpc('user_can', { p_site_id: site.data, p_command: decision ? 'update' : 'select' })
  if (permission.error || permission.data !== true) return { error: procurementError('Request access denied', 403) } as const
  return { ...access, siteId: site.data } as const
}

export const summaryColumns = 'id,title,description,currency,net_amount_minor,revision,requester_id,status,updated_at,policy_revision'
export const resultJson = (data: unknown) => NextResponse.json(data, { headers: privateHeaders })
export async function requestBody<T>(request: Request, schema: z.ZodType<T>) {
  if (!isSameOriginApiRequest(request)) return { error: procurementError('Cross-origin writes are not allowed', 403) }
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return { error: procurementError('Use application/json', 415) }
  }
  try {
    const parsed = schema.safeParse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 128 * 1024))))
    if (!parsed.success) return { error: procurementError('Invalid request data', 400) }
    return { data: parsed.data }
  } catch (error) {
    return { error: procurementError(error instanceof RequestBodyTooLargeError ? 'Request too large' : 'Invalid JSON', error instanceof RequestBodyTooLargeError ? 413 : 400) }
  }
}
export function databaseError(error: { code?: string } | null) {
  if (!error) return null
  if (['40001', '23505'].includes(error.code ?? '')) return procurementError('Request changed or decision already recorded. Reload before continuing.', 409)
  if (error.code === '42501') return procurementError('Request access denied or approver is not eligible', 403)
  if (['22023', '23514', '23502', '22003', '22P02'].includes(error.code ?? '')) return procurementError('Request cannot progress. Check pricing, policy, deadlines and stage order.', 400)
  return procurementError('Request storage unavailable. Check the required migration.', 503)
}

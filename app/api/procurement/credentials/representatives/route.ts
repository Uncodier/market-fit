import { NextResponse } from 'next/server'
import { z } from 'zod'
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'
import { procurementAccess, privateHeaders, procurementError, uuid } from '../../http'
import { credentialDatabaseError } from '../access'
import { isSameOriginApiRequest } from '@/lib/http/api-proxy-security'

export async function GET(request: Request) {
  try {
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const params = new URL(request.url).searchParams
    const supplier = uuid.safeParse(params.get('supplier_id'))
    if (!supplier.success || params.getAll('supplier_id').length !== 1 || [...params.keys()].some(key => !['site_id', 'supplier_id'].includes(key))) return procurementError('A valid supplier is required', 400)
    const result = await access.supabase.from('supplier_representatives').select('id,user_id,revoked_at,created_at')
      .eq('site_id', access.siteId).eq('supplier_id', supplier.data).order('created_at', { ascending: false }).limit(100)
    if (result.error) return credentialDatabaseError(result.error.code)
    return NextResponse.json({ representatives: result.data }, { headers: privateHeaders })
  } catch { return procurementError('Unable to load representatives', 503) }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginApiRequest(request)) return procurementError('Origin not allowed', 403)
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return procurementError('JSON content type required', 415)
    if ([...new URL(request.url).searchParams.keys()].some(key => key !== 'site_id')) return procurementError('Unexpected query parameters', 400)
    const access = await procurementAccess(request)
    if (access.error) return access.error
    let raw: unknown
    try { raw = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 2048))) }
    catch (error) { return procurementError('Invalid representation grant', error instanceof RequestBodyTooLargeError ? 413 : 400) }
    const parsed = z.object({ supplier_id: uuid, user_id: uuid, revoke: z.boolean() }).strict().safeParse(raw)
    if (!parsed.success) return procurementError('Invalid representation grant', 400)
    const result = await access.supabase.rpc('set_supplier_representative', { p_site: access.siteId, p_supplier: parsed.data.supplier_id, p_user: parsed.data.user_id, p_revoke: parsed.data.revoke })
    if (result.error) return credentialDatabaseError(result.error.code)
    return NextResponse.json({ id: result.data }, { headers: privateHeaders })
  } catch { return procurementError('Unable to change representation', 503) }
}
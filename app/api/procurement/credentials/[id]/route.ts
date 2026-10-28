import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readLimitedRequestBody, decodeRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'
import { privateHeaders, procurementError, uuid } from '../../http'
import { credentialAccess, credentialDatabaseError } from '../access'

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await credentialAccess(request)
    if (access.error) return access.error
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return procurementError('JSON content type required', 415)
    if (new URL(request.url).search) return procurementError('Unexpected query parameters', 400)
    const id = uuid.safeParse((await context.params).id)
    let input: unknown
    try { input = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 1024))) }
    catch (error) { return procurementError('Invalid archive request', error instanceof RequestBodyTooLargeError ? 413 : 400) }
    const parsed = z.object({ expected_version: z.number().int().min(1) }).strict().safeParse(input)
    if (!id.success || !parsed.success) return procurementError('Invalid archive request', 400)
    const result = await access.supabase.rpc('archive_procurement_credential', { p_id: id.data, p_version: parsed.data.expected_version })
    if (result.error) return credentialDatabaseError(result.error.code)
    return NextResponse.json({ archived: true }, { headers: privateHeaders })
  } catch { return procurementError('Unable to archive evidence', 503) }
}
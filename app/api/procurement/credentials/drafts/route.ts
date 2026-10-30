import { NextResponse } from 'next/server'
import { draftSelectorSchema, draftPutSchema, draftDeleteSchema } from '@/app/home/submissions/draft-schema'
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'
import { privateHeaders, procurementError } from '../../http'
import { credentialAccess } from '../access'

function databaseError(code?: string) {
  if (code === '42501') return procurementError('Draft access denied', 403)
  if (code === '40001' || code === '23505') return procurementError('The draft changed. Reload before retrying.', 409)
  if (code === '22023' || code === '23514') return procurementError('Invalid draft input', 400)
  return procurementError('Draft persistence is temporarily unavailable', 503)
}

function queryInput(request: Request) {
  const params = new URL(request.url).searchParams
  if ([...params.keys()].some(key => params.getAll(key).length !== 1)) return null
  const raw: Record<string, unknown> = Object.fromEntries(params)
  for (const key of ['version', 'expected_revision']) {
    if (key in raw) {
      if (!/^[1-9][0-9]*$/.test(String(raw[key]))) return null
      raw[key] = Number(raw[key])
    }
  }
  return raw
}

async function handle(request: Request, method: 'GET' | 'PUT' | 'DELETE') {
  try {
    const access = await credentialAccess(request)
    if (access.error) return access.error
    let input: unknown = queryInput(request)
    if (method === 'PUT') {
      if (new URL(request.url).search) return procurementError('Unexpected query parameters', 400)
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) {
        return procurementError('JSON draft input is required', 400)
      }
      try { input = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 128 * 1024))) }
      catch (error) {
        if (error instanceof RequestBodyTooLargeError) throw error
        return procurementError('Invalid JSON draft', 400)
      }
    }
    const schema = method === 'PUT' ? draftPutSchema : method === 'DELETE' ? draftDeleteSchema : draftSelectorSchema
    const parsed = schema.safeParse(input)
    if (!parsed.success) return procurementError('Invalid draft selector or content', 400)
    const value = parsed.data
    const result = await access.supabase.rpc('procurement_submission_draft', {
      p_action: method.toLowerCase(), p_publication: value.publication_id,
      p_version: value.version, p_applicant: value.applicant_key,
      p_expected_revision: 'expected_revision' in value ? value.expected_revision : null,
      p_draft: 'draft' in value ? value.draft : null,
    })
    if (result.error) return databaseError(result.error.code)
    return NextResponse.json(result.data, { headers: privateHeaders })
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return procurementError('Draft exceeds the size limit', 413)
    return procurementError('Unable to persist draft', 503)
  }
}

export const GET = (request: Request) => handle(request, 'GET')
export const PUT = (request: Request) => handle(request, 'PUT')
export const DELETE = (request: Request) => handle(request, 'DELETE')
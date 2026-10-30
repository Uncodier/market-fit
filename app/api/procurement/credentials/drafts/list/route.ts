import { NextResponse } from 'next/server'
import { privateHeaders, procurementError } from '../../../http'
import { credentialAccess } from '../../access'

export async function GET(request: Request) {
  try {
    const access = await credentialAccess(request)
    if (access.error) return access.error
    if (new URL(request.url).search) return procurementError('Unexpected query parameters', 400)
    const result = await access.supabase.rpc('procurement_submission_drafts_list')
    if (result.error) {
      console.error('[procurement/drafts/list] Database request failed', { code: result.error.code })
      return procurementError(
      result.error.code === '42501' ? 'Draft access denied' : 'Draft list is temporarily unavailable',
      result.error.code === '42501' ? 403 : 503,
    )
    }
    return NextResponse.json({ drafts: result.data }, { headers: privateHeaders })
  } catch { return procurementError('Unable to load drafts', 503) }
}
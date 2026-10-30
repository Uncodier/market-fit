import { NextResponse } from 'next/server'
import { privateHeaders, procurementAccess, procurementError, uuid } from '../../http'
import { credentialDatabaseError } from '../access'

export async function GET(request: Request) {
  try {
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const params = new URL(request.url).searchParams
    const quotation = uuid.safeParse(params.get('quotation_id'))
    if (!quotation.success || params.getAll('quotation_id').length !== 1 || [...params.keys()].some(key => !['site_id', 'quotation_id'].includes(key))) return procurementError('A valid quotation is required', 400)
    const result = await access.supabase.from('procurement_submission_evidence')
      .select('id,requirement_id,revision_id,created_at,revision:procurement_credential_revisions(id,revision,metadata,original_name,mime_type,byte_size)')
      .eq('site_id', access.siteId).eq('quotation_id', quotation.data).limit(100)
    if (result.error) return credentialDatabaseError(result.error.code)
    return NextResponse.json({ evidence: result.data }, { headers: privateHeaders })
  } catch { return procurementError('Unable to load shared evidence', 503) }
}
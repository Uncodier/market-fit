import { EVIDENCE_BUCKET } from '@/app/purchases/procurement/evidence/schema'
import { procurementError, uuid } from '../../../../http'
import { credentialAccess } from '../../../access'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await credentialAccess(request)
    if (access.error) return access.error
    if (new URL(request.url).search) return procurementError('Unexpected query parameters', 400)
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid evidence revision', 400)
    const revision = await access.supabase.from('procurement_credential_revisions')
      .select('object_path,mime_type,state').eq('id', id.data).eq('state', 'ready').maybeSingle()
    if (revision.error) return procurementError('Unable to load evidence', 503)
    if (!revision.data) return procurementError('Evidence not found', 404)
    const download = await access.supabase.storage.from(EVIDENCE_BUCKET).download(revision.data.object_path)
    if (download.error || !download.data) return procurementError('Evidence not found', 404)
    return new Response(download.data, { headers: { 'Cache-Control': 'private, no-store',
      'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="evidence"',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } })
  } catch { return procurementError('Unable to load evidence', 503) }
}
import { NextResponse } from 'next/server'
import { readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'
import { EVIDENCE_BUCKET, MAX_EVIDENCE_BYTES, evidenceMime, matchesEvidenceSignature, uploadMetadata } from '@/app/purchases/procurement/evidence/schema'
import { privateHeaders, procurementError } from '../http'
import { credentialAccess, credentialDatabaseError } from './access'

export async function GET(request: Request) {
  try {
    const access = await credentialAccess(request)
    if (access.error) return access.error
    if (new URL(request.url).search) return procurementError('Unexpected query parameters', 400)
    const result = await access.supabase.from('procurement_credentials')
      .select('id,version,archived_at,revisions:procurement_credential_revisions(id,credential_id,revision,metadata,original_name,mime_type,byte_size,created_at,state)')
      .eq('owner_id', access.user.id).order('created_at', { ascending: false }).limit(50)
    if (result.error) return credentialDatabaseError(result.error.code)
    return NextResponse.json({ credentials: result.data, assessment: { status: 'pending', reason: 'No credential assessment worker is configured. No authenticity or acceptance decision has been made.' } }, { headers: privateHeaders })
  } catch { return procurementError('Unable to load credentials', 503) }
}

export async function POST(request: Request) {
  try {
    const access = await credentialAccess(request)
    if (access.error) return access.error
    if (new URL(request.url).search) return procurementError('Unexpected query parameters', 400)
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.startsWith('multipart/form-data;')) return procurementError('Multipart evidence is required', 400)
    const bytes = await readLimitedRequestBody(request, MAX_EVIDENCE_BYTES + 16384)
    let form: FormData
    try { form = await new Response(Buffer.from(bytes), { headers: { 'Content-Type': contentType } }).formData() }
    catch { return procurementError('Invalid upload', 400) }
    if ([...form.keys()].length !== 2 || form.getAll('metadata').length !== 1 || form.getAll('file').length !== 1) return procurementError('One document and metadata are required', 400)
    let raw: unknown
    try { raw = JSON.parse(String(form.get('metadata'))) } catch { return procurementError('Invalid credential metadata', 400) }
    const parsed = uploadMetadata.safeParse(raw)
    const file = form.get('file')
    if (!parsed.success || !file || typeof file === 'string' || !evidenceMime.safeParse(file.type).success
      || file.size < 1 || file.size > MAX_EVIDENCE_BYTES || file.name.length > 200 || /[\x00-\x1f/\\]/.test(file.name)) {
      return procurementError('Use valid personal credential metadata and a PDF, PNG or JPEG up to 8 MiB', 400)
    }
    const content = new Uint8Array(await file.arrayBuffer())
    if (!matchesEvidenceSignature(content, file.type)) return procurementError('File content does not match its declared type', 400)
    const { data, error } = await access.supabase.rpc('reserve_procurement_credential', {
      p_id: parsed.data.credential_id, p_version: parsed.data.expected_version, p_metadata: parsed.data.metadata,
      p_name: file.name, p_mime: file.type, p_bytes: file.size,
    })
    if (error) return credentialDatabaseError(error.code)
    const upload = await access.supabase.storage.from(EVIDENCE_BUCKET).upload(data.object_path, content, { contentType: file.type, upsert: false })
    if (upload.error) return procurementError('Upload did not complete. The pending revision is retained; reload before retrying.', 503)
    const completed = await access.supabase.rpc('complete_procurement_credential', { p_revision: data.revision_id })
    if (completed.error) return credentialDatabaseError(completed.error.code)
    return NextResponse.json({ credential_id: data.credential_id, revision_id: data.revision_id, version: data.version }, { status: 201, headers: privateHeaders })
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return procurementError('Evidence exceeds the upload limit', 413)
    return procurementError('Unable to upload evidence', 503)
  }
}
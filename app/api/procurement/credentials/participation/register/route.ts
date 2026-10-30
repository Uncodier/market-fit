import { z } from 'zod'
import { credentialAccess } from '../../access'
import { procurementError, uuid } from '../../../http'
import { requestBody, resultJson } from '../../../requests/http'

const registrationSchema = z.object({ publication_id: uuid, acting_site_id: uuid.optional() }).strict()

export async function POST(request: Request) {
  try {
    const access = await credentialAccess(request)
    if (access.error) return access.error
    if (new URL(request.url).search) return procurementError('Unexpected query parameters', 400)
    const body = await requestBody(request, registrationSchema)
    if (body.error) return body.error
    const { publication_id, acting_site_id } = body.data!
    const { data, error } = acting_site_id
      ? await access.supabase.rpc('register_open_tender_business', { p_publication: publication_id, p_acting_site: acting_site_id })
      : await access.supabase.rpc('register_open_tender_participant', { p_publication: publication_id })
    if (error?.code === '42501') return procurementError('Open tender participation is not permitted for this account or business', 403)
    if (error) return procurementError('Open tender registration is temporarily unavailable', 503)
    if (!uuid.safeParse(data).success) return procurementError('Open tender registration is temporarily unavailable', 503)
    return resultJson({ supplier_id: data })
  } catch { return procurementError('Open tender registration is temporarily unavailable', 503) }
}
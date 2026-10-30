import { procurementAccess, procurementError, uuid } from '../../../http'
import { submitRequestSchema } from '@/app/purchases/requests/schema'
import { databaseError, requestBody, resultJson } from '../../http'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid request identifier', 400)
    const parsed = await requestBody(request, submitRequestSchema)
    if (parsed.error) return parsed.error
    const permission = await access.supabase.rpc('user_can', { p_site_id: access.siteId, p_command: 'update' })
    if (permission.error || permission.data !== true) return procurementError('Request access denied', 403)
    // User-scoped RPC rechecks authorization, expected revision and absence of
    // committed orders atomically. It copies content, never historical approvals.
    const result = await access.supabase.rpc('revalidate_procurement_request', {
      p_site: access.siteId, p_id: id.data, p_revision: parsed.data!.expected_revision,
    })
    return databaseError(result.error) ?? resultJson({ id: result.data })
  } catch { return procurementError('Unable to revalidate approval; reload the request before retrying', 503) }
}
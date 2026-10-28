import { z } from 'zod'
import { procurementError } from '../../http'
import { requestBody, resultJson, tenderAccess, tenderError } from '../http'
export async function POST(request: Request) {
  try {
    const access = await tenderAccess(request, 'update')
    if (access.error) return access.error
    const parsed = await requestBody(request, z.object({ enabled: z.boolean() }).strict())
    if (parsed.error) return parsed.error
    const { data, error } = await access.supabase.rpc('configure_procurement_tender_portal', { p_site: access.siteId, p_enabled: parsed.data!.enabled })
    return tenderError(error) ?? resultJson({ slug: data, enabled: parsed.data!.enabled })
  } catch { return procurementError('Unable to update tender portal', 503) }
}
import { z } from 'zod'
import { procurementError } from '../../http'
import { requestBody, resultJson, tenderAccess, tenderError } from '../http'
const portalSchema = z.object({ enabled: z.boolean(), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/) })

export async function GET(request: Request) {
  try {
    const access = await tenderAccess(request)
    if (access.error) return access.error
    const result = await access.supabase.from('procurement_tender_portals').select('enabled,slug')
      .eq('site_id', access.siteId).maybeSingle()
    if (result.error) return tenderError(result.error) ?? procurementError('Unable to load tender portal', 503)
    if (!result.data) return resultJson({ enabled: false, slug: null })
    const parsed = portalSchema.safeParse(result.data)
    if (!parsed.success) return procurementError('Unable to load tender portal', 503)
    return resultJson(parsed.data)
  } catch { return procurementError('Unable to load tender portal', 503) }
}

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
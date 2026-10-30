import { z } from 'zod'
import { procurementError, uuid } from '../../../http'
import { requestBody, resultJson, tenderAccess, tenderError } from '../../http'
const schema = z.object({ expected_version: z.number().int().positive(), supplier_id: uuid, status: z.enum(['invited', 'withdrawn']) }).strict()
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await tenderAccess(request, 'update')
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid tender', 400)
    const parsed = await requestBody(request, schema)
    if (parsed.error) return parsed.error
    const { data, error } = await access.supabase.rpc('set_procurement_tender_participant', { p_site: access.siteId, p_id: id.data, p_version: parsed.data!.expected_version, p_supplier: parsed.data!.supplier_id, p_status: parsed.data!.status })
    return tenderError(error) ?? resultJson({ id: data })
  } catch { return procurementError('Unable to update participants', 503) }
}
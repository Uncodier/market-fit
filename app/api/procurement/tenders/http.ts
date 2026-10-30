import { procurementAccess, procurementError } from '../http'
export { requestBody, resultJson } from '../requests/http'

export async function tenderAccess(request: Request, command = 'select') {
  const access = await procurementAccess(request)
  if (access.error) return access
  const permission = await access.supabase.rpc('user_can', { p_site_id: access.siteId, p_command: command })
  if (permission.error || permission.data !== true) return { error: procurementError('Tender access denied', 403) } as const
  return access
}
export const tenderColumns = 'id,site_id,title,description,request_id,version,status,visibility,global_visible,participation,opening_policy,portal_slug,participation_deadline,opening_at,currency,requirements,net_amount_minor,created_by,created_at,updated_at'
export function tenderError(error: { code?: string } | null) {
  if (!error) return null
  if (['40001', '23505'].includes(error.code ?? '')) return procurementError('Tender changed or was already published. Reload before continuing.', 409)
  if (error.code === '42501') return procurementError('Tender access denied. Check linked records and supplier eligibility.', 403)
  if (['22023', '23514', '23502', '23503', '22003', '22P02', '22007'].includes(error.code ?? '')) return procurementError('Invalid tender transition or data. Check dates and linked records.', 400)
  return procurementError('Tender storage unavailable. Check the required migrations.', 503)
}
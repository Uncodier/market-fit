import { endOfDay, startOfDay, subDays } from 'date-fns'
import { PREVIEW_LIMIT, readPreviewRows, WorkspacePreviewError, type WorkspacePreviewInput, type WorkspacePreviewRow } from '../types'
import { authenticatedOperationsClient, previewRow, readAdmission, requireSiteRole } from './operations-access'

type Unit = {
  id: string; site_id: string
  sale_order_items: { name: string; site_id: string; sale_orders: { order_number: string; site_id: string } }
}

export async function orderLinesPreview(input: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  const { siteId, signal } = input
  const db = await authenticatedOperationsClient(input)
  await requireSiteRole(db, input)
  const restricted = await readAdmission(db.rpc('current_user_has_site_location_restrictions', { p_site_id: siteId }, { get: true }), signal)
  if (restricted !== false) throw new WorkspacePreviewError(restricted === true)

  // The normal first page is a page of units, not items or orders. Require
  // both visible parents and exclude modifiers *before* ordering and limiting.
  // Its local date window starts 30 days ago (including that whole day).
  const now = new Date()
  const rows = await readPreviewRows<Unit>(db.from('sale_order_item_units')
    .select('id,site_id,sale_order_items!inner(name,site_id,sale_orders!inner(order_number,site_id))')
    .eq('site_id', siteId).eq('sale_order_items.site_id', siteId).eq('sale_order_items.sale_orders.site_id', siteId)
    .is('sale_order_items.parent_sale_order_item_id', null)
    .gte('created_at', startOfDay(subDays(now, 30)).toISOString()).lte('created_at', endOfDay(now).toISOString())
    .order('created_at', { ascending: false }).order('sale_order_item_id').order('unit_index').order('id')
    .limit(PREVIEW_LIMIT), signal)
  return rows.map(unit => {
    const item = unit?.sale_order_items
    const order = item?.sale_orders
    if (unit?.site_id !== siteId || item?.site_id !== siteId || order?.site_id !== siteId ||
        typeof item.name !== 'string' || typeof order.order_number !== 'string') throw new WorkspacePreviewError()
    return previewRow(unit.id, item.name, order.order_number ? `#${order.order_number}` : undefined)
  })
}
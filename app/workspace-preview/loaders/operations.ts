import { normalizeLocale } from '@/app/context/locale-preferences'
import { getDateFnsLocale } from '@/app/lib/date-fns-locale'
import { readOrdersDateRange } from '@/app/orders/date-range-cache'
import { listReadWindow } from '@/app/reservations/read-window'
import { resolveDateRangePreset } from '@/lib/dates/date-range-presets'
import {
  PREVIEW_LIMIT, readPreviewRows, WorkspacePreviewError, type WorkspacePreviewInput, type WorkspacePreviewRow,
} from '@/app/workspace-preview/types'
import { authenticatedOperationsClient, operationsClient, previewRow, readAdmission, requireSiteRole } from './operations-access'

export { inventoryPreview, inventoryMovementsPreview, inventoryTransfersPreview } from './operations-inventory'
export { robotsPreview } from './operations-robots'

export async function ordersPreview(input: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  const { siteId, signal } = input
  const db = await authenticatedOperationsClient(input)
  const [, restricted] = await Promise.all([
    requireSiteRole(db, input),
    readAdmission(db.rpc('current_user_has_site_location_restrictions', { p_site_id: siteId }, { get: true }), signal),
  ])
  if (restricted !== false) throw new WorkspacePreviewError(restricted === true)

  // Same site-scoped filter as the default Orders page. Undefined restores the
  // thirty-day default; an explicitly cleared (null) filter stays cleared.
  const locale = normalizeLocale(document.documentElement.lang)
  const restored = readOrdersDateRange(siteId, locale ? getDateFnsLocale(locale) : undefined)
  if (!locale && restored?.preset === 'thisWeek') throw new WorkspacePreviewError()
  const range = restored === undefined ? resolveDateRangePreset('last30Days') : restored
  let query = db.from('sale_orders').select('id,order_number,status').eq('site_id', siteId)
  if (range) query = query.gte('created_at', range.startDate.toISOString()).lte('created_at', range.endDate.toISOString())
  const rows = await readPreviewRows<{ id: string; order_number: string | null; status: string }>(
    query.order('created_at', { ascending: false }).order('id', { ascending: true }).limit(PREVIEW_LIMIT), signal,
  )
  return rows.map(row => previewRow(row.id, row.order_number, row.status))
}

export async function reservationsPreview(input: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  const { siteId, signal } = input
  const db = await authenticatedOperationsClient(input)
  await requireSiteRole(db, input)
  // Only the bare route: its list defaults to this local month, non-cancelled,
  // newest first. Include open-ended and spanning reservations. No task scan,
  // calendar blocks, attestations, customer profiles, or payment enrichment.
  const { start, end } = listReadWindow(new Date())
  const rows = await readPreviewRows<{ id: string; start_time: string; status: string }>(
    db.from('reservations').select('id,start_time,status').eq('site_id', siteId).neq('status', 'cancelled')
      .lt('start_time', end).or(`end_time.is.null,end_time.gt.${start}`)
      .order('start_time', { ascending: false }).order('id', { ascending: true }).limit(PREVIEW_LIMIT), signal,
  )
  return rows.map(row => previewRow(row.id, row.start_time, row.status))
}

export async function shipmentsPreview(input: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  const { siteId, signal } = input
  const db = operationsClient(input)
  const rows = await readPreviewRows<{ id: string; tracking_number: string | null; status: string }>(
    db.from('shipments').select('id,tracking_number,status').eq('site_id', siteId)
      .order('created_at', { ascending: false }).order('id', { ascending: true }).limit(PREVIEW_LIMIT), signal,
  )
  return rows.map(row => previewRow(row.id, row.tracking_number, row.status))
}
import { transferLabel, transferTitle } from '@/app/inventory/movements/transfer-presentation'
import {
  PREVIEW_LIMIT, readPreviewRows, WorkspacePreviewError, type WorkspacePreviewInput, type WorkspacePreviewRow,
} from '@/app/workspace-preview/types'
import { authenticatedOperationsClient, operationsClient, previewRow, requireSelect } from './operations-access'

type Item = { name: string | null }
type Level = { id: string; catalog_items: Item | Item[]; quantity: number }

export async function inventoryPreview(input: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  const { siteId, signal } = input
  const db = operationsClient(input)
  const rows = await readPreviewRows<Level>(db.from('inventory_levels').select('id,quantity,catalog_items!inner(name)')
    .eq('site_id', siteId).eq('catalog_items.site_id', siteId)
    .order('updated_at', { ascending: false }).order('id', { ascending: true }).limit(PREVIEW_LIMIT), signal)
  return rows.map(row => {
    const item = Array.isArray(row.catalog_items) ? row.catalog_items[0] : row.catalog_items
    if (!item || !Number.isFinite(row.quantity)) throw new WorkspacePreviewError()
    return previewRow(row.id, item.name, `On hand: ${row.quantity}`)
  })
}

export async function inventoryTransfersPreview(input: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  const { siteId, signal } = input
  const db = await authenticatedOperationsClient(input)
  await requireSelect(db, input)
  const rows = await readPreviewRows<{ id: string; status: string }>(
    db.from('inventory_transfer_orders').select('id,status').eq('site_id', siteId)
      .order('created_at', { ascending: false }).order('id', { ascending: true }).limit(PREVIEW_LIMIT), signal,
  )
  return rows.map(row => previewRow(row.id, transferTitle(row), transferLabel(row.status)))
}

type Movement = { id: string; item_name: string; kind: string; created_at: string }

export async function inventoryMovementsPreview(input: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  const { siteId, signal } = input
  const db = await authenticatedOperationsClient(input)
  await requireSelect(db, input)
  // The real ledger combines immutable stock events and older movement rows.
  // Split the twelve-row transport budget; this is a sample, never the ledger total.
  const take = Math.floor(PREVIEW_LIMIT / 2)
  const [ledger, events] = await Promise.all([
    readPreviewRows<Movement>(db.from('inventory_movements').select('id,item_name,kind,created_at').eq('site_id', siteId)
      .order('created_at', { ascending: false }).order('id', { ascending: true }).limit(take), signal),
    readPreviewRows<Movement>(db.from('inventory_transfer_stock_events').select('id,item_name,kind:action,created_at').eq('site_id', siteId)
      .order('created_at', { ascending: false }).order('id', { ascending: true }).limit(PREVIEW_LIMIT - take), signal),
  ])
  if (ledger.length > take || events.length > PREVIEW_LIMIT - take) throw new WorkspacePreviewError()
  return [...ledger, ...events].sort((a, b) =>
    Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id),
  ).map(row => previewRow(row.id, row.item_name, row.kind))
}
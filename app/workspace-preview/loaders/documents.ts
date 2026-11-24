import { PREVIEW_LIMIT, readPreviewRows, WorkspacePreviewError, type WorkspacePreviewInput, type WorkspacePreviewRow } from '../types'
import { authenticatedOperationsClient, previewRow, requireSelect, requireSiteRole } from './operations-access'

type Document = { id: string; site_id: string; status: string; created_at: string }
type Bill = Document & { title: string; purchase_date: string }
type Subscription = Document & { plan: { name: string; site_id: string } | null }
type Candidate = { row: WorkspacePreviewRow; created: number; day?: string }

function creationTime(row: Document, siteId: string): number {
  if (!row || row.site_id !== siteId || typeof row.created_at !== 'string') throw new WorkspacePreviewError()
  const time = Date.parse(row.created_at)
  if (!Number.isFinite(time)) throw new WorkspacePreviewError()
  return time
}

// Neither document index orders ties by ID. A timestamp shared by a batch
// import can straddle even the normal page boundary. Use the last candidate
// as a witness, rather than picking an arbitrary member of a truncated tie.
function documentPrefix(candidates: Candidate[]): WorkspacePreviewRow[] {
  let end = candidates.length
  if (end === PREVIEW_LIMIT) {
    const last = candidates[end - 1]
    while (end && candidates[end - 1].day === last.day && candidates[end - 1].created === last.created) end--
    if (!end) throw new WorkspacePreviewError() // Unknown prefix, not an empty list.
  }
  return candidates.slice(0, end).map(candidate => candidate.row)
}

export async function billsPreview(input: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  const { siteId, signal } = input
  const db = await authenticatedOperationsClient(input)
  // purchaseListClient requires user_can(select), not just an effective role.
  await requireSelect(db, input)
  const rows = await readPreviewRows<Bill>(db.from('purchases').select('id,site_id,title,status,purchase_date,created_at')
    .eq('site_id', siteId).order('purchase_date', { ascending: false }).order('created_at', { ascending: false })
    .limit(PREVIEW_LIMIT), signal)
  return documentPrefix(rows.map(row => {
    const created = creationTime(row, siteId)
    if (typeof row.title !== 'string' || typeof row.purchase_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.purchase_date) ||
        !['draft', 'pending', 'completed', 'cancelled'].includes(row.status)) throw new WorkspacePreviewError()
    return { created, day: row.purchase_date, row: previewRow(row.id, row.title, row.status) }
  }))
}

export async function subscriptionsPreview(input: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  const { siteId, signal } = input
  const db = await authenticatedOperationsClient(input)
  // requireAccountingAccess(select): a buyer-visible subscription alone is
  // not a grant to read the seller's index.
  await requireSiteRole(db, input)
  // A left embed keeps a visible subscription even if the plan is hidden.
  // The plan FK is not tenant-composite; never label it with a foreign plan.
  const rows = await readPreviewRows<Subscription>(db.from('subscriptions').select('id,site_id,status,created_at,plan:catalog_items(name,site_id)')
    .eq('site_id', siteId).eq('plan.site_id', siteId).order('created_at', { ascending: false }).limit(PREVIEW_LIMIT), signal)
  return documentPrefix(rows.map(row => {
    const created = creationTime(row, siteId)
    if (!['active', 'paused', 'cancelled', 'expired'].includes(row.status) ||
        (row.plan !== null && (row.plan?.site_id !== siteId || typeof row.plan.name !== 'string'))) throw new WorkspacePreviewError()
    return { created, row: previewRow(row.id, row.plan?.name ?? null, row.status) }
  }))
}
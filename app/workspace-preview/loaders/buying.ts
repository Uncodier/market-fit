import { isDemoModeActive } from '@/lib/demo-utils'
import { PREVIEW_LIMIT, readPreviewRows, WorkspacePreviewError, type WorkspacePreviewInput, type WorkspacePreviewRow } from '../types'
import { authenticatedOperationsClient, previewRow, readAdmission, requireSelect, requireSiteRole } from './operations-access'

function rejectDemo() {
  // The procurement GETs reject even an empty or malformed demo cookie.
  if (isDemoModeActive() || (typeof document !== 'undefined' && /(?:^|;\s*)market_fit_demo_site_id=/.test(document.cookie))) {
    throw new WorkspacePreviewError()
  }
}

type Root = 'suppliers' | 'procurement_requests' | 'procurement_tenders'

async function readBuyingLabels(table: Root, input: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  rejectDemo()
  const { siteId, signal } = input
  const db = await authenticatedOperationsClient(input)

  if (table === 'procurement_requests') {
    // operationalRequestAccess: the index is not manager-only. The table's
    // procurement_request_visible RLS then checks the current revision/approver.
    await requireSiteRole(db, input)
    const restricted = await readAdmission(db.rpc('current_user_has_site_location_restrictions', { p_site_id: siteId }, { get: true }), signal)
    if (restricted !== false) throw new WorkspacePreviewError(restricted === true)
    await requireSelect(db, input)
  } else {
    // These DB predicates enforce the GETs' effective site role, unrestricted
    // location and select capability, including owner/admin for internal tenders.
    // RLS checks them again on the data query. An empty list is not admission.
    const permission = table === 'suppliers'
      ? db.rpc('procurement_supplier_can', { p_site_id: siteId, p_command: 'select' }, { get: true })
      : db.rpc('procurement_tender_access', { p_site: siteId, p_command: 'select' }, { get: true })
    const allowed = await readAdmission(permission, signal)
    if (allowed !== true) throw new WorkspacePreviewError(allowed === false)
  }

  rejectDemo()
  // Reserve room even for the scalar admission results in the response budget.
  const limit = PREVIEW_LIMIT - (table === 'procurement_requests' ? 3 : 1)
  const query = table === 'suppliers'
    // Index-backed sample (site, status, name, id), not a global alphabetical
    // sort of every supplier. No contacts, linked companies or private terms.
    ? db.from(table).select('id,label:name').eq('site_id', siteId).order('status').order('name')
    : db.from(table).select('id,label:title').eq('site_id', siteId).order('updated_at', { ascending: false })
  const rows = await readPreviewRows<{ id: string; label: string }>(query.order('id').limit(limit), signal)
  rejectDemo()
  if (rows.length > limit) throw new WorkspacePreviewError()
  return rows.map(row => {
    if (!row || typeof row.label !== 'string') throw new WorkspacePreviewError()
    return previewRow(row.id, row.label)
  })
}

export function suppliersPreview(input: WorkspacePreviewInput) {
  return readBuyingLabels('suppliers', input)
}

export function purchaseRequestsPreview(input: WorkspacePreviewInput) {
  return readBuyingLabels('procurement_requests', input)
}

export function procurementTendersPreview(input: WorkspacePreviewInput) {
  return readBuyingLabels('procurement_tenders', input)
}
import { DB_EVENT_TABLES } from './types'

export const WORKFLOW_TABLE_OPERATIONS = ['insert', 'update', 'delete'] as const
export type WorkflowTableOperation = (typeof WORKFLOW_TABLE_OPERATIONS)[number]

// Operation availability describes table mutations, not grants or row-level policies.
// 20261027172000_procurement_tenders and 20261027173002_procurement_orders
// install immutable history guards; later lifecycle repairs retain those guards.
// 20261027175000_catalog_procurement makes dated supplier offers append-only.
// 20261027170000_procurement_suppliers requires archival instead of deletion.
const restrictedOperations: Partial<Record<(typeof DB_EVENT_TABLES)[number], readonly WorkflowTableOperation[]>> = {
  catalog_item_suppliers: ['insert'],
  procurement_tender_publications: ['insert'],
  procurement_awards: ['insert'],
  purchase_orders: ['insert'],
  procurement_receipts: ['insert'],
  suppliers: ['insert', 'update'],
}

type TablePresentation = { label: string; group: 'Workspace' | 'Purchasing'; description: string }

const presentations: Record<(typeof DB_EVENT_TABLES)[number], TablePresentation> = {
  leads: { label: 'Leads', group: 'Workspace', description: 'CRM leads' },
  deals: { label: 'Deals', group: 'Workspace', description: 'Sales pipeline deals' },
  conversations: { label: 'Conversations', group: 'Workspace', description: 'Customer conversations' },
  tasks: { label: 'Tasks', group: 'Workspace', description: 'Workspace tasks' },
  quotations: { label: 'Quotations', group: 'Workspace', description: 'Existing shared quotation events; sealed purchasing proposals require a separate integration' },
  reservations: { label: 'Reservations', group: 'Workspace', description: 'Bookings and reservations' },
  content: { label: 'Content', group: 'Workspace', description: 'Content records' },
  sales: { label: 'Sales', group: 'Workspace', description: 'Sales records' },
  suppliers: { label: 'Suppliers', group: 'Purchasing', description: 'Supplier registration and status changes' },
  supplier_contacts: { label: 'Supplier contacts', group: 'Purchasing', description: 'Supplier contact details' },
  catalog_item_suppliers: { label: 'Catalog supplier links', group: 'Purchasing', description: 'Supplier terms and catalog associations' },
  procurement_requests: { label: 'Purchase requests', group: 'Purchasing', description: 'Requisitions and their approval status' },
  procurement_tenders: { label: 'Tenders', group: 'Purchasing', description: 'Sourcing and tender lifecycle' },
  procurement_tender_publications: { label: 'Tender publications', group: 'Purchasing', description: 'Published tender releases' },
  procurement_tender_participants: { label: 'Tender participants', group: 'Purchasing', description: 'Supplier invitations and participation' },
  procurement_event_approvals: { label: 'Purchasing approvals', group: 'Purchasing', description: 'Publication, award and order approval status' },
  procurement_awards: { label: 'Awards', group: 'Purchasing', description: 'Supplier adjudications' },
  purchase_orders: { label: 'Purchase orders', group: 'Purchasing', description: 'Canonical procurement orders, not supplier bills' },
  procurement_receipts: { label: 'Purchase receipts', group: 'Purchasing', description: 'Partial or complete non-stock acceptance' },
  procurement_replenishment_rules: { label: 'Replenishment rules', group: 'Purchasing', description: 'Saved purchasing replenishment rules' },
  procurement_replenishment_cases: { label: 'Replenishment cases', group: 'Purchasing', description: 'Replenishment case lifecycle' },
}

export const WORKFLOW_TABLE_OPTIONS = DB_EVENT_TABLES.map(value => ({
  value,
  ...presentations[value],
  operations: restrictedOperations[value] ?? WORKFLOW_TABLE_OPERATIONS,
  searchText: `${value} ${presentations[value].group}`,
}))

export function getWorkflowTableOperations(table: string): readonly WorkflowTableOperation[] {
  return WORKFLOW_TABLE_OPTIONS.find(option => option.value === table)?.operations ?? []
}

// Only normalize on an explicit edit: saved legacy selections stay visible on load.
export function normalizeWorkflowTableOperations(table: string, operations: readonly WorkflowTableOperation[]): WorkflowTableOperation[] {
  const available = getWorkflowTableOperations(table)
  const retained = [...new Set(operations.filter(operation => available.includes(operation)))]
  return retained.length ? retained : available.slice(0, 1)
}

export function isPurchasingWorkflowTable(table: string) {
  return WORKFLOW_TABLE_OPTIONS.some(option => option.value === table && option.group === 'Purchasing')
}
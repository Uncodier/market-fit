import type { ImportOption, ProcurementOrder, ProcurementQuotation } from '@/app/purchases/procurement/commerce/contracts'
import type { InboxRow } from '@/app/purchases/procurement/approvals/inbox-schema'
import type { EventStage } from '@/app/purchases/procurement/approvals/stage-progress'
import type { WorkspaceOrder } from '@/app/purchases/orders/order-document-data'
import type { QuotationEnvelope } from '@/app/purchases/procurement/commerce/QuotationEnvelopes'

// Explicit presentation fixtures only. Never submitted to a procurement API.
export const demoQuotationEnvelopes: QuotationEnvelope[] = [{
  tender_id: 'demo-tender-sealed', publication_id: 'demo-publication-sealed',
  tender_title: 'Office connectivity upgrade', opening_at: '2027-01-15T18:00:00Z', received_count: 2,
}]

const lines = [
  { id: 'demo-line-onboarding', name: 'Workstation onboarding service', quantity: 20, unit_net_minor: 12000, net_amount_minor: 240000, tax_amount_minor: 19200, received_quantity: 12 },
  { id: 'demo-line-support', name: 'Annual workplace support', quantity: 1, unit_net_minor: 360000, net_amount_minor: 360000, tax_amount_minor: 28800, received_quantity: 0 },
]

export const demoProcurementQuotes: ProcurementQuotation[] = [
  { id: 'demo-quote-northstar', title: 'Workplace technology proposal', reference: 'NS-2026-1042',
    supplier_id: 'demo-supplier-northstar', supplier_name: 'Northstar Technology',
    tender_id: 'demo-tender-workplace', tender_title: 'Workplace technology procurement', publication_id: 'demo-publication-workplace',
    procurement_revision: 1, currency: 'USD', net_amount_minor: 600000, tax_amount_minor: 48000,
    recorded_at: '2026-10-20T09:00:00Z', source: 'supplier_submitted', lines, award_id: null },
  { id: 'demo-quote-summit', title: 'Managed workplace proposal', reference: 'SUM-2026-208',
    supplier_id: 'demo-supplier-summit', supplier_name: 'Summit Solutions',
    tender_id: 'demo-tender-workplace', tender_title: 'Workplace technology procurement', publication_id: 'demo-publication-workplace',
    procurement_revision: 1, currency: 'USD', net_amount_minor: 650000, tax_amount_minor: 52000,
    recorded_at: '2026-10-21T11:00:00Z', source: 'supplier_submitted',
    lines: [{ ...lines[0], unit_net_minor: 14500, net_amount_minor: 290000, tax_amount_minor: 23200 }, lines[1]], award_id: null },
  { id: 'demo-quote-cedar', title: 'Previous workplace support contract', reference: 'CED-2026-087',
    supplier_id: 'demo-supplier-cedar', supplier_name: 'Cedar Services',
    tender_id: 'demo-tender-awarded', tender_title: 'Workplace support renewal', publication_id: 'demo-publication-awarded',
    procurement_revision: 1, currency: 'USD', net_amount_minor: 600000, tax_amount_minor: 48000,
    recorded_at: '2026-10-10T10:00:00Z', source: 'buyer_recorded', lines, award_id: 'demo-award-workplace' },
]

export const demoProcurementOrders: ProcurementOrder[] = [{
  id: 'demo-order-workplace', award_id: 'demo-award-workplace', quotation_id: 'demo-quote-cedar',
  supplier_name: 'Cedar Services', currency: 'USD', net_amount_minor: 600000, tax_amount_minor: 48000,
  created_at: '2026-10-12T09:00:00Z', lines,
}]

export const demoImportOptions: ImportOption[] = [{
  tender_id: 'demo-tender-workplace', publication_id: 'demo-publication-workplace',
  title: 'Workplace technology procurement', currency: 'USD', participation_deadline: '2026-10-22T18:00:00Z',
  suppliers: demoProcurementQuotes.slice(0, 2).map(quote => ({ id: quote.supplier_id, name: quote.supplier_name })),
  requirements: lines.map(line => ({ id: line.id, description: line.name, quantity: line.quantity, unit: 'service' })),
}]

export const demoApprovalInbox: InboxRow[] = [
  { id: 'event:demo-approval-award', target_id: 'demo-quote-northstar', stage: 'award', title: 'Northstar Technology · NS-2026-1042', status: 'pending', revision: 1, date: '2026-10-23T10:00:00Z' },
  { id: 'event:demo-approval-publication', target_id: 'demo-tender-workplace', stage: 'publication', title: 'Workplace technology procurement', status: 'approved', revision: 1, date: '2026-10-15T10:00:00Z' },
  { id: 'event:demo-approval-order', target_id: 'demo-award-workplace', stage: 'order', title: 'Cedar Services · Workplace support renewal', status: 'approved', revision: 1, date: '2026-10-12T09:00:00Z' },
  { id: 'demo-approval-request', target_id: 'demo-request-workplace', stage: 'requisition', title: 'Workplace technology procurement', status: 'approved', revision: 1, date: '2026-10-14T09:00:00Z' },
]

export function demoEventApprovals(targetId: string) {
  return demoApprovalInbox.filter(row => row.target_id === targetId).map(row => ({
    id: row.id.replace(/^event:/, ''), status: row.status, event: row.stage, target_version: row.revision,
    procurement_event_stages: ['Budget owner review', 'Procurement compliance'].map((name, position): EventStage => {
      const approved = row.status === 'approved' || position === 0
      return { id: `${row.id}-stage-${position}`, position, status: approved ? 'approved' : 'pending',
        approval_votes: approved ? 1 : 0, definition: { name, decisionMode: 'human', quorum: { mode: 'first_response' } },
        voters: [{ user_id: `demo-reviewer-${position}`, name: position === 0 ? 'Alex Morgan' : 'Jordan Lee',
          is_owner: position === 0, is_self: false, mandatory: true, decision: approved ? 'approve' : null }] }
    }),
  }))
}

export function demoOrderDocument(siteId: string, id: string): WorkspaceOrder | null {
  const order = demoProcurementOrders.find(item => item.id === id)
  if (!order) return null
  return { id, owner_site_id: siteId, order_number: 'PO-DEMO-2026-001', status: 'approved',
    site: { id: 'demo-supplier-cedar', name: order.supplier_name }, currency: order.currency,
    created_at: order.created_at, subtotal: order.net_amount_minor / 100, tax_total: order.tax_amount_minor / 100,
    total: (order.net_amount_minor + order.tax_amount_minor) / 100,
    notes: 'Fictional demonstration order. Net 30 terms. No payment, inventory movement or supplier notification.',
    items: order.lines.map(line => ({ id: line.id, name: line.name, quantity: line.quantity,
      unit_price: line.unit_net_minor / 100, subtotal: line.net_amount_minor / 100 })),
  }
}
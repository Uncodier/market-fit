import type { RequestDocument, RequestSummary } from '@/app/purchases/requests/schema'
import type { RequestDetailData } from '@/app/purchases/requests/request-detail'
import type { TenderDocument, Tender } from '@/app/purchases/tenders/schema'
import type { TenderDetailData } from '@/app/purchases/tenders/tender-detail'
import type { ResolvedStage } from '@/app/purchases/procurement/domain'

/** Explicit local presentation fixtures, never API responses or authorization evidence. */
export const demoRequestDocument: RequestDocument = {
  title: 'Workplace technology refresh',
  description: 'Provision 20 workstations and secure annual workplace support. Compare qualified suppliers before placing the workplace technology order.',
  currency: 'USD',
  lines: [
    { catalog_item_id: null, description: 'Workstation onboarding service', quantity: 20, unit_estimate_minor: 12000, tax_ids: [] },
    { catalog_item_id: null, description: 'Annual workplace support', quantity: 1, unit_estimate_minor: 360000, tax_ids: [] },
  ],
}
export const demoTenderDocument: TenderDocument = {
  title: 'Workplace technology procurement', description: demoRequestDocument.description,
  request_id: 'demo-request-workplace', currency: 'USD', visibility: 'private', global_visible: false,
  participation: 'invitation_only', opening_policy: 'on_receipt',
  participation_deadline: '2026-10-22T18:00:00Z', opening_at: '2026-10-22T18:00:00Z',
  requirements: demoRequestDocument.lines.map((line, index) => ({
    id: index === 0 ? 'demo-line-onboarding' : 'demo-line-support', description: line.description,
    quantity: line.quantity, unit: 'service', unit_net_minor: line.unit_estimate_minor!, catalog_item_id: null,
  })),
}
const updatedAt = '2026-10-14T09:00:00Z'
export const demoRequestSummaries: RequestSummary[] = [
  { id: 'demo-request-workplace', title: demoRequestDocument.title, description: demoRequestDocument.description,
    currency: 'USD', net_amount_minor: 600000, revision: 1, requester_id: 'Alex Morgan', status: 'approved', updated_at: updatedAt, policy_revision: 1,
    tenders: [{ id: 'demo-tender-workplace', title: demoTenderDocument.title, status: 'published' }] },
  { id: 'demo-request-onboarding', title: 'New starter accessories', description: 'Headsets and keyboards for the next onboarding cohort.', currency: 'USD', net_amount_minor: 240000, revision: 1, requester_id: 'Alex Morgan', status: 'submitted', updated_at: updatedAt, policy_revision: 1, tenders: [] },
  { id: 'demo-request-meeting', title: 'Meeting room technology', description: 'Preview a draft request for a small meeting room.', currency: 'USD', net_amount_minor: 180000, revision: 1, requester_id: 'Alex Morgan', status: 'draft', updated_at: updatedAt, policy_revision: null, tenders: [] },
]
export const demoTenderSuppliers = [
  { id: 'demo-supplier-northstar', name: 'Northstar Technology' },
  { id: 'demo-supplier-summit', name: 'Summit Solutions' },
  { id: 'demo-supplier-cedar', name: 'Cedar Services' },
]
export function getDemoTenders(siteId: string): Tender[] {
  return [
    { ...demoTenderDocument, id: 'demo-tender-workplace', site_id: siteId, version: 1, status: 'published', portal_slug: 'workplace-technology', net_amount_minor: 600000, created_by: 'Alex Morgan', updated_at: updatedAt },
    { ...demoTenderDocument, id: 'demo-tender-meeting', title: 'Meeting room sourcing draft', request_id: null, site_id: siteId, version: 1, status: 'draft', portal_slug: 'meeting-room', net_amount_minor: 180000, requirements: [{ ...demoTenderDocument.requirements[1], description: 'Meeting room setup', unit_net_minor: 180000 }], created_by: 'Alex Morgan', updated_at: updatedAt },
    { ...demoTenderDocument, id: 'demo-tender-awarded', title: 'Workplace support renewal', request_id: null, site_id: siteId, version: 1, status: 'closed', portal_slug: 'workplace-award', net_amount_minor: 600000, participation_deadline: '2026-10-11T18:00:00Z', opening_at: '2026-10-11T18:00:00Z', created_by: 'Alex Morgan', updated_at: updatedAt },
    { ...demoTenderDocument, id: 'demo-tender-sealed', title: 'Office connectivity upgrade', description: 'Source office connectivity installation and annual support. Supplier proposals remain sealed until the scheduled opening.', request_id: null, site_id: siteId, version: 1, status: 'published', visibility: 'public', global_visible: true, participation: 'open', portal_slug: 'demo-tender-sealed', net_amount_minor: 600000, opening_policy: 'after_close', participation_deadline: '2027-01-15T18:00:00Z', opening_at: '2027-01-15T18:00:00Z', requirements: [{ ...demoTenderDocument.requirements[0], description: 'Office network installation', quantity: 20 }, { ...demoTenderDocument.requirements[1], description: 'Annual network support' }], created_by: 'Alex Morgan', updated_at: updatedAt },
  ]
}
export function getDemoRequestDetail(_siteId: string, id: string): RequestDetailData | null {
  const request = demoRequestSummaries.find(row => row.id === id)
  if (!request) return null
  const primary = id === 'demo-request-workplace'
  const lines = primary ? demoRequestDocument.lines : [{ catalog_item_id: null, description: request.title, quantity: 1, unit_estimate_minor: request.net_amount_minor }]
  const stages: ResolvedStage[] = ['IT security review', 'Finance budget approval'].map((name, index) => ({
    id: `demo-stage-${index}`, name, decisionMode: 'human', approverIds: [index ? 'Jordan Lee' : 'Taylor Reed'], mandatoryApproverIds: [], quorum: { mode: 'all' }, rejectionBehavior: 'veto', execution: 'sequential', allowSelfApproval: false, delegatedAgentId: null, deadline: null, timeoutAction: 'block', escalationIds: [], sourceRuleId: 'demo-policy-workplace', sourceRuleVersion: 1, resolvedDeadline: null,
  }))
  return {
    request: { ...request, resolved_plan: request.status === 'draft' ? null : { simulationOnly: true, authorized: false, status: 'ready', source: 'rules', matchedRuleIds: ['demo-policy-workplace'], stages, requirements: [], minimumSupplierProposals: 2, crossRuleCounting: 'shared', issues: [], explanations: ['Local demonstration of workplace purchasing policy.'] } },
    actor_id: 'Demo viewer', can_manage: true,
    items: lines.map((line, index) => ({ id: `demo-request-line-${index}`, revision: 1, position: index, catalog_item_id: null, category_ids: [], description: line.description, quantity: line.quantity, unit_net_minor: line.unit_estimate_minor ?? null, net_amount_minor: line.quantity * (line.unit_estimate_minor ?? 0), valuation_source: 'manager_estimate', tax_snapshot: [] })),
    stages: request.status === 'draft' ? [] : stages.map((definition, index) => ({ id: definition.id, revision: 1, definition, status: primary ? 'approved' : 'pending', decisions: primary ? [{ id: `demo-decision-${index}`, actor_id: definition.approverIds[0], decision: 'approve', reason: index ? 'Budget confirmed for the technology refresh.' : 'Security and device requirements verified.', created_at: updatedAt }] : [] })),
    audit: [{ id: 'demo-audit-created', event: 'created', actor_id: request.requester_id, revision: 1, created_at: '2026-10-01T09:00:00Z', snapshot: { title: request.title } }, ...(primary ? [{ id: 'demo-audit-approved', event: 'approved', actor_id: 'Jordan Lee', revision: 1, created_at: updatedAt, snapshot: { status: 'approved', currency: 'USD', net_amount_minor: request.net_amount_minor } }] : [])],
  }
}
export function getDemoTenderDetail(siteId: string, id: string): TenderDetailData | null {
  const tender = getDemoTenders(siteId).find(row => row.id === id)
  if (!tender) return null
  const published = tender.status !== 'draft'
  const awarded = id === 'demo-tender-awarded'
  const publicationId = awarded ? 'demo-publication-awarded' : id === 'demo-tender-sealed' ? 'demo-publication-sealed' : 'demo-publication-workplace'
  const suppliers = awarded ? demoTenderSuppliers.slice(2) : demoTenderSuppliers
  return {
    tender: { ...tender, portal_slug: tender.id }, site_slug: 'demo-procurement', portal_enabled: false, publication_pending: false,
    publications: published ? [{ id: publicationId, version: 1, published_at: awarded ? '2026-10-08T10:00:00Z' : '2026-10-15T10:00:00Z', snapshot: { title: tender.title, description: tender.description, currency: tender.currency, participation: tender.participation, opening_policy: tender.opening_policy, requirements: tender.requirements, participation_deadline: tender.participation_deadline, opening_at: tender.opening_at } }] : [],
    participants: published ? suppliers.map((supplier, index) => ({ id: `demo-participant-${index}`, supplier_id: supplier.id, status: index === 2 ? 'invited' : 'accepted', suppliers: { name: supplier.name } })) : [],
    receipt_activity: published ? (awarded ? [1] : [1, 2]).map(number => ({ receipt_number: number, received_at: awarded ? '2026-10-10T10:00:00Z' : number === 1 ? '2026-10-20T09:00:00Z' : '2026-10-21T11:00:00Z', publication_id: publicationId, publication_version: 1 })) : [],
  }
}
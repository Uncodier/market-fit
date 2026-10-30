import type { Supplier } from '@/app/suppliers/schema'
import { policyDocumentSchema, type Timing, type ApprovalStage } from '@/app/purchases/procurement/domain'

// Fictional, local presentation fixtures. Never sent to procurement APIs.
export const demoProcurementReferences: Record<string, { id: string; label: string }[]> = {
  companies: [
    { id: 'demo-company-northstar', label: 'Northstar Workplace Technology LLC' },
    { id: 'demo-company-summit', label: 'Summit Office Systems Inc.' },
    { id: 'demo-company-cedar', label: 'Cedar IT Services LLC' },
  ],
  categories: [{ id: 'demo-category-workplace', label: 'Workplace technology' }],
  products: [
    { id: 'demo-product-onboarding', label: 'Workplace technology onboarding' },
    { id: 'demo-product-adapters', label: 'USB-C workplace adapters' },
    { id: 'demo-product-cables', label: 'Workplace network cables' },
  ],
  people: [
    { id: 'demo-person-morgan', label: 'Morgan Ellis · Procurement manager' },
    { id: 'demo-person-jordan', label: 'Jordan Lee · Finance controller' },
    { id: 'demo-person-alex', label: 'Alex Rivera · IT operations lead' },
  ],
  agents: [{ id: 'demo-agent-evidence', label: 'Evidence review assistant' }],
  locations: [{ id: 'demo-location-hq', label: 'Austin headquarters' }, { id: 'demo-location-office', label: 'Workplace office' }],
}

export function demoSuppliers(siteId: string): Supplier[] {
  return [
    { id: 'demo-supplier-northstar', name: 'Northstar Technology', status: 'approved',
      company_id: 'demo-company-northstar', version: 3,
      commercial_terms: 'USD · Net 30 after acceptance. $6,000 net: onboarding for 20 employees at $120 each plus $3,600 annual support. Tax 8%. Quote pending review for the workplace technology tender.',
      private_notes: 'Preferred workplace technology partner. Security and service evidence reviewed by Alex Rivera. Proposal received; award has not yet been decided.',
      contacts: [{ name: 'Taylor Brooks', email: 'taylor@northstar.example', phone: '+1 512 555 0142', role: 'Account director', is_primary: true },
        { name: 'Casey Chen', email: 'delivery@northstar.example', phone: '+1 512 555 0153', role: 'Deployment coordinator', is_primary: false }] },
    { id: 'demo-supplier-summit', name: 'Summit Solutions', status: 'under_review',
      company_id: 'demo-company-summit', version: 2,
      commercial_terms: 'USD · Net 30. Alternative workplace onboarding and annual support proposal under evaluation. Remote deployment and service desk coverage included.',
      private_notes: 'Alternate bidder for the workplace technology tender. Service-level evidence renewal is under review; no award or purchase order yet.',
      contacts: [{ name: 'Riley Adams', email: 'riley@summit.example', phone: '+1 303 555 0116', role: 'Enterprise sales', is_primary: true }] },
    { id: 'demo-supplier-cedar', name: 'Cedar Services', status: 'approved',
      company_id: 'demo-company-cedar', version: 3,
      commercial_terms: 'USD · Net 30. Awarded onboarding and annual support contract: $6,000 net, $480 tax, $6,480 total. 20 onboarding seats and one annual support package.',
      private_notes: 'Awarded the prior workplace technology rollout. Purchase order is linked to the accepted Cedar quotation. Insurance and service coverage reviewed; delivery evidence tracked with the order.',
      contacts: [{ name: 'Jamie Patel', email: 'jamie@cedar.example', phone: '+1 737 555 0184', role: 'Service delivery lead', is_primary: true }] },
  ].map(supplier => ({ ...supplier, status: supplier.status as Supplier['status'], site_id: siteId,
    category_ids: ['demo-category-workplace'], created_at: '2026-10-05T09:00:00Z', updated_at: '2026-10-29T16:00:00Z' }))
}

export function demoSupplierActivity(id: string) {
  if (!demoSuppliers('demo').some(supplier => supplier.id === id)) return []
  const review = { version: 2, action: 'updated', previous_status: 'prospect', status: 'under_review', created_at: '2026-10-15T14:30:00Z' }
  return [
    ...(id === 'demo-supplier-summit' ? [] : [{ version: 3, action: 'updated', previous_status: 'under_review', status: 'approved', created_at: '2026-10-29T16:00:00Z' }]),
    review, { version: 1, action: 'created', previous_status: null, status: 'prospect', created_at: '2026-10-05T09:00:00Z' },
  ]
}

const duration = (value: number, anchor: 'publication' | 'stage_activation' = 'publication'): Timing => ({
  kind: 'duration', value, unit: 'days', anchor, calendar: 'calendar', businessCalendarId: null, timeZone: 'America/Chicago',
})
const stage = (id: string, name: string, approverId: string): ApprovalStage => ({
  id, name, decisionMode: 'human', approverIds: [approverId], mandatoryApproverIds: [approverId],
  quorum: { mode: 'all' }, rejectionBehavior: 'return_for_correction', execution: 'sequential',
  allowSelfApproval: false, delegatedAgentId: null, deadline: duration(2, 'stage_activation'),
  timeoutAction: 'escalate', escalationIds: ['demo-person-morgan'],
})

export function demoProcurementPolicy() {
  return policyDocumentSchema.parse({ version: 1, settings: {
    timeZone: 'America/Chicago', crossRuleCounting: 'independent',
    fallback: { mode: 'approval', stages: [stage('demo-stage-manager', 'Procurement manager review', 'demo-person-morgan')] },
    supervisorId: 'demo-person-morgan', substituteIds: ['demo-person-jordan'],
    visibility: 'private', allowGlobalListing: false, participation: 'approved_suppliers', offerOpening: 'after_close',
    timings: { tenderResponse: duration(14), clarification: duration(7), offerValidity: duration(30), approval: duration(2, 'stage_activation') },
    exceptions: [{ kind: 'insufficient_offers', enabled: true, aiRecommendation: true, decisionAuthority: 'supervisor',
      allowedActions: ['extend', 'invite_suppliers'], justificationRequired: true }],
    urgentPreset: { enabled: true, responseTiming: duration(2), notifyPreviousEligibleSuppliers: true,
      minimumSupplierProposals: 2, decisionMode: 'human', preserveMandatoryRequirements: true },
    rejectionNotifications: { notifyRequester: true, notifyParticipants: true, recipientIds: ['demo-person-alex'] },
  }, rules: [
    { id: 'demo-rule-finance', name: 'Finance review above $5,000', status: 'active', type: 'approval', event: 'order',
      description: 'Net USD commitments require IT validation followed by finance approval before issuing an order.',
      amount: { operator: 'gte', valueMinor: 500000, currency: 'USD', basis: 'document' },
      stages: [stage('demo-stage-it', 'IT specification sign-off', 'demo-person-alex'), stage('demo-stage-finance', 'Budget and payment approval', 'demo-person-jordan')] },
    { id: 'demo-rule-evidence', name: 'Workplace technology evidence', status: 'active', type: 'requirements', event: 'award',
      description: 'Service coverage, security and deployment documentation must be reviewed before award.',
      scope: { categoryIds: ['demo-category-workplace'] }, requirements: [
        { id: 'demo-requirement-warranty', name: 'Annual support coverage and deployment plan', kind: 'document', classification: 'mandatory', milestone: 'award', overridable: false },
        { id: 'demo-requirement-security', name: 'Information security certification', kind: 'certification', classification: 'mandatory', milestone: 'award', overridable: false,
          credential: { holder: 'organization', validity: 'contract_period', acceptedEquivalentIds: [], evidenceRequired: true, review: 'ai_assisted' } },
      ] },
    { id: 'demo-rule-competition', name: 'Competitive sourcing above $5,000', status: 'active', type: 'supplier_participation', event: 'award',
      description: 'Collect at least two eligible supplier proposals. Missing offers require a justified supervisor exception.',
      amount: { operator: 'gte', valueMinor: 500000, currency: 'USD', basis: 'document' }, minimumSupplierProposals: 2 },
    { id: 'demo-rule-renewal', name: 'Annual supplier renewal review', status: 'draft', type: 'requirements', event: 'offer',
      description: 'Draft for next quarter: refresh insurance and service-level evidence before accepting renewal offers.' },
  ] })
}
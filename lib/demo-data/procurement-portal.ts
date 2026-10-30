import type { PublicTenderRow } from '@/app/tenders/public-data'
import type { Opportunity, SavedDraft, Submission } from '@/app/home/submissions/types'
import type { Credential } from '@/app/purchases/procurement/evidence/schema'
import { getDemoTenders } from './procurement-workflow'

// Presentation-only fixtures; demo IDs must never be sent to backend APIs.
export const demoTenderSite = { slug: 'demo-procurement', portalSlug: 'demo-procurement', name: 'Acme Workplace', logoUrl: null }
export const demoPublicTenders: PublicTenderRow[] = getDemoTenders('demo-procurement')
  .filter(tender => tender.status !== 'draft')
  .map(tender => ({
    site_slug: demoTenderSite.slug, site_name: demoTenderSite.name, tender_slug: tender.id,
    publication_id: tender.id === 'demo-tender-awarded' ? 'demo-publication-awarded' : tender.id === 'demo-tender-sealed' ? 'demo-publication-sealed' : 'demo-publication-workplace',
    version: 1, status: tender.status, published_at: tender.id === 'demo-tender-awarded' ? '2026-10-08T10:00:00Z' : '2026-10-15T10:00:00Z',
    snapshot: { title: tender.title, description: tender.description, currency: tender.currency,
      participation: tender.participation, opening_policy: tender.opening_policy,
      participation_deadline: tender.participation_deadline, opening_at: tender.opening_at,
      requirements: tender.requirements.map(({ id, description, quantity, unit }) => ({ id, description, quantity, unit })) },
    facets: { regions: [{ value: 'US', label: 'United States' }], categories: [{ value: 'technology', label: 'Technology services' }] },
  }))

export function demoTenderRows(siteSlug?: string, tenderSlug?: string, page = 0, search = '') {
  if (!Number.isSafeInteger(page) || page < 0 || search.length > 200) return []
  return demoPublicTenders.filter(row => (!siteSlug || row.site_slug === siteSlug)
    && (!tenderSlug || row.tender_slug === tenderSlug)
    && `${row.snapshot.title} ${row.snapshot.description} ${row.site_name}`.toLowerCase().includes(search.toLowerCase()))
    .slice(page * 25, (page + 1) * 25)
}

export const demoPortalOpportunities: Opportunity[] = demoPublicTenders.filter(row => row.status !== 'closed').map(row => ({
  site_id: 'demo-procurement', supplier_id: 'demo-supplier-northstar', supplier_name: 'Northstar Technology',
  tender_id: row.tender_slug, publication_id: row.publication_id, version: row.version,
  visibility: 'public', directly_invited: true, ...row.snapshot,
}))
export const demoPortalDrafts: SavedDraft[] = [{ publication_id: 'demo-publication-workplace', publication_version: 1,
  applicant_key: 'demo-supplier-northstar', updated_at: '2026-10-19T14:00:00Z', draft_revision: 1,
  reference: 'NS-2026-1042-DRAFT', attempted: false, opportunity: demoPortalOpportunities[0], can_resume: true }]
export const demoPortalSubmissions: Submission[] = [{ id: 'demo-quote-northstar', reference: 'NS-2026-1042',
  tender_title: 'Workplace technology procurement', currency: 'USD', net_amount_minor: 600000, tax_amount_minor: 48000, submitted_at: '2026-10-20T09:00:00Z' }]

export const demoPortalCredentials: Credential[] = [{ id: 'demo-credential-professional', version: 2, archived_at: null,
  revisions: [2, 1].map(revision => ({ id: `demo-credential-revision-${revision}`, credential_id: 'demo-credential-professional', revision,
    metadata: { holder_kind: 'person', holder_name: 'Alex Morgan', title: 'Workplace technology professional certificate',
      type: 'professional_license', issuer: 'Example Technology Institute', reference: `DEMO-CERT-${revision}`,
      scope: 'Workstation configuration and technical support. Fictional credential, not independently verified.',
      issued_on: '2026-01-15', expires_on: '2027-01-15', non_expiring: false },
    original_name: `example-professional-certificate-v${revision}.pdf`, mime_type: 'application/pdf', byte_size: 131072,
    created_at: `2026-10-${revision === 2 ? '18' : '10'}T09:00:00Z`, state: 'ready' })) }]
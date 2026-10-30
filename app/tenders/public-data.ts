import { createClient } from '@/lib/supabase/server'
import type { PublicTender } from '@/app/purchases/tenders/schema'
import { loadTenderSiteIdentities } from './site-identity'
import { loadTenderListingFacets } from './load-listing-facets'
import type { TenderFacets } from './listing-facets'
import { isProcurementPortalDemo } from './demo-mode'
import { demoTenderRows } from '@/lib/demo-data/procurement-portal'
export type PublicTenderRow = { site_slug: string; site_name?: string; site_logo_url?: string | null; tender_slug: string; publication_id: string; version: number; status: string; published_at: string; snapshot: PublicTender; facets?: TenderFacets }
export const participationClosed = (row: PublicTenderRow) => row.status === 'closed' || Date.parse(row.snapshot.participation_deadline) <= Date.now()
export async function loadPublicTenders(siteSlug?: string, tenderSlug?: string, page = 0, search = '') {
  if (await isProcurementPortalDemo()) return { rows: demoTenderRows(siteSlug, tenderSlug, page, search), error: null, demo: true }
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000 || search.length > 200 || (siteSlug && !/^[a-z0-9][a-z0-9-]{2,79}$/.test(siteSlug)) || (tenderSlug && !/^[0-9a-f-]{36}$/.test(tenderSlug))) return { rows: [], error: 'Invalid tender filters.' }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('public_procurement_tenders', { p_site_slug: siteSlug ?? null, p_tender_slug: tenderSlug ?? null, p_page: page, p_search: search })
    if (error) return { rows: [], error: 'Tender publications are temporarily unavailable.' }
    const rows = (data ?? []) as PublicTenderRow[]
    const [identities, facets] = await Promise.all([
      loadTenderSiteIdentities(rows.map(row => row.site_slug)),
      loadTenderListingFacets(rows),
    ])
    return { rows: rows.map(row => {
      const site = identities.get(row.site_slug)
      const enriched = facets.has(row.publication_id) ? { ...row, facets: facets.get(row.publication_id) } : row
      return site ? { ...enriched, site_slug: site.slug, site_name: site.name, site_logo_url: site.logoUrl ?? null } : enriched
    }), error: null }
  } catch { return { rows: [], error: 'Tender publications are temporarily unavailable.' } }
}
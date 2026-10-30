import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { loadMarketplaceAreas } from '@/app/marketplace/load-marketplace-regions'
import { marketplaceCountry } from '@/app/marketplace/marketplace-product-filters'
import type { PublicTenderRow } from './public-data'
import type { TenderFacet, TenderFacets } from './listing-facets'

type Publication = { id: string; site_id: string; tender_id: string; version: number }
type Line = { id?: string; catalog_item_id?: string | null }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Server-only: call exclusively with the bounded rows authorized by public_procurement_tenders.
 * Never accept publication IDs from request parameters or serialize raw audit/catalog/location rows.
 */
export async function loadTenderListingFacets(rows: PublicTenderRow[]): Promise<Map<string, TenderFacets>> {
  if (!rows.length) return new Map()
  const client = await createServiceClient(true, { access: 'public' })
  const result = await client.from('procurement_tender_publications').select('id,site_id,tender_id,version')
    .in('id', rows.map(row => row.publication_id))
  if (result.error) throw new Error('Tender publications are temporarily unavailable.')
  const publications = (result.data as Publication[] ?? []).filter(publication =>
    rows.some(row => row.publication_id === publication.id && row.version === publication.version))
  const [areas, categories] = await Promise.all([
    loadMarketplaceAreas(client, publications.map(row => ({ id: row.id, site_id: row.site_id, created_at: '' }))),
    Promise.all(publications.map(async (publication): Promise<TenderFacet[]> => {
      // The saved revision is immutable. The current tender may already contain unpublished edits.
      const audit = await client.from('procurement_tender_audit').select('snapshot')
        .eq('site_id', publication.site_id).eq('tender_id', publication.tender_id)
        .eq('version', publication.version).eq('event', 'saved').limit(1).maybeSingle()
      if (audit.error) throw new Error('Tender publications are temporarily unavailable.')
      const published = rows.find(row => row.publication_id === publication.id)!
      const lines = audit.data?.snapshot?.requirements
      const ids = Array.isArray(lines) ? [...new Set((lines as Line[]).filter(line =>
        published.snapshot.requirements.some(requirement => requirement.id === line.id))
        .flatMap(line => typeof line.catalog_item_id === 'string' && uuid.test(line.catalog_item_id) ? [line.catalog_item_id] : []))] : []
      if (!ids.length) return []
      const items = await client.from('catalog_items').select('category_id').eq('site_id', publication.site_id)
        .in('id', ids).eq('status', 'active')
      if (items.error) throw new Error('Tender publications are temporarily unavailable.')
      const categoryIds = [...new Set(((items.data ?? []) as { category_id: string | null }[]).flatMap(item => item.category_id ? [item.category_id] : []))]
      if (!categoryIds.length) return []
      const categories = await client.from('catalog_categories').select('id,name').eq('site_id', publication.site_id)
        .in('id', categoryIds).eq('status', 'active')
      if (categories.error) throw new Error('Tender publications are temporarily unavailable.')
      // Same-named categories in different buyer catalogs share a discovery facet, not an internal ID.
      return ((categories.data ?? []) as { id: string; name: string }[]).flatMap(category => {
        const label = typeof category.name === 'string' ? category.name.trim() : ''
        return label ? [{ value: label.normalize('NFKC').toLowerCase(), label }] : []
      })
    })),
  ])
  return new Map(publications.map((publication, index) => {
    const regions: TenderFacet[] = (areas.get(publication.site_id) ?? []).flatMap(area => {
      const country = marketplaceCountry(area.country)
      return country ? [{ value: country.country, label: country.label }] : []
    })
    return [publication.id, {
      regions: [...new Map(regions.map(region => [region.value, region])).values()],
      categories: [...new Map(categories[index].map(category => [category.value, category])).values()],
    }]
  }))
}
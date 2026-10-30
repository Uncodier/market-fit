import { getEntitlementExperiencePath } from '@/app/buyer/experience-routes'
import { demoAccountDetailPath } from '../demo-commerce'
import type { SearchCollection, SearchRow } from './types'

type RecordRow = {
  id?: string; name?: string; order_number?: string; reference?: string; status?: string;
  description?: string; created_at?: string; start_time?: string; site?: { id?: string; name?: string } | null;
  catalog_item?: { id?: string; name?: string; description?: string; digital_subtype?: string } | null;
  sale_order_items?: { name?: string; catalog_item?: { name?: string } | null }[];
  tender_title?: string; publication_id?: string; applicant_key?: string; supplier_name?: string;
  title?: string; opportunity?: { title?: string } | null;
  snapshot?: { title?: string; description?: string }; site_slug?: string; tender_slug?: string;
  revisions?: { metadata: { title: string; issuer: string; reference: string; holder_name: string; scope: string }; original_name: string }[];
}

export function normalizeSearchRows(collection: SearchCollection, data: RecordRow[], demo = false): SearchRow[] {
  return data.map(row => {
    const recordId = row.id ?? `${row.publication_id}:${row.applicant_key ?? row.supplier_name ?? ''}`
    let title = row.title ?? row.name ?? row.reference ?? row.order_number ?? row.catalog_item?.name ?? recordId
    let description = [row.site?.name, row.description, row.catalog_item?.description, row.tender_title,
      row.supplier_name, row.opportunity?.title, row.catalog_item?.digital_subtype,
      ...(row.sale_order_items ?? []).map(item => item.name ?? item.catalog_item?.name)].filter(Boolean).join(' · ')
    let href = `/home/${collection}`
    if (collection === 'orders' || collection === 'quotes') href = `/buyer/${collection}/${encodeURIComponent(recordId)}`
    if (collection === 'subscriptions') href = row.site?.id && row.catalog_item?.id
      ? `/shop/${encodeURIComponent(row.site.id)}/${encodeURIComponent(row.catalog_item.id)}` : '/home/subscriptions'
    if (collection === 'library') href = getEntitlementExperiencePath({ id: recordId, catalog_item: row.catalog_item }) ?? '/home/library'
    if (collection === 'reservations') { title = row.catalog_item?.name ?? 'Reservation'; description += ` · ${row.start_time ?? ''}`; href = `/buyer/reservations/${encodeURIComponent(recordId)}` }
    if (collection === 'businesses') href = '/projects?manage=1'
    if (collection === 'credentials') {
      const revision = row.revisions?.[0]
      title = revision?.metadata.title ?? recordId
      description = revision ? Object.values(revision.metadata).join(' · ') + ` · ${revision.original_name}` : ''
      href = '/home/profile'
    }
    if (['drafts', 'submissions', 'opportunities'].includes(collection)) href = '/home/submissions'
    if (collection === 'products') href = `/marketplace/${encodeURIComponent(recordId)}`
    if (collection === 'tenders') {
      title = row.snapshot?.title ?? recordId; description = row.snapshot?.description ?? ''
      href = `/tenders/${encodeURIComponent(row.site_slug ?? '')}/${encodeURIComponent(row.tender_slug ?? '')}`
    }
    if (demo && ['orders', 'quotes', 'subscriptions', 'library', 'reservations'].includes(collection)) href = demoAccountDetailPath(collection, recordId)
    return { id: `${collection}:${recordId}`, collection, title, description, status: row.status ?? '', href }
  })
}
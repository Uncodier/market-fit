import { TenderDirectoryView } from './directory-view'
import { loadPublicTenders, participationClosed } from './public-data'
export async function TenderDirectory({ siteSlug, siteName, portalSlug, page, search }: { siteSlug?: string; siteName?: string; portalSlug?: string; page: number; search: string }) {
  const result = await loadPublicTenders(portalSlug ?? siteSlug, undefined, page, search)
  return <TenderDirectoryView siteSlug={siteSlug} siteName={siteName} page={page} search={search} rows={result.rows} error={result.error}
    demo={result.demo} closedIds={result.rows.filter(participationClosed).map(row => row.publication_id)} />
}
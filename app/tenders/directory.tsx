import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { EmptyTenders } from './empty-tenders'
import { TenderListing } from './tender-listing'
import { TenderHeader, TenderFooter } from './public-header'
import { loadPublicTenders, participationClosed } from './public-data'
export async function TenderDirectory({ siteSlug, page, search }: { siteSlug?: string; page: number; search: string }) {
  const result = await loadPublicTenders(siteSlug, undefined, page, search)
  const base = siteSlug ? `/tenders/${siteSlug}` : '/tenders'
  const href = (next: number) => `${base}?page=${next}&search=${encodeURIComponent(search)}`
  return <div className="flex flex-col min-h-screen bg-background"><TenderHeader key={search} siteSlug={siteSlug} search={search} /><main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12 space-y-8">
    <header className="space-y-3"><nav aria-label="Tender navigation" className="flex gap-3 text-sm text-muted-foreground"><Link className="hover:underline" href="/marketplace">Marketplace</Link><span>/</span><Link className="hover:underline" href="/tenders">Tenders</Link>{siteSlug && <><span>/</span><span>{siteSlug}</span></>}</nav><h1 className="text-2xl md:text-3xl font-bold tracking-tight">{siteSlug ? `${siteSlug} tenders` : 'Discover procurement opportunities'}</h1><p className="text-sm text-muted-foreground">Browse published requirements and participation dates. Global discovery includes only explicitly opted-in public publications.</p></header>
    {result.error ? <div role="alert" className="space-y-3 py-8"><h2 className="text-lg font-semibold">Unable to load published tenders</h2>
      <p>{result.error}</p><Button variant="outline" asChild><Link href={href(page)}>Retry</Link></Button>
    </div> : <>
      {!result.rows.length ? <EmptyTenders href={base} /> : <TenderListing key={`${page}:${search}`} rows={result.rows} closedIds={result.rows.filter(participationClosed).map(row => row.publication_id)} />}
      <nav aria-label="Tender pages" className="flex items-center justify-center gap-4">{page > 0 && <Button variant="outline" asChild><Link href={href(page - 1)}>Previous</Link></Button>}<span className="text-sm">Page {page + 1}</span>{result.rows.length === 25 && <Button variant="outline" asChild><Link href={href(page + 1)}>Next</Link></Button>}</nav>
    </>}
  </main><TenderFooter /></div>
}
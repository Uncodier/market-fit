import { TenderDetailView } from '../../detail-view'
import { notFound, redirect } from 'next/navigation'
import { loadPublicTenders, participationClosed } from '../../public-data'
import { loadTenderSiteIdentity } from '../../site-identity'
export const dynamic = 'force-dynamic'
export default async function Page({ params, searchParams }: {
  params: Promise<{ siteSlug: string; tenderSlug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const route = await params
  const site = await loadTenderSiteIdentity(route.siteSlug)
  if (!site) notFound()
  if (route.siteSlug !== site.slug) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(await searchParams ?? {})) {
      if (Array.isArray(value)) value.forEach(entry => query.append(key, entry))
      else if (value !== undefined) query.set(key, value)
    }
    const encoded = query.toString()
    const suffix = encoded ? `?${encoded}` : ''
    redirect(`/tenders/${site.slug}/${encodeURIComponent(route.tenderSlug)}${suffix}`)
  }
  const result = await loadPublicTenders(site.portalSlug, route.tenderSlug)
  if (result.error) return <TenderDetailView {...route} error={result.error} />
  const tender = result.rows[0]
  if (!tender) notFound()
  return <TenderDetailView {...route} demo={result.demo} tender={{ ...tender, site_name: site.name }} closed={participationClosed(tender)} />
}
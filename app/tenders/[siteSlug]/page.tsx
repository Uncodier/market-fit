import { TenderDirectory } from '../directory'
import { notFound, redirect } from 'next/navigation'
import { loadTenderSiteIdentity } from '../site-identity'
export const dynamic = 'force-dynamic'
export default async function Page({ params, searchParams }: { params: Promise<{ siteSlug: string }>; searchParams: Promise<{ page?: string; search?: string }> }) {
  const [route, query] = await Promise.all([params, searchParams])
  const site = await loadTenderSiteIdentity(route.siteSlug)
  if (!site) notFound()
  if (route.siteSlug !== site.slug) {
    const filters = new URLSearchParams()
    if (query.page !== undefined) filters.set('page', query.page)
    if (query.search !== undefined) filters.set('search', query.search)
    const suffix = filters.toString()
    redirect(`/tenders/${site.slug}${suffix ? `?${suffix}` : ''}`)
  }
  return <TenderDirectory siteSlug={site.slug} siteName={site.name} portalSlug={site.portalSlug} page={Number(query.page ?? '0')} search={query.search ?? ''} />
}
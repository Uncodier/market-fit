import { TenderDirectory } from '../directory'
export const dynamic = 'force-dynamic'
export default async function Page({ params, searchParams }: { params: Promise<{ siteSlug: string }>; searchParams: Promise<{ page?: string; search?: string }> }) {
  const [route, query] = await Promise.all([params, searchParams])
  return <TenderDirectory siteSlug={route.siteSlug} page={Number(query.page ?? '0')} search={query.search ?? ''} />
}
import { TenderDirectory } from './directory'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const query = await searchParams
  return <TenderDirectory page={Number(query.page ?? '0')} search={query.search ?? ''} />
}
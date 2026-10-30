import { Suspense } from 'react'
import { SearchView } from './search-view'

export default async function SearchPage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q : ''
  return <Suspense><SearchView initialQuery={query} /></Suspense>
}
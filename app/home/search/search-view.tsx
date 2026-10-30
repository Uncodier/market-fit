'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { AccountSearch, AccountSubheader } from '@/app/buyer/components/AccountSearch'
import { DocumentTable } from '@/app/purchases/procurement/commerce/document-ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { Button } from '@/app/components/ui/button'
import { Alert, AlertDescription } from '@/app/components/ui/alert'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { Search, ArrowLeft } from '@/app/components/ui/icons'
import { StatusDot } from '@/app/components/documents/document-list'
import { usePortalDemo } from '../demo-context'
import { loadSearchSources } from './load-sources'
import { demoSearchSources } from './demo-sources'
import { filterSearchRows, searchCollections, searchHref, type SearchCollection } from './types'

const labels: Record<SearchCollection, string> = {
  orders: 'Purchases', quotes: 'Quotations', subscriptions: 'Subscriptions', library: 'Library',
  reservations: 'Reservations', businesses: 'Businesses', credentials: 'Credentials', submissions: 'Submissions',
  drafts: 'Drafts', opportunities: 'Supplier opportunities', products: 'Products', tenders: 'Public tenders',
}

export function SearchView({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const urlQuery = params?.get('q') ?? initialQuery
  return <SearchResults query={urlQuery} onQuery={query => router.replace(searchHref(query), { scroll: false })} />
}

function SearchResults({ query, onQuery }: { query: string; onQuery: (query: string) => void }) {
  const [input, setInput] = useState(query)
  const [collection, setCollection] = useState('all')
  const [settledQuery, setSettledQuery] = useState(query)
  const [previousQuery, setPreviousQuery] = useState(query)
  if (query !== previousQuery) {
    setPreviousQuery(query)
    if (query !== input) { setInput(query); setSettledQuery(query) }
  }
  const { user } = useAuthContext()
  const demo = usePortalDemo()
  const demoSources = useMemo(() => demo ? demoSearchSources() : [], [demo])
  useEffect(() => {
    const timer = setTimeout(() => { setSettledQuery(input); if (input !== query) onQuery(input) }, 350)
    return () => clearTimeout(timer)
  }, [input, query, onQuery])
  const valid = settledQuery.trim().length > 0 && settledQuery.length <= 200
  const live = useSWR(!demo && user && valid ? ['home-global-search', user.id, settledQuery] : null,
    () => loadSearchSources(settledQuery), { shouldRetryOnError: false })
  const sources = demo ? demoSources : live.data ?? []
  const rows = filterSearchRows(sources, settledQuery, collection)
  const pending = input !== settledQuery || (!demo && valid && (!user || live.isLoading))
  const failed = sources.filter(source => source.error && (collection === 'all' || collection === source.collection))
  return <div className="flex min-w-0 flex-1 flex-col">
    <AccountSearch autoFocus value={input} placeholder="Search all collections..." onChange={event => setInput(event.target.value.slice(0, 200))} />
    <AccountSubheader scope="personal"><div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Button asChild variant="ghost" size="sm"><Link href="/home"><ArrowLeft className="mr-2 h-4 w-4" />Home</Link></Button>
        <h1 className="text-lg font-semibold">Search results</h1></div>
      <Select value={collection} onValueChange={setCollection}><SelectTrigger className="w-[200px]" aria-label="Collection"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All collections</SelectItem>{searchCollections.map(value => <SelectItem key={value} value={value}>{labels[value]}</SelectItem>)}</SelectContent>
      </Select>
    </div></AccountSubheader>
    <div className="min-w-0 space-y-4 py-4 md:py-6">
      {(failed.length > 0 || live.error) && <Alert variant="destructive"><AlertDescription>
        {live.error ? 'Search is temporarily unavailable.' : `Some collections could not be loaded completely: ${failed.map(source => labels[source.collection]).join(', ')}. Open the collection to refine your search.`}
        <Button variant="ghost" size="sm" onClick={() => void live.mutate()}>Retry</Button>
      </AlertDescription></Alert>}
      {!valid && !pending ? <EmptyCard title="Search all collections" description="Find purchases, documents, library items, products and tenders from one place."
        icon={<Search size={24} />} showHint={false} /> : <>
        {!pending && <p className="text-sm text-muted-foreground" aria-live="polite">{rows.length} results for “{settledQuery}”</p>}
        <DocumentTable key={`${settledQuery}:${collection}`} rows={rows} loading={pending} empty="No matching results"
          emptyDescription="Try another term or choose a different collection." emptyIcon={<Search size={24} />} columns={[
            { label: 'Name', render: row => <Link href={row.href} className="font-medium hover:underline focus-visible:underline">{row.title}</Link> },
            { label: 'Collection', render: row => labels[row.collection] },
            { label: 'Details', render: row => <p className="line-clamp-2 text-muted-foreground">{row.description || '—'}</p> },
            { label: 'Status', render: row => row.status ? <StatusDot status={row.status} label={row.status} /> : '—' },
          ]} />
      </>}
    </div>
  </div>
}
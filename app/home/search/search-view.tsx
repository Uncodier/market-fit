'use client'

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

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

export function SearchView({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const urlQuery = params?.get('q') ?? initialQuery
  return <SearchResults query={urlQuery} onQuery={query => router.replace(searchHref(query), { scroll: false })} />
}

function SearchResults({ query, onQuery }: { query: string; onQuery: (query: string) => void }) {
  const { t, formatNumber, valueLabel } = useProcurementI18n()
  const labels: Record<SearchCollection, string> = {
    orders: t('procurement.surfaces.search.orders'), quotes: t('procurement.surfaces.search.quotes'), subscriptions: t('procurement.surfaces.search.subscriptions'), library: t('procurement.surfaces.search.library'),
    reservations: t('procurement.surfaces.search.reservations'), businesses: t('procurement.surfaces.search.businesses'), credentials: t('procurement.portal.home.credentials'), submissions: t('procurement.surfaces.search.submissions'),
    drafts: t('procurement.portal.draft.list'), opportunities: t('procurement.surfaces.search.opportunities'), products: t('procurement.quoteDetail.products'), tenders: t('procurement.surfaces.search.tenders'),
  }
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
    <AccountSearch autoFocus value={input} placeholder={t('procurement.surfaces.search.placeholder')} onChange={event => setInput(event.target.value.slice(0, 200))} />
    <AccountSubheader scope="personal"><div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Button asChild variant="ghost" size="sm"><Link href="/home"><ArrowLeft className="mr-2 h-4 w-4" />{t('procurement.surfaces.search.home')}</Link></Button>
        <h1 className="text-lg font-semibold">{t('procurement.surfaces.search.results')}</h1></div>
      <Select value={collection} onValueChange={setCollection}><SelectTrigger className="w-[200px]" aria-label={t('procurement.surfaces.search.collection')}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">{t('procurement.surfaces.search.all')}</SelectItem>{searchCollections.map(value => <SelectItem key={value} value={value}>{labels[value]}</SelectItem>)}</SelectContent>
      </Select>
    </div></AccountSubheader>
    <div className="min-w-0 space-y-4 py-4 md:py-6">
      {(failed.length > 0 || live.error) && <Alert variant="destructive"><AlertDescription>
        {live.error ? t('procurement.surfaces.search.unavailable') : t('procurement.surfaces.search.partial', { collections: failed.map(source => labels[source.collection]).join(', ') })}
        <Button variant="ghost" size="sm" onClick={() => void live.mutate()}>{t('procurement.common.retry')}</Button>
      </AlertDescription></Alert>}
      {!valid && !pending ? <EmptyCard title={t('procurement.surfaces.search.title')} description={t('procurement.surfaces.search.hint')}
        icon={<Search size={24} />} showHint={false} /> : <>
        {!pending && <p className="text-sm text-muted-foreground" aria-live="polite">{t('procurement.surfaces.search.count', { count: formatNumber(rows.length), query: settledQuery })}</p>}
        <DocumentTable key={`${settledQuery}:${collection}`} rows={rows} loading={pending} empty={t('procurement.surfaces.search.empty')}
          emptyDescription={t('procurement.surfaces.search.emptyHint')} emptyIcon={<Search size={24} />} columns={[
            { label: t('procurement.policy.rules.name'), render: row => <Link href={row.href} className="font-medium hover:underline focus-visible:underline">{row.title}</Link> },
            { label: t('procurement.surfaces.search.collection'), render: row => labels[row.collection] },
            { label: t('procurement.workflow.common.details'), render: row => <p className="line-clamp-2 text-muted-foreground">{row.description || '—'}</p> },
            { label: t('procurement.workflow.common.status'), render: row => row.status ? <StatusDot status={row.status} label={valueLabel(row.status)} /> : '—' },
          ]} />
      </>}
    </div>
  </div>
}
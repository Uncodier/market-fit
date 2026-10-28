'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { SortDropdown } from '@/app/components/ui/sort-dropdown'
import type { PublicTenderRow } from './public-data'

const filters = [{ value: 'all', label: 'All publications' }, { value: 'open', label: 'Participation open' }, { value: 'closed', label: 'Participation closed' }]
const sorts = [{ value: 'published', label: 'Latest published' }, { value: 'deadline', label: 'Closing soonest' }, { value: 'title', label: 'Title' }]

/** MarketplaceCatalog sidebar, mobile chips and sort composition over this public page only. */
export function TenderListing({ rows, closedIds }: { rows: PublicTenderRow[]; closedIds: string[] }) {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('published')
  const closed = (row: PublicTenderRow) => closedIds.includes(row.publication_id)
  const visible = rows.filter(row => filter === 'all' || (filter === 'closed' ? closed(row) : !closed(row)))
    .sort((a, b) => sort === 'title' ? a.snapshot.title.localeCompare(b.snapshot.title) : sort === 'deadline'
      ? Date.parse(a.snapshot.participation_deadline) - Date.parse(b.snapshot.participation_deadline)
      : Date.parse(b.published_at) - Date.parse(a.published_at))

  return <div className="flex flex-col md:flex-row gap-8 items-start">
    <aside aria-label="Filter published tenders" className="w-full md:w-64 shrink-0 space-y-8 hidden md:block pb-4 md:sticky md:top-24">
      <div><h2 className="font-bold text-lg mb-4">Participation</h2><div className="space-y-1">
        {filters.map(option => <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}
          className={`flex w-full !justify-start text-left px-3 py-2 rounded-lg text-sm transition-colors ${filter === option.value ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'}`}>{option.label}</button>)}
      </div></div>
      <p className="text-sm text-muted-foreground">Filters and sorting apply to the publications on this page. Search looks across published titles.</p>
    </aside>
    <div className="flex-1 min-w-0 w-full">
      <div aria-label="Mobile participation filters" className="md:hidden sticky top-[72px] z-30 -mx-4 pt-2 pb-4 mb-6">
        <div className="flex overflow-x-auto gap-3 scrollbar-hide w-full items-center py-2 px-4">
          {filters.map(option => <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}
            className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 border backdrop-blur-3xl shadow-sm ${filter === option.value ? 'bg-black/60 text-white border-black/30 dark:bg-white/60 dark:text-black dark:border-white/30' : 'bg-white/60 text-gray-700 border-black/5 dark:bg-[#030303]/60 dark:text-gray-300 dark:border-white/10'}`}>{option.label}</button>)}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="text-sm text-muted-foreground" role="status">{visible.length} of {rows.length} publications on this page</p>
        <SortDropdown sortBy={sort} setSortBy={setSort} options={sorts} title="Sort this page" className="!w-auto !rounded-full" />
      </div>
      <p className="md:hidden text-xs text-muted-foreground mb-4">Filters and sorting apply to this page only.</p>
      {!visible.length ? <div className="space-y-3 py-8"><p>No publications match this participation filter.</p><Button variant="outline" onClick={() => setFilter('all')}>Show all publications on this page</Button></div>
        : <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">{visible.map(row => <article key={row.publication_id} className="group flex h-full flex-col rounded-2xl border border-border/50 bg-card p-5 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between gap-2 mb-4"><Badge variant="secondary">{closed(row) ? 'Closed' : 'Open'}</Badge><span className="text-xs text-muted-foreground">Version {row.version}</span></div>
          <Link href={`/tenders/${row.site_slug}`} className="text-sm text-muted-foreground hover:underline">{row.site_slug}</Link>
          <h2 className="mt-2 text-lg font-semibold leading-tight"><Link href={`/tenders/${row.site_slug}/${row.tender_slug}`} className="hover:underline">{row.snapshot.title}</Link></h2>
          <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{row.snapshot.description}</p>
          <div className="mt-auto pt-5 space-y-3"><p className="text-sm">{row.snapshot.requirements.length} requirements</p><p className="text-xs text-muted-foreground">Participation closes {new Date(row.snapshot.participation_deadline).toLocaleString('en', { timeZone: 'UTC' })} UTC</p>
            <Button variant="ghost" className="w-full" asChild><Link href={`/tenders/${row.site_slug}/${row.tender_slug}`}>View tender</Link></Button>
          </div>
        </article>)}</div>}
    </div>
  </div>
}
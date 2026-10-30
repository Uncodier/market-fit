'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/app/components/ui/button'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { ClipboardList } from '@/app/components/ui/icons'
import { SortDropdown } from '@/app/components/ui/sort-dropdown'
import type { PublicTenderRow } from './public-data'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { TenderListingCard } from './tender-listing-card'
import { EmptyTenders } from './empty-tenders'
import { TenderListingFilters } from './listing-filters'
import { TenderFacetControls } from './listing-facet-controls'
import { matchesTenderFacets, tenderFacetOptions } from './listing-facets'

/** Marketplace filter layout with document-first tender rows. */
export function TenderListing({ rows, closedIds, header, children, emptyHref = '/tenders', errorContent }: {
  rows: PublicTenderRow[]; closedIds: string[]; header?: ReactNode; children?: ReactNode; emptyHref?: string; errorContent?: ReactNode
}) {
  const { t, locale, formatNumber } = useProcurementI18n()
  const sorts = [{ value: 'published', label: t('procurement.portal.listing.latest') }, { value: 'deadline', label: t('procurement.portal.listing.deadline') }, { value: 'title', label: t('procurement.portal.listing.title') }]
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('published')
  const [region, setRegion] = useState('')
  const [category, setCategory] = useState('')
  const closed = (row: PublicTenderRow) => closedIds.includes(row.publication_id)
  const participating = rows.filter(row => filter === 'all' || (filter === 'closed' ? closed(row) : !closed(row)))
  const visible = participating.filter(row => matchesTenderFacets(row, region, category))
    .sort((a, b) => sort === 'title' ? a.snapshot.title.localeCompare(b.snapshot.title, locale) : sort === 'deadline'
      ? Date.parse(a.snapshot.participation_deadline) - Date.parse(b.snapshot.participation_deadline)
      : Date.parse(b.published_at) - Date.parse(a.published_at))

  const facets = <TenderFacetControls regions={tenderFacetOptions(rows, 'regions')} categories={tenderFacetOptions(rows, 'categories')}
    region={region} category={category} onRegion={setRegion} onCategory={setCategory} />
  return <div className="flex flex-col md:flex-row gap-8 items-start">
    <TenderListingFilters value={filter} onChange={setFilter}>{facets}</TenderListingFilters>
    <div className="flex-1 min-w-0 w-full">
      {header}
      <TenderListingFilters value={filter} onChange={setFilter} mobile />
      <div className="md:hidden mb-6">{facets}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="text-sm text-muted-foreground" role="status">{t('procurement.portal.listing.count', { visible: formatNumber(visible.length), total: formatNumber(rows.length) })}</p>
        <SortDropdown sortBy={sort} setSortBy={setSort} options={sorts} title={t('procurement.portal.listing.sort')} className="!w-auto !rounded-full" />
      </div>
      <p className="md:hidden text-xs text-muted-foreground mb-4">{t('procurement.portal.listing.mobileScope')}</p>
      {errorContent || (!rows.length ? <EmptyTenders href={emptyHref} /> : !visible.length ? <EmptyCard icon={<ClipboardList size={24} />} title={t('procurement.portal.listing.noMatches')}
        description="" showHint={false} actionButton={<Button variant="outline" onClick={() => { setFilter('all'); setRegion(''); setCategory('') }}>{t('procurement.portal.listing.showAll')}</Button>} />
        : <div className="space-y-3">{visible.map(row => <TenderListingCard key={row.publication_id} row={row} closed={closed(row)} />)}</div>)}
      {!errorContent && children}
    </div>
  </div>
}
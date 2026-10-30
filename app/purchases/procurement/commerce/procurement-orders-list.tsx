'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { SearchInput } from '@/app/components/ui/search-input'
import { MobileFiltersDrawer, FilterContainer, FilterSection } from '@/app/components/ui/mobile-filters-drawer'
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { SortDropdown } from '@/app/components/ui/sort-dropdown'
import { ViewSelector, type ViewType } from '@/app/components/view-selector'
import { RotateCw } from '@/app/components/ui/icons'
import { Skeleton } from '@/app/components/ui/skeleton'
import { StatusDot } from '@/app/components/documents/document-list'
import { DocumentTable } from './document-ui'
import type { ProcurementOrder } from './contracts'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { isProcurementDemo } from '../ui/is-demo'

export function acceptanceStatus(order: ProcurementOrder) {
  if (order.lines.length && order.lines.every(line => (line.received_quantity ?? 0) >= line.quantity)) return 'completed'
  return order.lines.some(line => (line.received_quantity ?? 0) > 0) ? 'in_progress' : 'pending'
}

export function orderReference(order: ProcurementOrder, siteId: string) {
  return isProcurementDemo(siteId) ? 'PO-DEMO-2026-001' : order.id
}

export function ProcurementOrdersToolbar({ navigation, search, onSearch, status, onStatus, sort, onSort, view, onView, loading, onRefresh }: {
  navigation?: ReactNode
  search: string; onSearch: (value: string) => void
  status: string; onStatus: (value: string) => void
  sort: string; onSort: (value: string) => void
  view: ViewType; onView: (value: ViewType) => void
  loading: boolean; onRefresh: () => void
}) {
  const { t } = useProcurementI18n()
  const statuses = [
    { value: 'all', label: t('orders.tabs.all') },
    { value: 'pending', label: t('orders.tabs.pendingTitle') },
    { value: 'in_progress', label: t('status.in_progress') },
    { value: 'completed', label: t('buyer.orders.filters.completed') },
  ]
  const searchInput = (expanded = false) => <SearchInput placeholder={t('procurement.partners.commerce.search')}
    value={search} onChange={event => onSearch(event.target.value)} alwaysExpanded={expanded} containerClassName={expanded ? 'w-full' : 'w-64'} />
  return <Tabs value={status} onValueChange={onStatus} className="contents">
    <StickyHeader style={{ top: 0 }}>
      <div className="flex items-center justify-between w-full gap-3">
        <MobileFiltersDrawer triggerText={t('common.search')}>
          <FilterContainer>
            {navigation && <FilterSection>{navigation}</FilterSection>}
            <FilterSection mobileOnly>{searchInput(true)}</FilterSection>
            <FilterSection title={t('procurement.partners.orders.acceptance')}>
              <TabsList className="h-auto md:h-8 p-0.5 bg-muted/30 rounded-full flex flex-wrap md:flex-nowrap justify-start">
                {statuses.map(item => <TabsTrigger key={item.value} value={item.value} className="rounded-full text-xs whitespace-nowrap">{item.label}</TabsTrigger>)}
              </TabsList>
            </FilterSection>
            <FilterSection desktopOnly>{searchInput()}</FilterSection>
          </FilterContainer>
        </MobileFiltersDrawer>
        <div data-secondary-actions className="ml-auto flex items-center gap-3 shrink-0">
          <Button variant="ghost" size="icon" aria-label={t('procurement.partners.actions.refresh')}
            title={t('procurement.partners.orders.refresh')} disabled={loading} onClick={onRefresh}>
            <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <SortDropdown sortBy={sort} setSortBy={onSort} title={t('content.sortBy')} options={[
            { value: 'newest', label: t('newest') }, { value: 'oldest', label: t('oldest') },
          ]} />
          <ViewSelector currentView={view} onViewChange={onView} />
        </div>
      </div>
    </StickyHeader>
  </Tabs>
}

export function ProcurementOrdersList({ orders, siteId, view, loading, onSelect }: {
  orders: ProcurementOrder[]; siteId: string; view: ViewType; loading: boolean; onSelect: (id: string) => void
}) {
  const { t, formatMoney, formatDate } = useProcurementI18n()
  const statusLabel = (order: ProcurementOrder) => t(`status.${acceptanceStatus(order)}`)
  const reference = (order: ProcurementOrder) => isProcurementDemo(siteId)
    ? <Link className="font-medium hover:underline" href={`/purchases/orders/${order.id}`}>{orderReference(order, siteId)}</Link>
    : <Button variant="link" className="h-auto p-0" onClick={() => onSelect(order.id)}>{order.id.slice(0, 8)}</Button>
  const acceptance = (order: ProcurementOrder) => <Button variant="outline" size="sm" onClick={() => onSelect(order.id)}>{t('procurement.partners.orders.itemsAcceptance')}</Button>
  if (view === 'table' || (!loading && !orders.length)) return <DocumentTable loading={loading} empty={t('procurement.partners.orders.empty')} rows={orders} columns={[
    { label: t('procurement.partners.suppliers.supplier'), render: order => <span className="font-medium">{order.supplier_name}</span> },
    { label: t('procurement.partners.orders.order'), render: reference },
    { label: t('common.status'), render: order => <StatusDot status={acceptanceStatus(order)} label={statusLabel(order)} /> },
    { label: t('procurement.partners.commerce.netAmount'), render: order => <span className="font-semibold tabular-nums">{formatMoney(order.net_amount_minor, order.currency)}</span> },
    { label: t('procurement.partners.orders.created'), render: order => formatDate(order.created_at) },
    { label: t('procurement.partners.orders.acceptance'), render: acceptance },
  ]} />
  if (loading) return <div role="status" aria-label={t('procurement.partners.orders.title')} className="grid gap-4 md:grid-cols-3">
    {[0, 1, 2].map(index => <Skeleton key={index} className="h-48 w-full rounded-xl" />)}
  </div>
  return <div className="flex gap-4 overflow-x-auto pb-4 min-w-0">
    {['pending', 'in_progress', 'completed'].map(status => <section key={status} className="w-[300px] md:w-[350px] shrink-0 space-y-3">
      <h3 className="flex items-center justify-between text-sm font-medium px-1">
        <StatusDot status={status} label={t(`status.${status}`)} />
        <span className="text-muted-foreground">{orders.filter(order => acceptanceStatus(order) === status).length}</span>
      </h3>
      {orders.filter(order => acceptanceStatus(order) === status).map(order => <article key={order.id} className="rounded-xl border border-border/70 bg-card shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">{reference(order)}<span className="text-xs text-muted-foreground">{formatDate(order.created_at)}</span></div>
        <p className="font-medium">{order.supplier_name}</p>
        <p className="font-semibold tabular-nums">{formatMoney(order.net_amount_minor, order.currency)}</p>
        {acceptance(order)}
      </article>)}
    </section>)}
  </div>
}
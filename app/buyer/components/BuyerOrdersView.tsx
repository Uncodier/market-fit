"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { listBuyerOrders, getUserSites } from "../actions"
import { SearchInput } from "@/app/components/ui/search-input"
import { AccountSearch, AccountSubheader } from "./AccountSearch"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { BuyerListSkeleton } from "./BuyerListSkeleton"
import { LayoutGrid, Clock, CheckCircle2, ListOrdered, Search } from "@/app/components/ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useRouter } from "next/navigation"
import { navigateToPurchaseOrder } from "@/lib/navigation/navigation-helpers"
import { BuyerOrderListCard } from "./BuyerOrderListCard"
import type { BuyerOrderDetail } from "../order-detail-display"
import { demoAccountOrders, filterDemoAccountRows, demoAccountDetailPath } from '@/app/home/demo-commerce'

export function BuyerOrdersView({
  scope = "personal",
  ownerSiteId,
  basePath = "/buyer",
  navigation,
  demo = false,
}: {
  scope?: "personal" | "site"
  ownerSiteId?: string
  basePath?: string
  navigation?: React.ReactNode
  demo?: boolean
}) {
  const { t } = useLocalization()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [sites, setSites] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (!demo && scope === 'personal') {
      getUserSites().then(res => {
        if (res.data) setSites(res.data)
      })
    }
  }, [scope, demo])

  const effectiveOwnerSiteId = scope === 'site' ? ownerSiteId : ownerFilter

  const live = useSWR(
    demo ? null : ['buyer-orders', page, pageSize, searchQuery, statusFilter, effectiveOwnerSiteId, scope],
    async () => {
      const res = await listBuyerOrders({ page, pageSize, q: searchQuery, status: statusFilter, ownerSiteId: effectiveOwnerSiteId, scope })
      if (res.error) throw new Error(res.error)
      return res
    },
    { keepPreviousData: true }
  )
  const data = demo ? filterDemoAccountRows(demoAccountOrders, { q: searchQuery, status: statusFilter, page, pageSize }) : live.data
  const { mutate } = live
  const error = !demo && live.error
  const isLoading = !demo && live.isLoading

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setPage(1)
  }
  if (isLoading && !data) {
    return <BuyerListSkeleton kind="orders" scope={scope} navigation={navigation} />
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <Tabs value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }} className="flex-1 flex flex-col w-full min-h-0">
        <AccountSubheader scope={scope}>
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-4 flex-1 overflow-x-auto no-scrollbar">
                {navigation && <div className="shrink-0">{navigation}</div>}
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                  <TabsTrigger value="all" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <LayoutGrid size={13} className="shrink-0 md:!hidden" />
                    <span className="tab-label">{t('buyer.orders.filters.all') || 'All'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <Clock size={13} className="shrink-0 md:!hidden" />
                    <span className="tab-label">{t('buyer.orders.filters.pending') || 'Pending'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={13} className="shrink-0 md:!hidden" />
                    <span className="tab-label">{t('buyer.orders.filters.completed') || 'Completed'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="cancelled" className="text-xs font-medium rounded-full">{t('buyer.orders.status.cancelled')}</TabsTrigger>
                </TabsList>

                <div className={scope === 'site' ? 'hidden md:block' : 'contents'}>
                  <AccountSearch
                    placeholder={t('buyer.orders.search') || "Search purchases..."} 
                    value={searchQuery}
                    onChange={handleSearchChange}
                    scope={scope}
                  />
                </div>
              </div>
              
              <div className="ml-auto flex shrink-0 items-center justify-end gap-3">
                {scope === 'site' && <div className="md:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={t("buyer.orders.search")} className="h-8 w-8">
                        <Search className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[300px] p-2">
                      <form onSubmit={(e) => {
                        e.preventDefault();
                      }}>
                        <SearchInput
                          placeholder={t('buyer.orders.search') || "Search purchases..."} 
                          value={searchQuery}
                          onChange={handleSearchChange}
                          className="bg-background w-full border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                          alwaysExpanded={true}
                        />
                      </form>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>}
              {scope === 'personal' && sites.length > 1 && (
                <Select value={ownerFilter} onValueChange={(val) => { setOwnerFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-auto min-w-[180px] h-9 whitespace-nowrap">
                    <SelectValue placeholder={t('buyer.orders.filters.allCollections') || "All Collections"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('buyer.orders.filters.allPurchases') || "All Purchases"}</SelectItem>
                    <SelectItem value="personal">{t('buyer.orders.filters.personalOnly') || "Personal Only"}</SelectItem>
                    {sites.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </AccountSubheader>

        <div className={`flex-1 overflow-auto ${scope === 'personal' ? 'py-4 md:py-6 px-4 md:px-0' : 'p-4 md:p-6 lg:p-8'}`}>
          <div className="w-full">
            {error ? (
              <div role="alert" className="text-center p-6 bg-card rounded-xl border space-y-3">
                <p className="text-muted-foreground">{t('buyer.orders.errorLoading')}</p>
                <Button variant="outline" size="sm" onClick={() => void mutate()}>{t('buyer.orders.retry')}</Button>
              </div>
            ) : (
              <>
                {data?.count !== undefined && <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-sm text-muted-foreground" aria-live="polite">
                  <span>{t(data.count === 1 ? 'buyer.orders.resultCountOne' : 'buyer.orders.resultCount', { count: data.count })}</span>
                  {(searchQuery || statusFilter !== 'all' || ownerFilter !== 'all') && <Button variant="ghost" size="sm" onClick={() => {
                    setSearchQuery(''); setStatusFilter('all'); setOwnerFilter('all'); setPage(1)
                  }}>{t('buyer.orders.resetFilters')}</Button>}
                </div>}
                <div className="space-y-4">
                  {data?.data && data.data.length > 0 ? (
                    data.data.map((order: BuyerOrderDetail) => (
                      <BuyerOrderListCard key={order.id} order={order} demo={demo}
                        onView={() => demo ? router.push(demoAccountDetailPath('orders', order.id)) : navigateToPurchaseOrder({
                          orderId: order.id, orderNumber: order.order_number || order.id, basePath, router,
                        })}
                        onBuyAgain={itemId => router.push(`/shop/${order.site!.id}${itemId ? `/${itemId}` : ''}`)}
                      />
                    ))
                  ) : (
                    <div className="bg-card rounded-xl border shadow-sm p-8 flex items-center justify-center min-h-[300px]">
                      <EmptyCard 
                        icon={<ListOrdered size={32} className="text-muted-foreground" />}
                        title={t('buyer.orders.empty.title') || "No purchases found"}
                        description={searchQuery || statusFilter !== 'all' || (scope === 'personal' && ownerFilter !== 'all')
                          ? (t('buyer.orders.empty.descFiltered') || "Try adjusting your filters to see more results.")
                          : scope === 'site' 
                            ? (t('buyer.orders.empty.descBusiness') || "No purchases found for this business yet.")
                            : (t('buyer.orders.empty.descPersonal') || "You haven't made any purchases yet.")
                        }
                        variant={searchQuery ? "simple" : "fancy"}
                        className="border-0 shadow-none bg-transparent"
                      />
                    </div>
                  )}
                </div>
                {data?.count !== undefined && data.count > pageSize && (
                  <div className="pt-6 pb-2">
                    <Pagination 
                      currentPage={page} 
                      totalPages={Math.ceil(data.count / pageSize)} 
                      onPageChange={setPage} 
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  )
}

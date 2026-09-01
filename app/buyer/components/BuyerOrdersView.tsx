"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { listBuyerOrders, getUserSites } from "../actions"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { LayoutGrid, Clock, CheckCircle2, ListOrdered, Search } from "@/app/components/ui/icons"
import { format } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { resolveItemImage } from "@/app/lib/image-utils"
import { formatCurrency } from "@/app/lib/formatters"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useRouter } from "next/navigation"
import { navigateToPurchaseOrder } from "@/lib/navigation/navigation-helpers"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { StatusDot } from "@/app/components/documents/document-list"

export function BuyerOrdersView({
  scope = "personal",
  ownerSiteId,
  basePath = "/buyer"
}: {
  scope?: "personal" | "site"
  ownerSiteId?: string
  basePath?: string
}) {
  const { t } = useLocalization()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [sites, setSites] = useState<any[]>([])

  useEffect(() => {
    if (scope === 'personal') {
      getUserSites().then(res => {
        if (res.data) setSites(res.data)
      })
    }
  }, [scope])

  const effectiveOwnerSiteId = scope === 'site' ? ownerSiteId : ownerFilter

  const { data, error, isLoading, mutate } = useSWR(
    ['buyer-orders', page, pageSize, searchQuery, statusFilter, effectiveOwnerSiteId, scope],
    async () => {
      const res = await listBuyerOrders({ page, pageSize, q: searchQuery, status: statusFilter, ownerSiteId: effectiveOwnerSiteId, scope })
      if (res.error) throw new Error(res.error)
      return res
    }
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setPage(1)
  }

  const HeaderWrapper = scope === 'site' ? StickyHeader : ({ children }: any) => (
    <div className="sticky top-[72px] z-30 bg-transparent h-[72px] flex items-center">
      {children}
    </div>
  )

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-full">
        <HeaderWrapper>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4 flex-1 overflow-x-auto no-scrollbar">
              <Skeleton className="h-8 w-[240px] rounded-full flex-shrink-0" />
              <Skeleton className="h-9 w-48 rounded-md flex-shrink-0" />
            </div>
            
            <div className="ml-auto flex items-center justify-end gap-3 flex-shrink-0">
              <Skeleton className="h-9 w-[160px] rounded-md hidden sm:block" />
            </div>
          </div>
        </HeaderWrapper>

        <div className={`flex-1 overflow-auto ${scope === 'personal' ? 'py-4 md:py-6' : 'p-4 md:p-6 lg:p-8'}`}>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card rounded-xl border p-5 flex flex-col md:flex-row gap-5">
                <Skeleton className="h-20 w-20 rounded-md flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex flex-col gap-2 md:w-56 mt-4 md:mt-0">
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-full">
      <Tabs value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }} className="flex-1 flex flex-col w-full min-h-0">
        <HeaderWrapper>
          <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4 flex-1 overflow-x-auto no-scrollbar">
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
                </TabsList>

                <div className="hidden md:block">
                  <SearchInput
                    placeholder={t('buyer.orders.search') || "Search purchases..."} 
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                    alwaysExpanded={false}
                  />
                </div>
              </div>
              
              <div className="ml-auto flex items-center justify-end gap-3">
                <div className="md:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
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
                </div>
              {scope === 'personal' && sites.length > 1 && (
                <Select value={ownerFilter} onValueChange={(val) => { setOwnerFilter(val); setPage(1); mutate(); }}>
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
        </HeaderWrapper>

        <div className={`flex-1 overflow-auto ${scope === 'personal' ? 'py-4 md:py-6 px-4 md:px-0' : 'p-4 md:p-6 lg:p-8'}`}>
          <div className="w-full">
            {error ? (
              <div className="text-center text-red-500 p-4 bg-card rounded-xl border shadow-sm">{t('buyer.orders.errorLoading') || 'Error loading orders'}</div>
            ) : (
              <>
                <div className="space-y-6">
                  {data?.data && data.data.length > 0 ? (
                    data.data.map((order: any) => {
                      const status = (order.status || "").toLowerCase()
                      const statusLabel = status
                        ? (t(`status.${status}`) || status.replace(/_/g, " "))
                        : (t("status.unknown") || "Unknown")
                      const cancelled = status === "cancelled" || status === "canceled"
                      return (
                      <div key={order.id} className="overflow-hidden rounded-xl border border-border/70 bg-card">
                        <div className="flex flex-col gap-2 border-b border-border/50 px-5 py-3 text-sm md:flex-row md:items-center md:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <StatusDot status={status || "pending"} label={statusLabel} />
                            <span className="text-muted-foreground">
                              {format(new Date(order.created_at), "MMM d, yyyy")}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span className="truncate font-medium text-foreground">
                              {order.site?.name || t("buyer.orders.unknown") || "Unknown"}
                              {scope === "personal" && order.owner_site_id
                                ? ` · ${t("buyer.orders.business") || "Business"}`
                                : ""}
                            </span>
                            <span className="font-mono text-[11px] uppercase tracking-wider">
                              {order.order_number}
                            </span>
                            <span
                              className={`text-[15px] font-semibold tabular-nums tracking-tight text-foreground ${cancelled ? "text-muted-foreground line-through decoration-muted-foreground/60" : ""}`}
                            >
                              {formatCurrency(Number(order.total) || 0, order.currency || "USD")}
                            </span>
                          </div>
                        </div>

                        <div className="divide-y">
                          {order.sale_order_items && order.sale_order_items.length > 0 ? (
                            order.sale_order_items.map((item: any) => (
                              <div key={item.id} className="p-5 flex flex-col md:flex-row gap-5">
                                <div className="h-20 w-20 bg-muted rounded-md flex-shrink-0 overflow-hidden border">
                                  {resolveItemImage({ ...item.catalog_item, name: item.name }) ? (
                                    <img src={resolveItemImage({ ...item.catalog_item, name: item.name })} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                      <LayoutGrid className="w-8 h-8 opacity-20" />
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex-1 space-y-1.5">
                                  <div className="font-medium text-foreground text-base leading-tight">
                                    {item.name}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {item.quantity} {item.quantity === 1 ? (t('buyer.orders.unit') || 'unit') : (t('buyer.orders.units') || 'units')}
                                    {status === 'completed' ? ` · ${t('buyer.orders.arrivedOn') || 'Arrived on'} ${format(new Date(order.created_at), 'MMM d')}` : ''}
                                  </div>
                                </div>

                                <div className="flex flex-col gap-2 md:w-56 mt-4 md:mt-0">
                                  <Button 
                                    variant="outline"
                                    onClick={() => navigateToPurchaseOrder({
                                      orderId: order.id,
                                      orderNumber: order.order_number,
                                      basePath,
                                      router
                                    })}
                                    className="w-full"
                                  >
                                    {t('buyer.orders.viewPurchase') || 'View Purchase'}
                                  </Button>
                                  <Button 
                                    variant="secondary" 
                                    className="w-full"
                                    onClick={() => router.push(`/shop/${order.site?.id || ''}/${item.catalog_item_id || ''}`)}
                                  >
                                    {t('buyer.orders.buyAgain') || 'Buy Again'}
                                  </Button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-5 flex flex-col md:flex-row gap-5">
                              <div className="flex-1">
                                <div className="font-medium text-foreground">
                                  {order.items?.length || 0} {order.items?.length === 1 ? (t('buyer.orders.item') || 'item') : (t('buyer.orders.items') || 'items')}
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {formatCurrency(Number(order.total) || 0, order.currency || "USD")}
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 md:w-56">
                                <Button 
                                  variant="outline"
                                  onClick={() => navigateToPurchaseOrder({
                                    orderId: order.id,
                                    orderNumber: order.order_number,
                                    basePath,
                                    router
                                  })}
                                  className="w-full"
                                >
                                  {t('buyer.orders.viewPurchase') || 'View Purchase'}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      )
                    })
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

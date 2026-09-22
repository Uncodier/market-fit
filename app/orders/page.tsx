"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listOrders, updateOrderStatus } from "./actions"
import { OrderParams, type OrderWithRelations } from "./types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer, FilterContainer, FilterSection, FilterSeparator } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { LayoutGrid, Clock, CheckCircle2, Ban, PlayCircle, X } from "@/app/components/ui/icons"
import { subDays, startOfDay, endOfDay } from "date-fns"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { useRouter , useSearchParams} from "next/navigation"
import { ViewSelector } from "@/app/components/view-selector"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { OrdersKanban, OrdersKanbanSkeleton } from "./components/OrdersKanban"
import { OrdersTable, OrdersTableSkeleton } from "./components/OrdersTable"
import { useOrdersRealtime } from "./hooks/useOrdersRealtime"
import { usePrinterRealtime } from "@/lib/printer/hooks/use-printer-realtime"
import { usePrinterSettings } from "@/lib/printer/hooks/use-printer"
import { ticketBrandFromSite } from "@/lib/printer"
import { listLocations } from "@/app/inventory/actions"
import { toast } from "sonner"
import { navigateToOrder } from "@/lib/navigation/navigation-helpers"
import { Button } from "@/app/components/ui/button"
import { PrinterSyncBadge } from "@/app/components/printer/PrinterSyncBadge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import {
  cacheOrdersDateRange,
  readOrdersDateRange,
  type OrdersDateRange,
} from "@/app/orders/date-range-cache"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { usePermissions } from "@/app/context/PermissionContext"
import { useOrderPrinting } from "@/app/orders/hooks/use-order-printing"
import { useDebounce } from "use-debounce"

function defaultOrdersDateRange(): OrdersDateRange {
  return {
    startDate: startOfDay(subDays(new Date(), 30)),
    endDate: endOfDay(new Date()),
  }
}

export default function OrdersPage() {
  const searchParams = useSearchParams()
  const urlSort = searchParams ? searchParams.get('sort') : null
  const defaultSort = urlSort === 'updated_at' ? 'updated_at' : (urlSort === 'created_at' || urlSort === 'newest' ? 'newest' : (urlSort === 'oldest' ? 'oldest' : 'newest'))
  const [sortBy, setSortBy] = useState(defaultSort)

  const { currentSite } = useSite()
  const { t } = useLocalization()
  const { can } = usePermissions()
  const router = useRouter()
  const { printingKey, printOrder } = useOrderPrinting({
    siteId: currentSite?.id,
    site: currentSite,
  })
  
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300)
  const [statusFilter, setStatusFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [viewType, setViewType] = useMobileView("kanban")
  const [orderToCancel, setOrderToCancel] =
    useState<OrderWithRelations | null>(null)
  
  const [dateRange, setDateRange] = useState<OrdersDateRange | null>(
    defaultOrdersDateRange,
  )
  const [dateRangeSiteId, setDateRangeSiteId] = useState<string | null>(null)

  useEffect(() => {
    if (!currentSite?.id) {
      setDateRangeSiteId(null)
      return
    }

    const cachedRange = readOrdersDateRange(currentSite.id)
    setDateRange(
      cachedRange === undefined ? defaultOrdersDateRange() : cachedRange,
    )
    setDateRangeSiteId(currentSite.id)
    setPage(1)
  }, [currentSite?.id])

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    const nextRange = { startDate, endDate }
    setDateRange(nextRange)
    if (currentSite?.id) cacheOrdersDateRange(currentSite.id, nextRange)
    setPage(1)
  }

  const handleDateRangeClear = () => {
    setDateRange(null)
    if (currentSite?.id) cacheOrdersDateRange(currentSite.id, null)
    setPage(1)
  }
  const clearDateRangeLabel =
    t("clear") === "clear" ? "Clear date range" : t("clear")

  const { data: locationsData } = useSWR(
    currentSite?.id ? ['locations', currentSite.id] : null,
    () => listLocations(currentSite!.id)
  )
  const locations = locationsData?.data || []

  const fetcher = async (params: OrderParams) => {
    const res = await listOrders(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id && dateRangeSiteId === currentSite.id
      ? {
          resource: "orders",
          siteId: currentSite.id,
          page,
          pageSize,
          q: debouncedSearchQuery,
          status: statusFilter,
          locationId: locationFilter,
          startDate: dateRange?.startDate.toISOString(),
          endDate: dateRange?.endDate.toISOString(),
          sort: sortBy
        }
      : null,
    ({ resource: _resource, ...request }) => fetcher(request)
  )

  useOrdersRealtime(currentSite?.id, () => {
    mutate()
  })
  const printerSettings = usePrinterSettings()
  usePrinterRealtime(currentSite?.id, printerSettings, ticketBrandFromSite(currentSite))

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!currentSite?.id) return false;
    
    // Optimistic update
    mutate(data => {
      if (!data) return data;
      return {
        ...data,
        data: data.data.map((order: any) => 
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      }
    }, { revalidate: false })

    try {
      const result = await updateOrderStatus(currentSite.id, orderId, newStatus)
      if (result.error) {
        toast.error(result.error)
        mutate() // Revert
        return false
      } else {
        toast.success(t('orders.success.statusUpdated') || "Order status updated")
        mutate() // Ensure full reload to keep in sync
        return true
      }
    } catch (error) {
      console.error("Error updating order status:", error)
      toast.error(t('orders.error.updateFailed') || "Failed to update order status")
      mutate() // Revert
      return false
    }
  }

  const openPosAction = (
    order: OrderWithRelations,
    action: "pay" | "split",
  ) => {
    const params = new URLSearchParams({ orderId: order.id, action })
    router.push(`/pos?${params.toString()}`)
  }

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: t('layout.sidebar.orders') || 'Orders'
      }
    });
    window.dispatchEvent(event);
  }, [t]);

  useEffect(() => {
    const handleCreate = () => {
      router.push('/pos');
    }
    window.addEventListener('orders:create', handleCreate)
    return () => window.removeEventListener('orders:create', handleCreate)
  }, [router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    mutate()
  }

  const renderOrdersTable = () => {
    if (!currentSite || isLoading) return <OrdersTableSkeleton />
    if (error) return <div className="p-4 text-center text-sm text-red-500">{error.message}</div>
    return (
      <OrdersTable
        orders={data?.data || []}
        page={page}
        pageSize={pageSize}
        totalCount={data?.count ?? 0}
        searchQuery={searchQuery}
        onPageChange={setPage}
        onOrderClick={(order) => navigateToOrder({ orderId: order.id, orderNumber: order.order_number, router })}
        onPay={(order) => openPosAction(order, "pay")}
        onSplit={(order) => openPosAction(order, "split")}
        onPrintFull={(order) => printOrder(order, "full")}
        onPrintDelta={(order) => printOrder(order, "delta")}
        onCancel={setOrderToCancel}
        canCancel={can("update")}
        printingKey={printingKey}
      />
    )
  }

  return (
    <div className="flex-1 min-w-0 w-full p-0 bg-muted/30 min-h-[calc(100vh-var(--topbar-height,64px))] flex flex-col">
      <Tabs value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }} className="w-full h-full min-h-0 flex flex-col flex-1">
        <StickyHeader className="border-b min-h-[71px] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="w-full pt-0">
            <div className="flex items-center justify-between w-full">
              <MobileFiltersDrawer triggerText={t('common.search') || "Search"} results={searchQuery ? renderOrdersTable() : null}>
                <FilterContainer>
                  <FilterSection mobileOnly>
                    <form onSubmit={handleSearch}>
                      <SearchInput  placeholder={t('orders.search') || "Search order number..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                    </form>
                  </FilterSection>
                    
                    <FilterSection title={t('common.status') || 'Status'} className={cn(searchQuery && "max-md:hidden")}>
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap md:flex-row w-full md:max-w-full overflow-y-visible md:overflow-x-auto justify-start items-center gap-2 md:gap-0">
                        <TabsTrigger value="all" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('orders.tabs.all') || "All Orders"}>
                          <LayoutGrid size={13} className="shrink-0 md:!hidden" />
                          <span className="tab-label">{t('orders.tabs.all') || 'All Orders'}</span>
                        </TabsTrigger>
                      <TabsTrigger value="pending" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('orders.tabs.pending') || "Pending Orders"}>
                        <Clock size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('orders.tabs.pendingTitle') || 'Pending'}</span>
                      </TabsTrigger>
                      <TabsTrigger value="in_progress" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('orders.tabs.inProgress') || "Orders in Progress"}>
                        <PlayCircle size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('orders.tabs.inProgressTitle') || 'In Progress'}</span>
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('orders.tabs.completed') || "Completed Orders"}>
                        <CheckCircle2 size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('orders.tabs.completedTitle') || 'Completed'}</span>
                      </TabsTrigger>
                      <TabsTrigger value="cancelled" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('orders.tabs.cancelled') || "Cancelled Orders"}>
                        <Ban size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('orders.tabs.cancelledTitle') || 'Cancelled'}</span>
                      </TabsTrigger>
                    </TabsList>
                  </FilterSection>
                
                  {locations.length > 0 && (
                    <FilterSection className={cn(searchQuery && "max-md:hidden")} title={t('common.location') || 'Location'}> 
                      <Select value={locationFilter}
                        onValueChange={(val) => { setLocationFilter(val); setPage(1); }}
                      >
                        <SelectTrigger className="w-full md:w-[160px] h-10 md:h-8 text-sm md:text-xs bg-background md:bg-muted/30 border md:border-0 rounded-md md:rounded-full">
                          <SelectValue placeholder={t('common.allLocations') || 'All Locations'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('common.allLocations') || 'All Locations'}</SelectItem>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterSection>
                  )}

                  <FilterSection mobileOnly className={cn(searchQuery && "hidden")} title={t('common.dateRange') || 'Date Range'}> 
                    <div className="relative w-full">
                      <CalendarDateRangePicker
                        className="w-full [&_button]:pr-10"
                        onRangeChange={handleDateRangeChange}
                        initialStartDate={dateRange?.startDate}
                        initialEndDate={dateRange?.endDate} />
                      {dateRange && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 z-10 h-7 w-7 -translate-y-1/2"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            handleDateRangeClear()
                          }}
                          aria-label={clearDateRangeLabel}
                          title={clearDateRangeLabel}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </FilterSection>

                  <FilterSection desktopOnly>
                    <form onSubmit={handleSearch}>
                      <SearchInput  placeholder={t('orders.search') || "Search order number..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}    className="w-full bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"  containerClassName="w-64" />
                    </form>
                  </FilterSection>
                </FilterContainer>
              </MobileFiltersDrawer>

              <div className="ml-auto flex items-center gap-3 shrink-0">
                <div className="relative hidden md:flex items-center">
                  <CalendarDateRangePicker 
                    className="[&_button]:pr-10"
                    onRangeChange={handleDateRangeChange} 
                    initialStartDate={dateRange?.startDate}
                    initialEndDate={dateRange?.endDate} />
                  {dateRange && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 z-10 h-7 w-7 -translate-y-1/2"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handleDateRangeClear()
                      }}
                      aria-label={clearDateRangeLabel}
                      title={clearDateRangeLabel}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <PrinterSyncBadge module="orders" />

                <SortDropdown sortBy={sortBy} setSortBy={setSortBy} />
                <ViewSelector currentView={viewType} onViewChange={setViewType} />
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className={cn(
          "bg-muted/30 flex-1 min-h-0 min-w-0 overflow-y-auto",
          viewType === "kanban" ? "py-4 md:py-8" : "p-4 md:p-8 space-y-4 overflow-x-hidden"
        )}>
          {viewType === "kanban" ? (
            <div className="h-full min-w-0 w-full">
              {!currentSite || isLoading ? (
                <OrdersKanbanSkeleton />
              ) : error ? (
                <div className="p-6 text-center text-red-500">
                  Failed to load orders. {error.message}
                </div>
              ) : (
                <OrdersKanban
                  orders={data?.data || []}
                  onOrderClick={(order) => navigateToOrder({ orderId: order.id, orderNumber: order.order_number, router })}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onPay={(order) => openPosAction(order, "pay")}
                  onSplit={(order) => openPosAction(order, "split")}
                  onPrintFull={(order) => printOrder(order, "full")}
                  onPrintDelta={(order) => printOrder(order, "delta")}
                  onCancel={setOrderToCancel}
                  canCancel={can("update")}
                  printingKey={printingKey} />
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {!currentSite || isLoading ? (
                <OrdersTableSkeleton />
              ) : error ? (
                <div className="p-6 text-center text-red-500">
                  Failed to load orders. {error.message}
                </div>
              ) : (
                <OrdersTable
                  orders={data?.data || []}
                  page={page}
                  pageSize={pageSize}
                  totalCount={data?.count ?? 0}
                  searchQuery={searchQuery}
                  onPageChange={setPage}
                  onOrderClick={(order) => navigateToOrder({ orderId: order.id, orderNumber: order.order_number, router })}
                  onPay={(order) => openPosAction(order, "pay")}
                  onSplit={(order) => openPosAction(order, "split")}
                  onPrintFull={(order) => printOrder(order, "full")}
                  onPrintDelta={(order) => printOrder(order, "delta")}
                  onCancel={setOrderToCancel}
                  canCancel={can("update")}
                  printingKey={printingKey} />
              )}
            </div>
          )}
        </div>
      </Tabs>
      <ConfirmDialog
        open={Boolean(orderToCancel)}
        onOpenChange={(open) => {
          if (!open) setOrderToCancel(null)
        }}
        title="Cancel order?"
        description="This cancels the order and its items. Unpaid linked sales may also be cancelled; completed shipments and captured payments are not reversed."
        confirmLabel="Cancel order"
        variant="destructive"
        dataPermission="update"
        onConfirm={async () => {
          if (!orderToCancel) return
          const updated = await handleUpdateOrderStatus(
            orderToCancel.id,
            "cancelled",
          )
          if (!updated) throw new Error("Order cancellation failed")
          setOrderToCancel(null)
        }}
      />
    </div>
  )
}

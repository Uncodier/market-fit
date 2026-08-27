"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listOrders, updateOrderStatus } from "./actions"
import { OrderParams } from "./types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { LayoutGrid, Clock, CheckCircle2, Ban, PlayCircle, Search } from "@/app/components/ui/icons"
import { subDays, startOfDay, endOfDay } from "date-fns"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { useRouter } from "next/navigation"
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
import { navigateToOrder } from "@/app/hooks/use-navigation-history"
import { Button } from "@/app/components/ui/button"
import { PrinterSyncBadge } from "@/app/components/printer/PrinterSyncBadge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"

export default function OrdersPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [viewType, setViewType] = useMobileView("kanban")
  
  const [dateRange, setDateRange] = useState(() => ({
    startDate: startOfDay(subDays(new Date(), 30)),
    endDate: endOfDay(new Date()),
  }))

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setDateRange({ startDate, endDate })
    setPage(1)
  }

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
    currentSite?.id
      ? { 
          siteId: currentSite.id, 
          page, 
          pageSize, 
          q: searchQuery, 
          status: statusFilter, 
          locationId: locationFilter,
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString()
        }
      : null,
    fetcher
  )

  useOrdersRealtime(currentSite?.id, () => {
    mutate()
  })
  const printerSettings = usePrinterSettings()
  usePrinterRealtime(currentSite?.id, printerSettings, ticketBrandFromSite(currentSite))

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!currentSite?.id) return;
    
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
      } else {
        toast.success(t('orders.success.statusUpdated') || "Order status updated")
        mutate() // Ensure full reload to keep in sync
      }
    } catch (error) {
      console.error("Error updating order status:", error)
      toast.error(t('orders.error.updateFailed') || "Failed to update order status")
      mutate() // Revert
    }
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
      />
    )
  }

  return (
    <div className="flex-1 min-w-0 w-full p-0 bg-muted/30 min-h-[calc(100vh-var(--topbar-height,64px))] flex flex-col">
      <Tabs value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }} className="w-full h-full min-h-0 flex flex-col flex-1">
        <StickyHeader className="border-b min-h-[71px] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="w-full pt-0">
            <div className="flex items-center justify-between w-full">
              <MobileFiltersDrawer triggerText={t('common.search') || "Buscar"} results={renderOrdersTable()}>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 min-w-0">
                  <div className="md:hidden w-full">
                    <form onSubmit={handleSearch}>
                      <SearchInput  placeholder={t('orders.search') || "Search order number..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                    </form>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-muted-foreground md:hidden mb-1 uppercase">{t('common.filters') || 'Filtros'}</span>
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                      <TabsTrigger value="all" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('orders.tabs.all') || "All Orders"}>
                        <LayoutGrid size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('orders.tabs.all') || 'All Orders'}</span>
                      </TabsTrigger>
                      <TabsTrigger value="pending" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('orders.tabs.pending') || "Pending Orders"}>
                        <Clock size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('orders.tabs.pendingTitle') || 'Pending'}</span>
                      </TabsTrigger>
                      <TabsTrigger value="in_progress" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('orders.tabs.inProgress') || "Orders in Progress"}>
                        <PlayCircle size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('orders.tabs.inProgressTitle') || 'In Progress'}</span>
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('orders.tabs.completed') || "Completed Orders"}>
                        <CheckCircle2 size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('orders.tabs.completedTitle') || 'Completed'}</span>
                      </TabsTrigger>
                      <TabsTrigger value="cancelled" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('orders.tabs.cancelled') || "Cancelled Orders"}>
                        <Ban size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('orders.tabs.cancelledTitle') || 'Cancelled'}</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>
                
                  {locations.length > 0 && (
                    <Select
                      value={locationFilter}
                      onValueChange={(val) => { setLocationFilter(val); setPage(1); }}
                    >
                      <SelectTrigger className="w-full md:w-[160px] h-10 md:h-8 text-sm md:text-xs bg-background md:bg-muted/30 border md:border-0 rounded-md md:rounded-full">
                        <SelectValue placeholder={t('allLocations') || 'All Locations'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('allLocations') || 'All Locations'}</SelectItem>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <div className="md:hidden flex flex-col md:flex-row items-stretch md:items-center gap-2">
                    <CalendarDateRangePicker 
                      onRangeChange={handleDateRangeChange} 
                      initialStartDate={dateRange.startDate}
                      initialEndDate={dateRange.endDate} />
                  </div>

                  <div className="hidden md:flex items-center gap-2">
                    <form onSubmit={handleSearch}>
                      <SearchInput  placeholder={t('orders.search') || "Search order number..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}    className="w-full bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"  containerClassName="w-64" />
                    </form>
                  </div>
                </div>
              </MobileFiltersDrawer>

              <div className="ml-auto flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2">
                  <CalendarDateRangePicker 
                    onRangeChange={handleDateRangeChange} 
                    initialStartDate={dateRange.startDate}
                    initialEndDate={dateRange.endDate} />
                </div>
                
                <PrinterSyncBadge module="orders" />

                <ViewSelector currentView={viewType} onViewChange={setViewType} />
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="p-8 space-y-4 bg-muted/30 flex-1 min-h-0 overflow-auto">
          <div className={viewType === "kanban" ? "pb-4 -mx-8" : ""}>
            <div className={viewType === "kanban" ? "px-8" : "h-full flex flex-col"}>
              {!currentSite || isLoading ? (
                viewType === "kanban" ? <OrdersKanbanSkeleton /> : <OrdersTableSkeleton />
              ) : error ? (
                <div className="p-6 text-center text-red-500">
                  Failed to load orders. {error.message}
                </div>
              ) : viewType === "kanban" ? (
                <OrdersKanban
                  orders={data?.data || []}
                  onOrderClick={(order) => navigateToOrder({ orderId: order.id, orderNumber: order.order_number, router })}
                  onUpdateOrderStatus={handleUpdateOrderStatus} />
              ) : (
                <OrdersTable
                  orders={data?.data || []}
                  page={page}
                  pageSize={pageSize}
                  totalCount={data?.count ?? 0}
                  searchQuery={searchQuery}
                  onPageChange={setPage}
                  onOrderClick={(order) => navigateToOrder({ orderId: order.id, orderNumber: order.order_number, router })} />
              )}
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  )
}

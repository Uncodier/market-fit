"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listOrders, updateOrderStatus } from "./actions"
import { OrderParams } from "./types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
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

  return (
    <div className="flex-1 min-w-0 w-full p-0 bg-muted/30 min-h-[calc(100vh-var(--topbar-height,64px))]">
      <Tabs value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }} className="w-full">
        <StickyHeader className="border-b min-h-[71px] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="w-full pt-0">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                  <TabsTrigger value="all" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('orders.tabs.all') || "All Orders"}>
                    <LayoutGrid size={13} className="md:!hidden" />
                    <span className="tab-label">{t('orders.tabs.all') || 'All Orders'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('orders.tabs.pending') || "Pending Orders"}>
                    <Clock size={13} className="md:!hidden" />
                    <span className="tab-label">{t('orders.tabs.pendingTitle') || 'Pending'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="in_progress" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('orders.tabs.inProgress') || "Orders in Progress"}>
                    <PlayCircle size={13} className="md:!hidden" />
                    <span className="tab-label">{t('orders.tabs.inProgressTitle') || 'In Progress'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('orders.tabs.completed') || "Completed Orders"}>
                    <CheckCircle2 size={13} className="md:!hidden" />
                    <span className="tab-label">{t('orders.tabs.completedTitle') || 'Completed'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="cancelled" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('orders.tabs.cancelled') || "Cancelled Orders"}>
                    <Ban size={13} className="md:!hidden" />
                    <span className="tab-label">{t('orders.tabs.cancelledTitle') || 'Cancelled'}</span>
                  </TabsTrigger>
                </TabsList>
              
                {locations.length > 0 && (
                  <Select
                    value={locationFilter}
                    onValueChange={(val) => { setLocationFilter(val); setPage(1); }}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs bg-muted/30 border-0 rounded-full">
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

                <div className="flex items-center gap-2">
                  <form onSubmit={handleSearch} className="hidden md:block">
                    <SearchInput 
                      placeholder={t('orders.search') || "Search order number..."} 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                      alwaysExpanded={false}
                    />
                  </form>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <PrinterSyncBadge module="orders" />
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
                        // Optional: close dropdown on search submit
                      }}>
                        <SearchInput 
                          placeholder={t('orders.search') || "Search order number..."} 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="bg-background w-full border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                          alwaysExpanded={true}
                        />
                      </form>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <CalendarDateRangePicker 
                  onRangeChange={handleDateRangeChange} 
                  initialStartDate={dateRange.startDate}
                  initialEndDate={dateRange.endDate}
                />
                
                <ViewSelector currentView={viewType} onViewChange={setViewType} />
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="p-8 space-y-4 bg-muted/30 flex-1">
          <div className={viewType === "kanban" ? "overflow-x-auto pb-4 -mx-8" : ""}>
            <div className={viewType === "kanban" ? "min-w-fit px-8" : ""}>
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
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                />
              ) : (
                <OrdersTable
                  orders={data?.data || []}
                  page={page}
                  pageSize={pageSize}
                  totalCount={data?.count ?? 0}
                  searchQuery={searchQuery}
                  onPageChange={setPage}
                  onOrderClick={(order) => navigateToOrder({ orderId: order.id, orderNumber: order.order_number, router })}
                />
              )}
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  )
}

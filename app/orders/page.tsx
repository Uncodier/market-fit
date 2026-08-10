"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listOrders, updateOrderStatus } from "./actions"
import { OrderParams } from "./types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ExternalLink, LayoutGrid, Clock, CheckCircle2, Ban, ListOrdered, PlayCircle, Search } from "@/app/components/ui/icons"
import Link from "next/link"
import { format, subDays } from "date-fns"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { OrdersKanban } from "./components/OrdersKanban"
import { useOrdersRealtime } from "./hooks/useOrdersRealtime"
import { listLocations } from "@/app/inventory/actions"
import { toast } from "sonner"
import { navigateToOrder } from "@/app/hooks/use-navigation-history"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200",
  in_progress: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200",
}

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
  
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date()
  })

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
    }, false)

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
          <div className="flex flex-col gap-6">
            <div className={viewType === "kanban" ? "" : "bg-card rounded-xl shadow-sm border border-border overflow-hidden"}>
              {!currentSite || isLoading ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
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
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('orders.table.order') || 'Order'}</TableHead>
                        <TableHead>{t('orders.table.customer') || 'Customer'}</TableHead>
                        <TableHead>{t('orders.table.total') || 'Total'}</TableHead>
                        <TableHead>{t('orders.table.status') || 'Status'}</TableHead>
                        <TableHead>{t('orders.table.created') || 'Created'}</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.data && data.data.length > 0 ? (
                        data.data.map((order) => {
                          // Access lead if populated (note: our server action fetches it via sales, but it's joined differently)
                          // If lead isn't directly available, we can safely fallback to unknown
                          const leadName = (order.leads as any)?.name || 'Unknown Customer';
                          const leadEmail = (order.leads as any)?.email;
                          
                          const hasNewItems = order.sale_order_items?.some((item: any) => item.status === 'new') || false;
                          
                          return (
                            <TableRow key={order.id} className={cn(hasNewItems && "bg-amber-50/20 dark:bg-amber-500/5")}>
                              <TableCell>
                                <div className="font-medium text-foreground">
                                  {order.order_number}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  {order.sales?.source && (
                                    <span>
                                      {order.sales.source === 'online' || order.sales.source === 'shop' || order.sales.source === 'marketplace'
                                        ? t('orders.kanban.sourceOnline')
                                        : t('orders.kanban.sourcePos')}
                                    </span>
                                  )}
                                  {order.fulfillment_method && order.fulfillment_method !== 'none' && (
                                    <>
                                      {order.sales?.source && <span className="opacity-40">·</span>}
                                      <span>
                                        {t(`orders.kanban.fulfillment.${order.fulfillment_method}`) || order.fulfillment_method}
                                      </span>
                                    </>
                                  )}
                                  {order.sales?.status && (
                                    <>
                                      <span className="opacity-40">·</span>
                                      <span className={cn(
                                        "font-medium",
                                        (order.sales.status === 'completed' || order.sales.amount_due === 0)
                                          ? "text-emerald-700 dark:text-emerald-400"
                                          : "text-amber-700 dark:text-amber-400"
                                      )}>
                                        {(order.sales.status === 'completed' || order.sales.amount_due === 0)
                                          ? t('orders.kanban.paid')
                                          : t('orders.kanban.unpaid')}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{leadName}</div>
                                {leadEmail && <div className="text-xs text-muted-foreground">{leadEmail}</div>}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">
                                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(order.total)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={STATUS_STYLES[order.status] || ''}>
                                  {t(`orders.status.${order.status}`) || order.status.replace('_', ' ').toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-foreground">
                                  {format(new Date(order.created_at), 'MMM d, yyyy')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(order.created_at), 'h:mm a')}
                                </div>
                              </TableCell>
                              <TableCell>
                                <button 
                                  onClick={() => navigateToOrder({ orderId: order.id, orderNumber: order.order_number, router })}
                                  className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            <EmptyCard
                              icon={<ListOrdered size={24} className="text-muted-foreground" />}
                              title={t('orders.empty.title') || "No orders found"}
                              description={t('orders.empty.description') || (searchQuery ? "No orders match your search criteria." : "Orders will appear here once a checkout is completed.")}
                              className="border-0 shadow-none bg-transparent"
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  
                  {(data?.count ?? 0) > pageSize && (
                    <div className="p-4 border-t flex justify-center bg-muted/30">
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
        </div>
      </Tabs>
    </div>
  )
}

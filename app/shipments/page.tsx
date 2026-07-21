"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listShipments } from "./actions"
import { ShipmentParams } from "./types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Button } from "@/app/components/ui/button"
import { Send, Search, Eye, ExternalLink, LayoutGrid, Clock, Package, Truck, CheckCircle2, Ban, XCircle, ListOrdered, Check, ChevronDown, Filter } from "@/app/components/ui/icons"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { KanbanView } from "./components/KanbanView"
import { updateShipmentStatus } from "./actions"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-foreground hover:bg-muted/50 border-none",
  preparing: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/50",
  shipped: "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
  in_transit: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/50",
  delivered: "bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-900/50",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-900/50",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-300 dark:border-red-900/50",
}

export default function ShipmentsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewType, setViewType] = useMobileView("table")

  const fetcher = async (params: ShipmentParams) => {
    const res = await listShipments(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id ? { siteId: currentSite.id, page, pageSize, q: searchQuery, status: statusFilter } : null,
    fetcher
  )

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: t('layout.sidebar.shipments') || 'Shipments'
      }
    });
    window.dispatchEvent(event);
  }, [t]);

  useEffect(() => {
    const handleCreate = () => {
      toast.info(t('shipments.create_info') || 'Shipments are created automatically when orders are processed.')
    }
    window.addEventListener('shipments:create', handleCreate)
    return () => window.removeEventListener('shipments:create', handleCreate)
  }, [t]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    mutate()
  }

  const handleUpdateShipmentStatus = async (shipmentId: string, newStatus: string) => {
    if (!currentSite?.id) return
    
    try {
      const result = await updateShipmentStatus(currentSite.id, shipmentId, newStatus)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Shipment status updated")
      mutate()
    } catch (error) {
      toast.error("Error updating shipment")
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <Tabs value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }} className="flex-1 flex flex-col w-full h-full min-h-0">
        <StickyHeader>
          <div className="w-full pt-0">
            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                  <TabsTrigger value="all" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <LayoutGrid size={13} className="md:!hidden" />
                    <span className="tab-label">All</span>
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <Clock size={13} className="md:!hidden" />
                    <span className="tab-label">Pending</span>
                  </TabsTrigger>
                  <TabsTrigger value="preparing" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <Package size={13} className="md:!hidden" />
                    <span className="tab-label">Preparing</span>
                  </TabsTrigger>
                  <TabsTrigger value="shipped" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <Send size={13} className="md:!hidden" />
                    <span className="tab-label">Shipped</span>
                  </TabsTrigger>
                  <TabsTrigger value="in_transit" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <Truck size={13} className="md:!hidden" />
                    <span className="tab-label">In Transit</span>
                  </TabsTrigger>
                  <TabsTrigger value="delivered" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={13} className="md:!hidden" />
                    <span className="tab-label">Delivered</span>
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto md:ml-auto">
                <form onSubmit={handleSearch} className="w-full md:w-auto">
                  <SearchInput 
                    placeholder={t('shipments.search') || "Search tracking or customer..."} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    alwaysExpanded={false}
                  />
                </form>
                <div className="hidden md:flex ml-2">
                  <ViewSelector currentView={viewType} onViewChange={setViewType} />
                </div>
              </div>
            </div>
            {/* Mobile View Selector */}
            <div className="md:hidden flex justify-end mt-2">
              <ViewSelector currentView={viewType} onViewChange={setViewType} />
            </div>
          </div>
        </StickyHeader>

        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="mx-auto w-full max-w-[1200px] flex flex-col gap-6">
            <div className={cn(viewType === 'table' ? "bg-card rounded-xl shadow-sm border border-border overflow-hidden" : "")}>
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="p-6 text-center text-red-500">
                  Failed to load shipments. {error.message}
                </div>
              ) : data?.data && data.data.length > 0 ? (
                <>
                  {viewType === 'table' ? (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Tracking</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.data.map((shipment) => (
                            <TableRow key={shipment.id}>
                              <TableCell>
                                <div className="font-medium text-foreground">
                                  {shipment.sale_order_id ? (
                                    <Link href={`/orders/${shipment.sale_order_id}`} className="hover:underline text-blue-600">
                                      {shipment.sale_orders?.order_number || 'Unknown Order'}
                                    </Link>
                                  ) : (
                                    shipment.sale_orders?.order_number || 'Unknown Order'
                                  )}
                                </div>
                                {shipment.locations?.name && (
                                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center">
                                    <Send className="h-3 w-3 mr-1" /> From: {shipment.locations.name}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{shipment.leads?.name || 'Unknown'}</div>
                                {shipment.leads?.email && <div className="text-xs text-muted-foreground">{shipment.leads.email}</div>}
                              </TableCell>
                              <TableCell>
                                {shipment.tracking_number ? (
                                  <div className="text-sm">
                                    <div className="font-mono">{shipment.tracking_number}</div>
                                    <div className="text-xs text-muted-foreground">{shipment.carrier || 'Unknown Carrier'}</div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">Not assigned</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className={STATUS_STYLES[shipment.status] || ''}>
                                  {shipment.status.replace('_', ' ').toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-foreground">
                                  {format(new Date(shipment.created_at), 'MMM d, yyyy')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(shipment.created_at), 'h:mm a')}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Link 
                                  href={`/shipments/${shipment.id}`} 
                                  className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      {data.count > pageSize && (
                        <div className="p-4 border-t flex justify-center bg-muted/30">
                          <Pagination 
                            currentPage={page}
                            totalPages={Math.ceil(data.count / pageSize)}
                            onPageChange={setPage}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={viewType === 'kanban' ? "overflow-x-auto -mx-4 md:-mx-6" : ""}>
                      <div className={viewType === 'kanban' ? "px-4 md:px-6" : ""}>
                        <KanbanView 
                          shipments={data.data} 
                          onUpdateShipmentStatus={handleUpdateShipmentStatus} 
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <EmptyCard
                  icon={<Send className="h-6 w-6" />}
                  title={t('shipments.empty.title') || "No shipments found"}
                  description={t('shipments.empty.description') || (searchQuery ? "No shipments match your search criteria." : "Shipments will appear here once an order is created with shipping.")}
                />
              )}
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  )
}

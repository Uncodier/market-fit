"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listShipments, updateShipmentStatus } from "./actions"
import { ShipmentParams } from "./types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Send, LayoutGrid, Clock, Package, Truck, CheckCircle2 } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { ViewSelector } from "@/app/components/view-selector"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { KanbanView } from "./components/KanbanView"
import { ShipmentsTable, ShipmentsTableSkeleton } from "./components/ShipmentsTable"
import { listLocations } from "@/app/inventory/actions"
import { cn } from "@/lib/utils"
import { navigateToShipment } from "@/app/hooks/use-navigation-history"
import { useRouter } from "next/navigation"
import { CreateShipmentDialog } from "./components/CreateShipmentDialog"
import { EmptyCard } from "@/app/components/ui/empty-card"

export default function ShipmentsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()

  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [viewType, setViewType] = useMobileView("table")

  const { data: locationsData } = useSWR(
    currentSite?.id ? ["locations", currentSite.id] : null,
    () => listLocations(currentSite!.id)
  )
  const locations = locationsData?.data || []

  const fetcher = async (params: ShipmentParams) => {
    const res = await listShipments(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id
      ? { siteId: currentSite.id, page, pageSize, q: searchQuery, status: statusFilter, locationId: locationFilter }
      : null,
    fetcher
  )

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: {
        title: t("layout.sidebar.shipments") || "Shipments",
      },
    })
    window.dispatchEvent(event)
  }, [t])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    mutate()
  }

  const handleUpdateShipmentStatus = async (shipmentId: string, newStatus: string) => {
    if (!currentSite?.id) return

    // Optimistic update
    mutate(data => {
      if (!data) return data;
      return {
        ...data,
        data: data.data.map((shipment: any) => 
          shipment.id === shipmentId ? { ...shipment, status: newStatus } : shipment
        )
      }
    }, { revalidate: false })

    try {
      const result = await updateShipmentStatus(currentSite.id, shipmentId, newStatus)
      if (result.error) {
        toast.error(result.error)
        mutate() // Revert
        return
      }
      toast.success("Shipment status updated")
      mutate()
    } catch (error) {
      toast.error("Error updating shipment")
      mutate() // Revert
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <CreateShipmentDialog />
      <Tabs value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }} className="flex-1 flex flex-col w-full h-full min-h-0">
        <StickyHeader>
          <div className="w-full pt-0">
              <div className="flex items-center justify-between gap-2 w-full">
              <MobileFiltersDrawer triggerText={t('common.search') || "Buscar"}>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 min-w-0">
                  <div className="md:hidden w-full">
                    <form onSubmit={handleSearch} className="w-full">
                      <SearchInput  placeholder={t("shipments.search") || "Search tracking or customer..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                    </form>
                  </div>
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    <span className="text-xs font-semibold text-muted-foreground md:hidden mb-1 uppercase">{t('common.filters') || 'Filtros'}</span>
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                      <TabsTrigger value="all" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap">
                        <LayoutGrid size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">All</span>
                      </TabsTrigger>
                      <TabsTrigger value="pending" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap">
                        <Clock size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">Pending</span>
                      </TabsTrigger>
                      <TabsTrigger value="preparing" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap">
                        <Package size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">Preparing</span>
                      </TabsTrigger>
                      <TabsTrigger value="shipped" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap">
                        <Send size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">Shipped</span>
                      </TabsTrigger>
                      <TabsTrigger value="in_transit" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap">
                        <Truck size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">In Transit</span>
                      </TabsTrigger>
                      <TabsTrigger value="delivered" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap">
                        <CheckCircle2 size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">Delivered</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {locations.length > 0 && (
                    <Select
                      value={locationFilter}
                      onValueChange={(val) => { setLocationFilter(val); setPage(1); }}
                    >
                      <SelectTrigger className="w-[160px] h-8 text-xs bg-muted/30 border-0 rounded-full">
                        <SelectValue placeholder={t("allLocations") || "All Locations"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("allLocations") || "All Locations"}</SelectItem>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <div className="hidden md:block">
                    <form onSubmit={handleSearch} className="w-full md:w-auto">
                      <SearchInput  
                        placeholder={t("shipments.search") || "Search tracking or customer..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}  className="w-full h-10 md:h-9"  containerClassName="w-full" />
                    </form>
                  </div>
                </div>
              </MobileFiltersDrawer>
              <div className="flex items-center gap-2 w-auto justify-end shrink-0">
                <div className="flex">
                  <ViewSelector currentView={viewType} onViewChange={setViewType} />
                </div>
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <div className={cn(viewType === "kanban" ? "overflow-x-auto -mx-4 md:-mx-6" : "")}>
            <div className={cn(viewType === "kanban" ? "px-4 md:px-6" : "")}>
              {!currentSite || isLoading ? (
                <ShipmentsTableSkeleton />
              ) : error ? (
                <div className="p-6 text-center text-red-500">
                  Failed to load shipments. {error.message}
                </div>
              ) : viewType === "kanban" ? (
                data?.data && data.data.length > 0 ? (
                  <KanbanView
                    shipments={data.data}
                    onUpdateShipmentStatus={handleUpdateShipmentStatus} />
                ) : (
                  <EmptyCard
                    icon={<Send className="h-6 w-6 text-muted-foreground" />}
                    title={t("shipments.empty.title") || "No shipments found"}
                    description={t("shipments.empty.description") || (searchQuery ? "No shipments match your search criteria." : "Shipments will appear here once an order is created with shipping.")} />
                )
              ) : (
                <ShipmentsTable
                  shipments={data?.data || []}
                  page={page}
                  pageSize={pageSize}
                  totalCount={data?.count ?? 0}
                  searchQuery={searchQuery}
                  onPageChange={setPage}
                  onShipmentClick={(shipment) => navigateToShipment({ shipmentId: shipment.id, router })} />
              )}
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  )
}

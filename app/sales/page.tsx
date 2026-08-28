"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
import { Filter, ListOrdered, Check, ChevronDown } from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useSite } from "@/app/context/SiteContext"
import { getSales, updateSale } from "./actions"
import { listLocations } from "@/app/inventory/actions"
import { toast } from "sonner"
import { getSegments } from "@/app/segments/actions"
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { subDays, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns"
import { Sale } from "@/app/types"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { useRouter } from "next/navigation"
import { navigateToSale } from "@/app/hooks/use-navigation-history"
import { RegisterPaymentDialog } from "./components/RegisterPaymentDialog"
import { ViewSelector } from "@/app/components/view-selector"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { KanbanView } from "./components/KanbanView"
import { CreateSaleDialog } from "./components/CreateSaleDialog"
import { SalesTable, SalesTableSkeleton } from "./components/SalesTable"
import { useCommandK } from "@/app/hooks/use-command-k"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// PrintSaleDialog component
interface PrintSaleDialogProps {
  sale: Sale | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (id: string) => void
}

function PrintSaleDialog({ sale, open, onOpenChange, onConfirm }: PrintSaleDialogProps) {
  if (!sale) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Print Sale</DialogTitle>
          <DialogDescription>
            Confirm the sale information before printing.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p><strong>Product:</strong> {sale.title} ({sale.productName})</p>
          <p><strong>Amount:</strong> {formatCurrency(sale.amount)}</p>
          <p><strong>Customer:</strong> {sale.leadName || "Anonymous Customer"}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(sale.id)}>
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function SalesPage() {
  const { t } = useLocalization()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [viewType, setViewType] = useMobileView("table")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "value_desc" | "value_asc">("newest")
  const [dateRange, setDateRange] = useState({
    startDate: startOfDay(subDays(new Date(), 30)),
    endDate: endOfDay(new Date())
  })
  const { currentSite } = useSite()
  const router = useRouter()
  
  // Use the command+k hook
  useCommandK()
  
  // States for dialog controls
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [registerPaymentOpen, setRegisterPaymentOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)

  const { data: salesData, isLoading: isLoadingSales, mutate: mutateSales } = useSWR(
    currentSite?.id ? ['sales', currentSite.id] : null,
    async ([_, siteId]) => {
      const result = await getSales(siteId)
      if (result.error) throw new Error(result.error)
      return result.sales || []
    },
    {}
  )

  const { data: locationsData } = useSWR(
    currentSite?.id ? ['locations', currentSite.id] : null,
    () => listLocations(currentSite!.id)
  )
  const locations = locationsData?.data || []

  const { data: segmentsData, isLoading: isLoadingSegments } = useSWR(
    currentSite?.id ? ['segments', currentSite.id] : null,
    async ([_, siteId]) => {
      const { segments, error } = await getSegments(siteId)
      if (error) throw new Error(error)
      return segments ? segments.map(s => ({ id: s.id, name: s.name })) : []
    },
    {}
  )

  const sales = salesData || []
  const segments = segmentsData || []
  const loading = isLoadingSales || isLoadingSegments

  const loadSales = async () => { mutateSales() }

  // Search query change handler
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  // Date range change handler
  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setDateRange({ startDate, endDate })
    setCurrentPage(1)
  }

  // Create sale success handler
  const handleCreateSuccess = () => {
    loadSales()
  }

  // Effect to handle create dialog state from TopBar
  useEffect(() => {
    const handleCreateSale = () => {
      setIsCreateDialogOpen(true)
    }

    window.addEventListener('sales:create', handleCreateSale)
    return () => {
      window.removeEventListener('sales:create', handleCreateSale)
    }
  }, [])

  // Filter sales based on status, search query, and date range
  const getFilteredSales = (status: string) => {
    if (!sales) return []
    
    // First filter by status
    let filtered = sales
    if (status !== "all") {
      filtered = filtered.filter(sale => sale.status === status)
    }

    // Then filter by location
    if (locationFilter !== "all") {
      filtered = filtered.filter(sale => sale.locationId === locationFilter)
    }
    
    // Then filter by date range
    filtered = filtered.filter(sale => {
      try {
        const saleDate = parseISO(sale.saleDate)
        return isWithinInterval(saleDate, {
          start: dateRange.startDate,
          end: dateRange.endDate
        })
      } catch (error) {
        console.error("Error parsing sale date:", error)
        return true // Include sale if date parsing fails
      }
    })
    
    // Then filter by search query if it exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(sale => 
        sale.title?.toLowerCase().includes(query) || 
        sale.productName?.toLowerCase().includes(query) ||
        sale.leadName?.toLowerCase().includes(query) ||
        formatCurrency(sale.amount).includes(query) ||
        sale.source.toLowerCase().includes(query) ||
        sale.status.toLowerCase().includes(query)
      )
    }
    
    return filtered.sort((a, b) => {
      const dateA = new Date(a.saleDate || 0).getTime()
      const dateB = new Date(b.saleDate || 0).getTime()
      const valueA = a.amount || 0
      const valueB = b.amount || 0

      if (sortBy === "newest") return dateB - dateA
      if (sortBy === "oldest") return dateA - dateB
      if (sortBy === "value_desc") return valueB - valueA
      if (sortBy === "value_asc") return valueA - valueB
      return 0
    })
  }
  
  const filteredSales = getFilteredSales(activeTab)
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage)
  
  // Get sales for current page
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentSales = filteredSales.slice(indexOfFirstItem, indexOfLastItem)
  
  // Page change handler
  function handlePageChange(page: number) {
    setCurrentPage(page)
  }

  // Reset page when tab changes, location filter changes or date range changes
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, locationFilter, dateRange])

  // Items per page change handler
  function handleItemsPerPageChange(value: string) {
    setItemsPerPage(Number(value))
    setCurrentPage(1)
  }
  
  // Sale click handler (for future details view)
  const handleSaleClick = (sale: Sale) => {
    navigateToSale({
      saleId: sale.id,
      saleName: sale.title || `Sale ${sale.id.substring(0, 8)}`,
      router
    })
  }

  // Print sale handler
  const handlePrintSale = (sale: Sale) => {
    setSelectedSale(sale)
    setPrintDialogOpen(true)
  }

  // Register Payment handler
  const handleRegisterPayment = (sale: Sale) => {
    setSelectedSale(sale)
    setRegisterPaymentOpen(true)
  }

  // Handle payment success
  const handlePaymentSuccess = async () => {
    if (!currentSite?.id) return
    
    // Refresh the sales data
    await loadSales()
    toast.success("Payment registered successfully")
  }

  // Confirm print sale
  const handleConfirmPrint = async (id: string) => {
    // Open the print-friendly page in a new window
    window.open(`/invoice-pdf/${id}`, '_blank');
    setPrintDialogOpen(false);
  };

  // Function to update sale status (for Kanban view)
  const handleUpdateSaleStatus = async (saleId: string, newStatus: string) => {
    const sale = sales.find(s => s.id === saleId)
    if (!sale || !currentSite?.id) return
    
    // Optimistic update
    mutateSales(
      (prev) => prev?.map((s) => s.id === saleId ? { ...s, status: newStatus as any } : s),
      { revalidate: false }
    )
    
    try {
      const result = await updateSale(currentSite.id, {
        ...sale,
        status: newStatus as any
      })
      
      if (result.error) {
        toast.error(result.error)
        mutateSales() // Revert
        return
      }
      
      toast.success("Sale status updated successfully")
    } catch (error) {
      console.error("Error updating sale status:", error)
      toast.error("Error updating sale status")
      mutateSales() // Revert
    }
  }

  return (
      <div className="flex-1 min-w-0 w-full p-0 min-h-[calc(100dvh-var(--topbar-height,64px))] flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col w-full h-full min-h-0">
          <StickyHeader>
            <div className="w-full pt-0">
              <div className="flex items-center justify-between w-full">
                <MobileFiltersDrawer triggerText={t('common.search') || "Buscar"}>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 min-w-0">
                <div className="md:hidden w-full mb-2">
                  <SearchInput placeholder={t('sales.search.placeholder') || "Search sales..."} value={searchQuery} onChange={handleSearchChange} alwaysExpanded={true} className="w-full h-10 md:h-9" containerClassName="w-full" />
                </div>
                  <div className="flex items-center gap-4">
                  <span className="text-xs font-semibold text-muted-foreground md:hidden mb-1 uppercase">{t('common.filters') || 'Filtros'}</span>
                  <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                    <TabsTrigger value="all" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('sales.tabs.all') || "All Sales"}>
                      <span className="tab-label">{t('sales.tabs.all') || 'All Sales'}</span>
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('sales.tabs.pending') || "Pending"}>
                      <span className="tab-label">{t('sales.tabs.pending') || 'Pending'}</span>
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('sales.tabs.completed') || "Completed"}>
                      <span className="tab-label">{t('sales.tabs.completed') || 'Completed'}</span>
                    </TabsTrigger>
                    <TabsTrigger value="cancelled" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('sales.tabs.cancelled') || "Cancelled"}>
                      <span className="tab-label">{t('sales.tabs.cancelled') || 'Cancelled'}</span>
                    </TabsTrigger>
                    <TabsTrigger value="refunded" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('sales.tabs.refunded') || "Refunded"}>
                      <span className="tab-label">{t('sales.tabs.refunded') || 'Refunded'}</span>
                    </TabsTrigger>
                  </TabsList>
                  </div>

                  {locations.length > 0 && (
                    <Select
                      value={locationFilter}
                      onValueChange={(val) => { setLocationFilter(val); setCurrentPage(1); }}
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

                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" className="w-full md:w-auto h-10 md:h-8 gap-2 rounded-md md:rounded-full px-4 justify-between md:justify-center" title="Sort by">
                          <div className="flex items-center gap-2">
                            <ListOrdered className="h-4 w-4" />
                            <span className="font-normal">
                              {sortBy === "newest"
                                ? "Newest"
                                : sortBy === "oldest"
                                  ? "Oldest"
                                  : sortBy === "value_desc"
                                    ? "Highest Value"
                                    : "Lowest Value"}
                            </span>
                          </div>
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem className="cursor-pointer" onClick={() => setSortBy("newest")}>
                          <Check className={cn("mr-2 h-4 w-4", sortBy === "newest" ? "opacity-100" : "opacity-0")} />
                          Newest
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onClick={() => setSortBy("oldest")}>
                          <Check className={cn("mr-2 h-4 w-4", sortBy === "oldest" ? "opacity-100" : "opacity-0")} />
                          Oldest
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onClick={() => setSortBy("value_desc")}>
                          <Check className={cn("mr-2 h-4 w-4", sortBy === "value_desc" ? "opacity-100" : "opacity-0")} />
                          Highest Value
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onClick={() => setSortBy("value_asc")}>
                          <Check className={cn("mr-2 h-4 w-4", sortBy === "value_asc" ? "opacity-100" : "opacity-0")} />
                          Lowest Value
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <CalendarDateRangePicker 
                      onRangeChange={handleDateRangeChange} 
                      initialStartDate={dateRange.startDate}
                      initialEndDate={dateRange.endDate} />
                  </div>

                  <div className="hidden md:flex items-center gap-2 w-full md:w-auto">
                    <SearchInput  data-command-k-input placeholder={t('sales.search.placeholder') || "Search sales..."} value={searchQuery} onChange={handleSearchChange}    className="w-full"  containerClassName="w-64" />
                  </div>
                </div>
              </MobileFiltersDrawer>
                
              <div className="ml-auto flex flex-wrap justify-end items-center gap-2 shrink-0">
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
              {loading ? (
                <SalesTableSkeleton />
              ) : (
                <KanbanView
                  sales={filteredSales}
                  onUpdateSaleStatus={handleUpdateSaleStatus}
                  segments={segments}
                  onSaleClick={handleSaleClick}
                  onPrintSale={handlePrintSale}
                  onRegisterPayment={handleRegisterPayment} />
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {loading ? (
                <SalesTableSkeleton />
              ) : (
                <SalesTable
                  sales={currentSales}
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  totalSales={filteredSales.length}
                  segments={segments}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  onSaleClick={handleSaleClick}
                  onPrintSale={handlePrintSale}
                  onRegisterPayment={handleRegisterPayment} />
              )}
            </div>
          )}
        </div>
        </Tabs>
        
        {/* Print Sale Dialog */}
        <PrintSaleDialog
          sale={selectedSale}
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          onConfirm={handleConfirmPrint} />

        {/* Register Payment Dialog */}
        <RegisterPaymentDialog
          sale={selectedSale}
          open={registerPaymentOpen}
          onOpenChange={setRegisterPaymentOpen}
          onSuccess={handlePaymentSuccess} />

        {/* Create Sale Dialog */}
        <CreateSaleDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSuccess={handleCreateSuccess} />
      </div>
  )
} 
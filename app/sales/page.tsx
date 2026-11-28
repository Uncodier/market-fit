"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
import { Download } from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"
import { useFinanceWorkspace } from "@/app/finance/use-finance-workspace"
import { getSales, updateSale } from "./actions"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { subDays, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns"
import { Sale } from "@/app/types"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { useRouter } from "next/navigation"
import { navigateToSale } from "@/lib/navigation/navigation-helpers"
import { RegisterPaymentDialog } from "./components/RegisterPaymentDialog"
import { ViewSelector } from "@/app/components/view-selector"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { KanbanView } from "./components/KanbanView"
import { CreateSaleDialog } from "./components/CreateSaleDialog"
import { SalesTable, SalesTableSkeleton } from "./components/SalesTable"
import { useCommandK } from "@/app/hooks/use-command-k"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { SalesLocationFilter } from "./components/SalesLocationFilter"
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
  const workspace = useFinanceWorkspace()
  if (workspace.loading) return <SalesTableSkeleton />
  if (!workspace.ready || !workspace.siteId || !workspace.actorId) return <p role="status">Select a workspace to view sales.</p>
  return <WorkspaceSales key={workspace.key} siteId={workspace.siteId} actorId={workspace.actorId} />
}

function WorkspaceSales({ siteId, actorId }: { siteId: string; actorId: string }) {
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
  const router = useRouter()
  
  // Use the command+k hook
  useCommandK()
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [registerPaymentOpen, setRegisterPaymentOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)

  const { data: result, error, isLoading: loading, mutate: mutateSales } = useSWR(
    ['sales-list', siteId, actorId], ([, id]) => getSales(id).catch(() => ({ error: 'Sales unavailable', sales: undefined })),
    { keepPreviousData: false }
  )
  const sales = result?.sales ?? []

  const loadSales = async () => {
    setCurrentPage(1)
    await mutateSales()
  }

  // Search query change handler
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  const handleExportSales = async () => {
    try {
      const response = await fetch(
        `/api/sales/export?siteId=${siteId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting sales:", error);
      toast.error("Failed to export sales");
    }
  };

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

      if (sortBy === "newest") {
        return dateB - dateA || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      }
      if (sortBy === "oldest") {
        return dateA - dateB || new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      }
      if (sortBy === "value_desc") return valueB - valueA
      if (sortBy === "value_asc") return valueA - valueB
      return 0
    })
  }
  
  const filteredSales = getFilteredSales(activeTab)
  
  // Get sales for current page
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentSales = filteredSales.slice(indexOfFirstItem, indexOfLastItem)
  
  // Page change handler
  function handlePageChange(page: number) {
    setCurrentPage(page)
  }

  // Items per page change handler
  function handleItemsPerPageChange(value: string) {
    setItemsPerPage(Number(value))
    setCurrentPage(1)
  }
  
  // Sale click handler (for future details view)
  const handleSaleClick = (sale: Sale, order = filteredSales) => {
    navigateToSale({
      saleId: sale.id,
      saleName: sale.title || `Sale ${sale.id.substring(0, 8)}`,
      origin: { siteId, rows: order },
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
    if (!sale) return
    
    // Optimistic update
    mutateSales(
      (prev) => prev?.sales ? { sales: prev.sales.map(s => s.id === saleId ? { ...s, status: newStatus as Sale['status'] } : s) } : prev,
      { revalidate: false }
    )
    
    try {
      const result = await updateSale(siteId, {
        ...sale,
        status: newStatus as Sale['status']
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
        <Tabs value={activeTab} onValueChange={value => { setActiveTab(value); setCurrentPage(1) }} className="flex-1 flex flex-col w-full h-full min-h-0">
          <StickyHeader>
            <div className="w-full pt-0">
              <div className="flex items-center justify-between w-full">
                <MobileFiltersDrawer triggerText={t('common.search') || "Search"}
                  actions={<ToolbarIconButton label={t("layout.topbar.export") || "Export"} onClick={handleExportSales}>
                    <Download className="h-4 w-4" aria-hidden />
                  </ToolbarIconButton>}
                  controls={<>
                    <CalendarDateRangePicker iconOnly className="hidden md:flex" onRangeChange={handleDateRangeChange}
                      initialStartDate={dateRange.startDate} initialEndDate={dateRange.endDate} />
                    <SortDropdown sortBy={sortBy} setSortBy={setSortBy} options={[
                      { value: "newest", label: "Newest" },
                      { value: "oldest", label: "Oldest" },
                      { value: "value_desc", label: "Highest Value" },
                      { value: "value_asc", label: "Lowest Value" },
                    ]} />
                    <ViewSelector currentView={viewType} onViewChange={setViewType} />
                  </>}
                >
                  <FilterContainer>
                    <FilterSection zone="search" mobileOnly>
                      <SearchInput placeholder={t('sales.search.placeholder') || "Search sales..."} value={searchQuery} onChange={handleSearchChange} alwaysExpanded={true} className="w-full h-10 md:h-9" containerClassName="w-full" />
                    </FilterSection>

                    

                    <FilterSection zone="tabs" title={t('common.status') || 'Status'} className={cn(searchQuery && "max-md:hidden")}>
                      <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap md:flex-row w-full md:max-w-full overflow-y-visible md:overflow-x-auto justify-start items-center gap-2 md:gap-0">
                        <TabsTrigger value="all" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('sales.tabs.all') || "All Sales"}>
                          <span className="tab-label">{t('sales.tabs.all') || 'All Sales'}</span>
                        </TabsTrigger>
                        <TabsTrigger value="pending" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('sales.tabs.pending') || "Pending"}>
                          <span className="tab-label">{t('sales.tabs.pending') || 'Pending'}</span>
                        </TabsTrigger>
                        <TabsTrigger value="completed" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('sales.tabs.completed') || "Completed"}>
                          <span className="tab-label">{t('sales.tabs.completed') || 'Completed'}</span>
                        </TabsTrigger>
                        <TabsTrigger value="cancelled" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('sales.tabs.cancelled') || "Cancelled"}>
                          <span className="tab-label">{t('sales.tabs.cancelled') || 'Cancelled'}</span>
                        </TabsTrigger>
                        <TabsTrigger value="refunded" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('sales.tabs.refunded') || "Refunded"}>
                          <span className="tab-label">{t('sales.tabs.refunded') || 'Refunded'}</span>
                        </TabsTrigger>
                      </TabsList>
                    </FilterSection>

                    <FilterSection className={cn(searchQuery && "max-md:hidden")} title={t('common.location') || 'Location'}>
                      <SalesLocationFilter siteId={siteId} actorId={actorId} value={locationFilter}
                        onChange={value => { setLocationFilter(value); setCurrentPage(1) }} />
                    </FilterSection>

                    <FilterSection mobileOnly className={cn(searchQuery && "hidden")} title={t('common.dateRange') || 'Date Range'}> 
                    <CalendarDateRangePicker
                        iconOnly
                        onRangeChange={handleDateRangeChange} 
                        initialStartDate={dateRange.startDate}
                        initialEndDate={dateRange.endDate} />
                    </FilterSection>

                    <FilterSection zone="search" desktopOnly>
                      <SearchInput  data-command-k-input placeholder={t('sales.search.placeholder') || "Search sales..."} value={searchQuery} onChange={handleSearchChange}    className="w-full"  containerClassName="w-64" />
                    </FilterSection>
                  </FilterContainer>
                </MobileFiltersDrawer>
                
            </div>
            </div>
          </StickyHeader>
          
        <div className={cn(
          "bg-muted/30 flex-1 min-h-0 min-w-0 overflow-y-auto",
          viewType === "kanban" ? "py-4 md:py-8" : "p-4 md:p-8 space-y-4 overflow-x-hidden"
        )}>
          {error || result?.error ? <div role="alert" className="space-y-2 rounded-lg border p-4">
            <p>Sales could not be loaded.</p>
            <Button variant="outline" onClick={() => { void mutateSales() }}>Retry sales</Button>
          </div> : viewType === "kanban" ? (
            <div className="h-full min-w-0 w-full">
              {loading ? (
                <SalesTableSkeleton />
              ) : (
                <KanbanView
                  sales={filteredSales}
                  onUpdateSaleStatus={handleUpdateSaleStatus}
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
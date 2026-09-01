"use client"

// app/deals/page.tsx needs to use Kanban view as default

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { getDeals } from "./actions"
import { Deal } from "./types"
import { DealsTable } from "./components/DealsTable"
import { DealsKanban, DealsKanbanSkeleton } from "./components/DealsKanban"
import { updateDeal } from "./actions"
import { toast } from "sonner"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { Search, Briefcase, ListOrdered, Check, ChevronDown } from "@/app/components/ui/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { useLocalization } from "@/app/context/LocalizationContext"
import { navigateToDeal } from "@/lib/navigation/navigation-helpers"
import { IsEmpty } from "@/app/components/ui/empty-state"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { LayoutGrid, Target, XCircle, TrendingUp } from "@/app/components/ui/icons"

function DealsTableSkeleton() {
  return (
    <div className="border rounded-xl bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]"><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead className="w-[140px]"><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead className="w-[120px]"><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead className="w-[130px]"><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead className="w-[130px]"><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead className="w-[160px]"><Skeleton className="h-4 w-20" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array(5).fill(0).map((_, index) => (
            <TableRow key={index}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-6 w-24 rounded border" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default function DealsPage() {
  const { t } = useLocalization()
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewType, setViewType] = useMobileView("kanban")
  const { currentSite } = useSite()
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "value_desc" | "value_asc">("newest")

  const { data: dbDealsData, isLoading: loading, mutate: mutateDeals } = useSWR(
    currentSite?.id ? ['deals', currentSite.id] : null,
    async ([_, siteId]) => {
      const result = await getDeals(siteId)
      if (result.error) throw new Error(result.error)
      return result.deals || []
    },
    {}
  )

  const dbDeals = dbDealsData || []

  const loadDeals = async (silent = false) => {
    await mutateDeals()
  }

  useEffect(() => {
    // Register global refresh function for when deals are created
    if (typeof window !== 'undefined') {
      (window as any).refreshDealsList = () => {
        loadDeals(true)
      }
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).refreshDealsList
      }
    }
  }, [currentSite])


  const getFilteredDeals = (status: string) => {
    let filtered = dbDeals
    
    // Status tab filter
    if (status !== "all") {
      filtered = filtered.filter(deal => deal.status === status)
    }

    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(deal => 
        deal.name?.toLowerCase().includes(q) ||
        deal.companies?.name?.toLowerCase().includes(q) ||
        deal.company?.name?.toLowerCase().includes(q)
      )
    }

    // Sort logic
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      const valueA = a.amount || 0
      const valueB = b.amount || 0
      
      if (sortBy === 'newest') return dateB - dateA
      if (sortBy === 'oldest') return dateA - dateB
      if (sortBy === 'value_desc') return valueB - valueA
      if (sortBy === 'value_asc') return valueA - valueB
      return 0
    })

    return filtered
  }

  const filteredDeals = getFilteredDeals(activeTab)

  const handlePageChange = (page: number) => setCurrentPage(page)
  
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])
  
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value))
    setCurrentPage(1)
  }

  const handleDealClick = (deal: Deal) => {
    navigateToDeal({ dealId: deal.id, dealName: deal.name, router })
  }

  const handleUpdateDealStage = async (dealId: string, newStage: string) => {
    let newStatus: Deal["status"] = "open"
    if (newStage === "closed_won") newStatus = "won"
    if (newStage === "closed_lost") newStatus = "lost"

    // Optimistic update
    mutateDeals(
      (prevDeals = []) => 
        prevDeals.map(deal => 
          deal.id === dealId ? { ...deal, stage: newStage as Deal["stage"], status: newStatus } : deal
        ),
      { revalidate: false }
    )

    try {
      const result = await updateDeal({ id: dealId, stage: newStage as Deal["stage"], status: newStatus })
      if (result.error) {
        toast.error(result.error)
        // Revert on error
        loadDeals(true)
      } else {
        toast.success(t('deals.success.updated') || "Deal stage updated")
      }
    } catch (error) {
      console.error("Error updating deal stage:", error)
      toast.error(t('deals.error.updateFailed') || "Failed to update deal stage")
      // Revert on error
      loadDeals(true)
    }
  }

  return (
    <div className="flex-1 min-w-0 w-full p-0 bg-muted/30 min-h-[calc(100vh-var(--topbar-height,64px))]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <StickyHeader className="border-b min-h-[71px] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="w-full pt-0">
              <div className="flex items-center justify-between w-full">
              <MobileFiltersDrawer triggerText={t('common.search') || "Buscar"}>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 min-w-0">
                  <div className="md:hidden w-full">
                    <SearchInput  placeholder={t('deals.search') || "Search deals..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                  </div>
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    <span className="text-xs font-semibold text-muted-foreground md:hidden mb-1 uppercase">{t('common.filters') || 'Filtros'}</span>
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                      <TabsTrigger value="all" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('deals.tabs.all') || "All Deals"}>
                        <LayoutGrid size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('deals.tabs.all') || 'All Deals'}</span>
                      </TabsTrigger>
                      <TabsTrigger value="open" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('deals.tabs.open') || "Open Deals"}>
                        <Target size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('deals.tabs.openTitle') || 'Open'}</span>
                      </TabsTrigger>
                      <TabsTrigger value="won" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('deals.tabs.won') || "Won Deals"}>
                        <TrendingUp size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('deals.tabs.wonTitle') || 'Won'}</span>
                      </TabsTrigger>
                      <TabsTrigger value="lost" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-nowrap" title={t('deals.tabs.lost') || "Lost Deals"}>
                        <XCircle size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('deals.tabs.lostTitle') || 'Lost'}</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <div className="hidden md:flex flex-col gap-2">
                    <SearchInput  placeholder={t('deals.search') || "Search deals..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}    className="w-full bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"  containerClassName="w-64" />
                  </div>
                </div>
              </MobileFiltersDrawer>
              <div className="ml-auto flex items-center gap-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-full px-4" title={t('deals.sortBy') === 'deals.sortBy' ? 'Sort by' : t('deals.sortBy')}>
                        <ListOrdered className="h-4 w-4" />
                        <span className="hidden sm:inline font-normal">
                          {sortBy === "newest"
                            ? (t('deals.sort.newest') === 'deals.sort.newest' ? 'Newest' : t('deals.sort.newest'))
                            : sortBy === "oldest"
                              ? (t('deals.sort.oldest') === 'deals.sort.oldest' ? 'Oldest' : t('deals.sort.oldest'))
                              : sortBy === "value_desc"
                                ? (t('deals.sort.valueDesc') === 'deals.sort.valueDesc' ? 'Highest Value' : t('deals.sort.valueDesc'))
                                : (t('deals.sort.valueAsc') === 'deals.sort.valueAsc' ? 'Lowest Value' : t('deals.sort.valueAsc'))}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        onClick={() => setSortBy("newest")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "newest" ? "opacity-100" : "opacity-0")} />
                        {t('deals.sort.newest') === 'deals.sort.newest' ? 'Newest' : t('deals.sort.newest')}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        onClick={() => setSortBy("oldest")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "oldest" ? "opacity-100" : "opacity-0")} />
                        {t('deals.sort.oldest') === 'deals.sort.oldest' ? 'Oldest' : t('deals.sort.oldest')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setSortBy("value_desc")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "value_desc" ? "opacity-100" : "opacity-0")} />
                        {t('deals.sort.valueDesc') === 'deals.sort.valueDesc' ? 'Highest Value' : t('deals.sort.valueDesc')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setSortBy("value_asc")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "value_asc" ? "opacity-100" : "opacity-0")} />
                        {t('deals.sort.valueAsc') === 'deals.sort.valueAsc' ? 'Lowest Value' : t('deals.sort.valueAsc')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                <ViewSelector currentView={viewType} onViewChange={setViewType} />
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className={cn(
          "bg-muted/30 flex-1 min-h-0 min-w-0 overflow-y-auto",
          viewType === "kanban" ? "py-4 md:py-8" : "p-4 md:p-8 space-y-4 overflow-x-hidden"
        )}>
              {loading ? (
              viewType === "table" ? <DealsTableSkeleton /> : <DealsKanbanSkeleton />
            ) : filteredDeals.length === 0 && !searchQuery ? (
              <IsEmpty 
                icon={<Briefcase className="h-10 w-10 text-muted-foreground" />}
                title={t('deals.empty.title') || "No deals found"}
                description={t('deals.empty.desc') || "Get started by creating a new deal or wait for leads to be converted into deals."}
                variant="fancy" />
            ) : (
              <>
                {["all", "open", "won", "lost"].map(tabValue => (
                  <TabsContent key={tabValue} value={tabValue} className="m-0 h-full">
                    {viewType === "table" ? (
                      <DealsTable
                        deals={filteredDeals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        totalDeals={filteredDeals.length}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                        onDealClick={handleDealClick} />
                    ) : (
                      <DealsKanban 
                        deals={filteredDeals} 
                        onDealClick={handleDealClick} 
                        onUpdateDealStage={handleUpdateDealStage} />
                    )}
                  </TabsContent>
                ))}
              </>
            )}
        </div>
      </Tabs>
    </div>
  )
}

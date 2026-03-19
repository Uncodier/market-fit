"use client"

// app/deals/page.tsx needs to use Kanban view as default

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { getDeals } from "./actions"
import { Deal } from "./types"
import { DealsTable } from "./components/DealsTable"
import { DealsKanban } from "./components/DealsKanban"
import { updateDeal } from "./actions"
import { toast } from "sonner"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"
import { Search, Briefcase, ListOrdered, Check, ChevronDown } from "@/app/components/ui/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { useLocalization } from "@/app/context/LocalizationContext"
import { navigateToDeal } from "@/app/hooks/use-navigation-history"
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

function DealsKanbanSkeleton() {
  return (
    <div className="overflow-x-auto pb-4 -mx-8">
      <div className="flex gap-4 min-w-fit px-16 min-h-[calc(100vh-220px)] items-stretch">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-80 flex flex-col">
            <div className="bg-background rounded-t-md p-3 border-b border-x border-t">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-8" />
              </div>
              <Skeleton className="h-3 w-16 mt-2" />
            </div>
            <div className="bg-muted/30 rounded-b-md border-b border-x p-2 flex-1 min-h-[150px]">
              {Array.from({ length: i % 2 === 0 ? 3 : 2 }).map((_, j) => (
                <div key={j} className="bg-card border rounded-lg p-3 shadow-sm mb-2">
                  <div className="flex justify-between items-start mb-2">
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <div className="mb-3">
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DealsPage() {
  const { t } = useLocalization()
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [activeTab, setActiveTab] = useState("all")
  const [dbDeals, setDbDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewType, setViewType] = useMobileView("kanban")
  const { currentSite } = useSite()
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "value_desc" | "value_asc">("newest")

  const loadDeals = async (silent = false) => {
    if (!currentSite?.id) return

    if (!silent) setLoading(true)
    try {
      const result = await getDeals(currentSite.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setDbDeals(result.deals || [])
    } catch (error) {
      console.error("Error loading deals:", error)
      toast.error("Error loading deals")
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadDeals()
    
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
    // Optimistic update
    setDbDeals(prevDeals => 
      prevDeals.map(deal => 
        deal.id === dealId ? { ...deal, stage: newStage as Deal["stage"] } : deal
      )
    )

    try {
      const result = await updateDeal({ id: dealId, stage: newStage as Deal["stage"] })
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
    <div className="flex-1 min-w-0 w-full p-0 bg-muted/30 min-h-[calc(100vh-64px)]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <StickyHeader className="border-b min-h-[71px] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="w-full pt-0">
              <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-8">
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                  <TabsTrigger value="all" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('deals.tabs.all') || "All Deals"}>
                    <LayoutGrid size={13} className="md:!hidden" />
                    <span className="tab-label">{t('deals.tabs.all') || 'All Deals'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="open" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('deals.tabs.open') || "Open Deals"}>
                    <Target size={13} className="md:!hidden" />
                    <span className="tab-label">{t('deals.tabs.openTitle') || 'Open'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="won" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('deals.tabs.won') || "Won Deals"}>
                    <TrendingUp size={13} className="md:!hidden" />
                    <span className="tab-label">{t('deals.tabs.wonTitle') || 'Won'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="lost" className="text-xs rounded-full flex items-center justify-center gap-1.5" title={t('deals.tabs.lost') || "Lost Deals"}>
                    <XCircle size={13} className="md:!hidden" />
                    <span className="tab-label">{t('deals.tabs.lostTitle') || 'Lost'}</span>
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <SearchInput
                    placeholder={t('deals.search') || "Search deals..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                    alwaysExpanded={false}
                  />

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
                    <DropdownMenuContent align="start" className="w-40">
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
                </div>
              </div>
              <div className="ml-auto flex items-center gap-4">
                <ViewSelector currentView={viewType} onViewChange={setViewType} />
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8">
          <div className="max-w-full mx-auto w-full h-full">
            {loading ? (
              viewType === "table" ? <DealsTableSkeleton /> : <DealsKanbanSkeleton />
            ) : filteredDeals.length === 0 && !searchQuery ? (
              <IsEmpty 
                icon={<Briefcase className="h-10 w-10 text-muted-foreground" />}
                title={t('deals.empty.title') || "No deals found"}
                description={t('deals.empty.desc') || "Get started by creating a new deal or wait for leads to be converted into deals."}
                variant="fancy"
              />
            ) : (
              <>
                {["all", "open", "won", "lost"].map(tabValue => (
                  <TabsContent key={tabValue} value={tabValue} className="m-0">
                    {viewType === "table" ? (
                      <DealsTable
                        deals={filteredDeals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        totalDeals={filteredDeals.length}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                        onDealClick={handleDealClick}
                      />
                    ) : (
                      <DealsKanban 
                        deals={filteredDeals} 
                        onDealClick={handleDealClick} 
                        onUpdateDealStage={handleUpdateDealStage} 
                      />
                    )}
                  </TabsContent>
                ))}
              </>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  )
}

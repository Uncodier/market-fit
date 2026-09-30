"use client"

import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import {
PenTool,
Plus
} from "@/app/components/ui/icons"
import { FilterContainer,FilterSection,MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import { Pagination } from "@/app/components/ui/pagination"
import { SearchInput } from "@/app/components/ui/search-input"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs,TabsContent,TabsList,TabsTrigger } from "@/app/components/ui/tabs"
import { ViewSelector,ViewType } from "@/app/components/view-selector"
import { useSite } from "@/app/context/SiteContext"
import { useCommandK } from "@/app/hooks/use-command-k"
import { getSegments } from "@/app/segments/actions"
import { useRouter } from "next/navigation"
import { useCallback,useEffect,useState } from "react"
import { toast } from "sonner"
import { createCopywriting,getCopywriting,updateCopywritingStatus,type CopywritingItem } from "./actions"


import { useLocalization } from "@/app/context/LocalizationContext"
import { retryOnError,useOptimisticLoadState } from "@/app/hooks/use-optimistic-error"

import { COPYWRITING_TYPES,type CopywritingFilters,type CopywritingStatus } from "./copywriting-presentation"
import { CopywritingCard,CopywritingSkeleton } from "./CopywritingCards"
import { CreateCopywritingDialog } from "./CreateCopywritingDialog"

export default function CopywritingPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  const [copywritingItems, setCopywritingItems] = useState<CopywritingItem[]>([])
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([])
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title: string; description?: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewType, setViewType] = useState<ViewType>('kanban')
  const [selectedCopywriting, setSelectedCopywriting] = useState<CopywritingItem | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [filters, setFilters] = useState<CopywritingFilters>({
    status: [],
    type: [],
    segments: []
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredCopywriting, setFilteredCopywriting] = useState<CopywritingItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)

  // Initialize command+k hook
  useCommandK()

  useEffect(() => {
    if (currentSite?.id) {
      loadCopywriting()
      loadSegments()
      loadCampaigns()
    }
  }, [currentSite?.id])

  const loadCopywriting = async () => {
    if (!currentSite?.id) return
    
    try {
      setIsLoading(true)
      const items = await retryOnError(() => getCopywriting(currentSite.id))
      setCopywritingItems(items)
      setFilteredCopywriting(items)
      setError(null)
    } catch (error) {
      console.error('Error loading copywriting:', error)
      setError('Failed to load copywriting items')
    } finally {
      setIsLoading(false)
    }
  }

  const loadSegments = async () => {
    if (!currentSite?.id) return
    
    try {
      const segmentsData = await getSegments(currentSite.id)
      if (segmentsData.error) throw new Error(segmentsData.error)
      setSegments(segmentsData.segments || [])
    } catch (error) {
      console.error('Error loading segments:', error)
    }
  }

  const loadCampaigns = async () => {
    if (!currentSite?.id) return
    
    try {
      const campaignsData = await getCampaigns(currentSite.id)
      if (campaignsData.error) throw new Error(campaignsData.error)
      setCampaigns((campaignsData.data || []).map(({ id, title }) => ({ id, title })))
    } catch (error) {
      console.error('Error loading campaigns:', error)
    }
  }

  const handleCreateCopywriting = async (data: Partial<CopywritingItem>) => {
    if (!currentSite?.id) return

    try {
      const newItem = await createCopywriting(currentSite.id, data)
      setCopywritingItems(prev => [newItem, ...prev])
      updateFilteredCopywriting(searchTerm, filters, [newItem, ...copywritingItems])
      toast.success('Copy created successfully')
    } catch (error) {
      console.error('Error creating copywriting:', error)
      toast.error('Failed to create copy')
    }
  }

  const handleStatusChange = async (id: string, status: CopywritingStatus) => {
    try {
      await updateCopywritingStatus(id, status)
      const updatedItems = copywritingItems.map(item => 
        item.id === id ? { ...item, status } : item
      )
      setCopywritingItems(updatedItems)
      updateFilteredCopywriting(searchTerm, filters, updatedItems)
      toast.success('Status updated successfully')
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  const updateFilteredCopywriting = useCallback((search: string, filters: CopywritingFilters, items: CopywritingItem[]) => {
    let filtered = items

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.content?.toLowerCase().includes(searchLower)
      )
    }

    // Apply status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(item => filters.status.includes(item.status))
    }

    // Apply type filter
    if (filters.type.length > 0) {
      filtered = filtered.filter(item => filters.type.includes(item.type))
    }

    // Apply segments filter
    if (filters.segments.length > 0) {
      filtered = filtered.filter(item => 
        item.segment_id && filters.segments.includes(item.segment_id)
      )
    }

    setFilteredCopywriting(filtered)
    setCurrentPage(1) // Reset to first page when filtering
  }, [])

  useEffect(() => {
    updateFilteredCopywriting(searchTerm, filters, copywritingItems)
  }, [searchTerm, filters, copywritingItems, updateFilteredCopywriting])

  // Pagination
  const totalPages = Math.ceil(filteredCopywriting.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCopywriting = filteredCopywriting.slice(startIndex, endIndex)
  const { error: visibleError, isLoading: showLoading } = useOptimisticLoadState(isLoading, error)

  useEffect(() => {
    if (visibleError) toast.error(String(visibleError))
  }, [visibleError])

  if (visibleError) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <p className="text-red-500 mb-4">{String(visibleError)}</p>
          <Button 
            variant="outline" 
            onClick={loadCopywriting}
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="all">
        <StickyHeader>
          <div className="px-4 md:px-16 pt-0">
            <MobileFiltersDrawer triggerText={t('common.search') || "Search"}>
              <FilterContainer>
                <FilterSection mobileOnly>
                  <SearchInput placeholder="Search copy..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} alwaysExpanded={true} className="w-full h-10 md:h-9" containerClassName="w-full" />
                </FilterSection>

                

                <FilterSection title={t('common.status') || 'Status'}>
                  <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap md:flex-row w-full md:max-w-full overflow-y-visible md:overflow-x-auto justify-start items-center gap-2 md:gap-0">
                    <TabsTrigger value="all" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                      All Copy
                      <Badge variant="secondary" className="ml-2">
                        {copywritingItems.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="tweet" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                      Tweets
                      <Badge variant="secondary" className="ml-2">
                        {copywritingItems.filter(item => item.type === 'tweet').length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="cold_email" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                      Cold Emails
                      <Badge variant="secondary" className="ml-2">
                        {copywritingItems.filter(item => item.type === 'cold_email').length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="pitch" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                      Pitches
                      <Badge variant="secondary" className="ml-2">
                        {copywritingItems.filter(item => item.type === 'pitch').length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="ad_copy" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                      Ad Copy
                      <Badge variant="secondary" className="ml-2">
                        {copywritingItems.filter(item => item.type === 'ad_copy').length}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>
                </FilterSection>

                <FilterSection desktopOnly className="ml-auto">
                  <SearchInput placeholder="Search copy..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full" containerClassName="w-48 lg:w-64" />
                </FilterSection>
              </FilterContainer>
            </MobileFiltersDrawer>
            <div className="ml-auto flex items-center gap-4 shrink-0 mt-2 md:mt-0">
              <ViewSelector currentView={viewType} onViewChange={setViewType} />
              
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Copy
              </Button>
            </div>
          </div>
        </StickyHeader>

        <div className="flex-1 px-4 md:px-16 py-8">
          <TabsContent value="all" className="mt-0">
            {showLoading ? (
              <CopywritingSkeleton />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                  {paginatedCopywriting.map((item) => (
                    <CopywritingCard
                      key={item.id}
                      item={item}
                      onEdit={setSelectedCopywriting}
                      onStatusChange={handleStatusChange} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage} />
                  </div>
                )}

                {filteredCopywriting.length === 0 && !showLoading && (
                  <div className="text-center py-12">
                    <PenTool className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No copy found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchTerm || filters.status.length > 0 || filters.type.length > 0 || filters.segments.length > 0
                        ? "Try adjusting your search or filters"
                        : "Create your first piece of copy to get started"
                      }
                    </p>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Copy
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Individual type tabs */}
          {COPYWRITING_TYPES.slice(0, 4).map(type => (
            <TabsContent key={type.id} value={type.id} className="mt-0">
              {showLoading ? (
                <CopywritingSkeleton />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {copywritingItems
                    .filter(item => item.type === type.id)
                    .map((item) => (
                      <CopywritingCard
                        key={item.id}
                        item={item}
                        onEdit={setSelectedCopywriting}
                        onStatusChange={handleStatusChange} />
                    ))}
                </div>
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {/* Create Dialog */}
      <CreateCopywritingDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateCopywriting}
        segments={segments}
        campaigns={campaigns} />
    </div>
  )
}

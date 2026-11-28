"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
import { FileText, Megaphone, LayoutGrid, FileVideo, Globe } from "@/app/components/ui/icons"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer, FilterContainer, FilterSection, FilterSeparator } from "@/app/components/ui/mobile-filters-drawer"
import { ToolbarFilterButton } from "@/app/components/ui/toolbar-filter-button"
import { useSite } from "@/app/context/SiteContext"
import { useLayout } from "@/app/context/LayoutContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { getContent, updateContentStatus, type ContentItem } from "./actions"
import { filterAndSortContent } from "./content-list"
import { openContentItem } from "./open-content-item"
import { getSocialPerformanceSnapshots } from "@/app/components/dashboard/social-actions"
import { getContentAssetsByContentIds } from "@/app/assets/actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { toast } from "sonner"
import React from "react"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { useRouter, useSearchParams } from "next/navigation"
import { CreateContentDialog } from "./components"
import { useCommandK } from "@/app/hooks/use-command-k"
import { safeReload } from "@/app/utils/safe-reload"
import { useLocalization } from "@/app/context/LocalizationContext"
import { type ContentFilters } from "./content-shared"
import { ContentDetail } from "./components/ContentDetail"
import { ContentFiltersDialog } from "./components/ContentFiltersDialog"
import { ContentTypeViews } from "./components/ContentTypeViews"
import { ContentPublishDialog } from "./components/ContentPublishDialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/app/components/ui/sheet"
import type { TrendsSegments } from "@/app/components/trends/trends-presentation"
import { TrendsSection, TrendsColumn } from "@/app/components/trends"
import { cn } from "@/lib/utils"

const PUBLISH_PLATFORMS = new Set(['facebook', 'linkedin', 'tiktok', 'twitter', 'x', 'instagram', 'youtube', 'threads', 'pinterest', 'bluesky'])

export default function ContentPage() {
  const { t } = useLocalization()
  const { currentSite, isLoading: isSiteLoading } = useSite()
  const { sidebarWidth } = useLayout()
  const isMobile = useIsMobile()
  const router = useRouter()
  const { data: segmentsData = [] } = useSWR(
    currentSite?.id ? ['segments', currentSite.id] : null,
    async ([, siteId]) => {
      const { segments, error } = await getSegments(siteId);
      if (error) throw new Error(error);
      return segments ? segments.map(s => ({ id: s.id, name: s.name, description: s.description })) : [];
    },
    {}
  );
  const segments = segmentsData;

  const { data: campaignsData = [], isLoading: isLoadingCampaigns } = useSWR(
    currentSite?.id ? ['campaigns', currentSite.id] : null,
    async ([, siteId]) => {
      const response = await getCampaigns(siteId);
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    {}
  );
  const campaigns = campaignsData;

  const { data: contentData, isLoading: isContentLoading, mutate: mutateContent } = useSWR(
    currentSite?.id ? ['content', currentSite.id] : null,
    async ([, siteId]) => {
      const result = await getContent(siteId);
      if (result.error) throw new Error(result.error);
      
      const content = result.content || [];
      const ids = content.map((c: ContentItem) => c.id);
      const { byContentId } = await getContentAssetsByContentIds(ids);
      
      return {
        content,
        count: result.count || 0,
        assetsByContentId: byContentId || {}
      };
    },
    {}
  );

  const { data: performanceData } = useSWR(
    currentSite?.id ? ['content_performance', currentSite.id] : null,
    async ([, siteId]) => {
      const res = await getSocialPerformanceSnapshots(siteId);
      if (res.error) {
        console.error("Failed to load content performance:", res.error);
        return { byContentId: {}, byPostId: {} };
      }
      return { byContentId: res.byContentId, byPostId: res.byPostId };
    },
    {}
  );

  const assetsByContentId = contentData?.assetsByContentId || {};
  const isLoading = isSiteLoading || !currentSite?.id || isContentLoading;

  const socialMedia = React.useMemo(() => (currentSite?.settings?.social_media ?? []).filter(
    account => account.isActive && PUBLISH_PLATFORMS.has(account.platform?.toLowerCase()),
  ), [currentSite?.settings?.social_media])
  const [error] = useState<string | null>(null)
  const [viewType, setViewType] = useState<ViewType>('kanban')
  const [selectedContent] = useState<ContentItem | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [filters, setFilters] = useState<ContentFilters>({
    status: [],
    type: [],
    segments: []
  })
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const searchParams = useSearchParams()
  const urlSort = searchParams ? searchParams.get('sort') : null
  const defaultSort = urlSort === 'updated_at' ? 'newest' : (urlSort === 'created_at' || urlSort === 'newest' ? 'newest' : (urlSort === 'oldest' ? 'oldest' : (urlSort === 'rate_desc' ? 'rate_desc' : (urlSort === 'rate_asc' ? 'rate_asc' : 'newest'))))

  // Sort state
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "rate_desc" | "rate_asc">(defaultSort)

  // Initialize command+k hook
  useCommandK()
  
  const refreshContentList = mutateContent;

  const filteredContent = React.useMemo(
    () => filterAndSortContent(contentData?.content || [], searchTerm, filters, sortBy),
    [contentData?.content, sortBy, searchTerm, filters]
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value
    setSearchTerm(newSearchTerm)
  }

  const handleFiltersChange = (newFilters: ContentFilters) => {
    setFilters(newFilters)
  }

  const handleUpdateContentStatus = async (contentId: string, newStatus: string) => {
    // Optimistic update
    mutateContent((data) => {
      if (!data) return data;
      return {
        ...data,
        content: data.content.map((item: ContentItem) => 
          item.id === contentId 
            ? { 
                ...item, 
                status: newStatus,
                updated_at: new Date().toISOString(),
                ...(newStatus === 'published' ? { published_at: new Date().toISOString() } : {})
              } 
            : item
        )
      };
    }, { revalidate: false });

    try {
      const result = await updateContentStatus({
        contentId,
        status: newStatus as Parameters<typeof updateContentStatus>[0]["status"]
      })

      if (result.error) {
        toast.error(result.error)
        mutateContent() // Revert
        return
      }

      toast.success(`Content status updated to ${newStatus}`)
    } catch (error) {
      console.error("Error updating content status:", error)
      toast.error(t('content.toast.statusFailed'))
      mutateContent() // Revert
      throw error // Re-throw to trigger the revert in kanban
    }
  }

  const handleContentClick = async (content: ContentItem, order: ContentItem[] = []) => {
    if (!currentSite?.id) return
    await openContentItem(content, currentSite.id, router, order)
  }

  const [publishingContent, setPublishingContent] = useState<ContentItem | null>(null)
  const handlePublishClick = (content: ContentItem) => setPublishingContent(content)


  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value))
    setCurrentPage(1)
  }

  // Handle content rating changes
  const handleContentRatingChange = (contentId: string, rating: number) => {
      mutateContent((data) => {
        if (!data) return data;
        return {
          ...data,
          content: data.content.map((item: ContentItem) => 
            item.id === contentId 
              ? { 
                  ...item, 
                  performance_rating: rating
                } 
              : item
          )
        };
      }, false);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <p className="text-red-500 mb-4">{error}</p>
          <Button 
            variant="outline" 
            onClick={() => safeReload(false, 'Error recovery')}
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }
  const sidebarLeft = `${isMobile ? 0 : sidebarWidth}px`

  return (
    <div 
      className="h-full flex flex-col min-w-0 transition-all duration-300 ease-in-out relative"
      style={{
        marginLeft: `-${sidebarLeft}`,
        width: `calc(100% + ${sidebarLeft})`
      }}
    >
      <div className="h-full flex flex-col min-w-0 w-full justify-start flex-1">
        <Tabs defaultValue="all" className="flex-1 flex flex-col justify-start w-full h-full">
          <StickyHeader>
            <div 
              className="w-full pt-0 transition-all duration-300 ease-in-out"
              style={{
                paddingLeft: sidebarLeft
              }}
            >
              <div className="flex items-center justify-between w-full">
              <MobileFiltersDrawer triggerText={t('common.search') || "Search"}
                controls={<>
                  <SortDropdown sortBy={sortBy} setSortBy={setSortBy}
                    title={t('content.sortBy') === 'content.sortBy' ? 'Sort by' : t('content.sortBy')}
                    options={[
                      { value: "newest", label: t('content.sort.newest') === 'content.sort.newest' ? 'Newest' : t('content.sort.newest') },
                      { value: "oldest", label: t('content.sort.oldest') === 'content.sort.oldest' ? 'Oldest' : t('content.sort.oldest') },
                      { value: "rate_desc", label: t('content.sort.rateDesc') === 'content.sort.rateDesc' ? 'Highest Rated' : t('content.sort.rateDesc') },
                      { value: "rate_asc", label: t('content.sort.rateAsc') === 'content.sort.rateAsc' ? 'Lowest Rated' : t('content.sort.rateAsc') },
                    ]}
                  />
                  <ViewSelector
                    currentView={viewType}
                    onViewChange={(view) => setViewType(view)} />
                </>}
              >
                <FilterContainer>
                  <FilterSection zone="search" mobileOnly>
                    <SearchInput  placeholder="Search content..." value={searchTerm} onChange={handleSearchChange} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                  </FilterSection>

                  {searchTerm && <FilterSeparator className="max-md:hidden" />}

                  <FilterSection zone="tabs" title={t('common.status') || 'Status'} className={searchTerm ? "max-md:hidden" : ""}>
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap md:flex-row w-full md:max-w-full overflow-y-visible md:overflow-x-auto justify-start items-center gap-2 md:gap-0">
                      <TabsTrigger value="all" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('content.tabs.all')}>
                        <LayoutGrid size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('content.tabs.all')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="blog_post" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('content.tabs.blog')}>
                        <FileText size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('content.tabs.blog')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="video" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('content.tabs.video')}>
                        <FileVideo size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('content.tabs.video')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="social_post" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('content.tabs.social')}>
                        <Globe size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('content.tabs.social')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="ad" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('content.tabs.ads')}>
                        <Megaphone size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t('content.tabs.ads')}</span>
                      </TabsTrigger>
                    </TabsList>
                  </FilterSection>
                  <FilterSection zone="search" desktopOnly>
                    <SearchInput  placeholder="Search content..." value={searchTerm} onChange={handleSearchChange}    className="w-full bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"  containerClassName="w-64" />
                  </FilterSection>
                    
                    <FilterSection className={searchTerm ? "max-md:hidden" : ""}>
                    <ToolbarFilterButton label={t("common.filters") || "Filters"} onClick={() => setIsFiltersDialogOpen(true)}
                      count={filters.status.length + filters.type.length + filters.segments.length} />

                  </FilterSection>
                </FilterContainer>
              </MobileFiltersDrawer>

            </div>
          </div>
        </StickyHeader>
        
        <div 
          className={cn(
            "space-y-6 bg-muted/30 flex-1 flex flex-col justify-start w-full min-w-0 h-full transition-all duration-300 ease-in-out overflow-y-auto",
            viewType === 'kanban' ? "py-8" : "p-8 overflow-x-hidden"
          )}
          style={{
            paddingLeft: `calc(${sidebarLeft} + ${isMobile ? '1rem' : '2rem'})`
          }}
        >
          {/* Trends Section - Only for Table View */}
          {viewType === 'table' && (
            <div className="px-8">
              <TrendsSection segments={segments as TrendsSegments} currentSiteId={currentSite?.id} displayMode="table" />
            </div>
          )}
          
          {/* Main Content Layout */}
          <div className={viewType === 'kanban' ? "flex-1 flex flex-col justify-start h-full" : "px-8"}>
            <div className={viewType === 'kanban' ? "flex items-start gap-4 pt-0 mt-0 flex-1 flex-row h-full" : "px-8"}>
              {/* Left Sidebar - Trends Column (Only for Kanban View) */}
              {viewType === 'kanban' && (
                <div className="flex-shrink-0 pt-0 mt-0 flex flex-col justify-start self-stretch min-h-0">
                  <TrendsColumn
                    className="self-stretch"
                    segments={segments as TrendsSegments}
                    currentSiteId={currentSite?.id} />
                </div>
              )}
              
              {/* Main Content Area */}
              <div className={viewType === 'kanban' ? "flex-1 pt-0 mt-0 flex flex-col justify-start" : ""}>
                <ContentTypeViews
                  viewType={viewType}
                  isLoading={isLoading}
                  filteredContent={filteredContent}
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  segments={segments as TrendsSegments}
                  campaigns={campaigns}
                  isLoadingCampaigns={isLoadingCampaigns}
                  assetsByContentId={assetsByContentId}
                  outstandPosts={[]}
                  performanceData={performanceData}
                  onUpdateContentStatus={handleUpdateContentStatus}
                  onContentClick={handleContentClick}
                  onRatingChange={handleContentRatingChange}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  onPublish={handlePublishClick} />
            </div>
            
            {/* Right padding spacer for scroll */}
            {viewType === 'kanban' && <div className="w-16 flex-shrink-0" />}
          </div>
        </div>
        </div>
      </Tabs>
      
      {/* Content Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('content.sheet.details')}</SheetTitle>
          </SheetHeader>
          {selectedContent && (
            <ContentDetail 
              content={selectedContent} 
              onClose={() => {
                setIsDetailOpen(false);
                refreshContentList();
              }}
              segments={segments}
              onRatingChange={handleContentRatingChange}
              onPublish={handlePublishClick} />
          )}
        </SheetContent>
      </Sheet>
      
      <ContentPublishDialog
        content={publishingContent}
        socialMedia={socialMedia}
        siteId={currentSite?.id}
        onClose={() => setPublishingContent(null)}
        onPublished={() => mutateContent()}
        onUpdateStatus={handleUpdateContentStatus} />


      {/* Filters Dialog */}
      <ContentFiltersDialog 
        isOpen={isFiltersDialogOpen}
        onOpenChange={setIsFiltersDialogOpen}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        segments={segments} />
      
      <CreateContentDialog 
        segments={segments as TrendsSegments}
        campaigns={campaigns}
        onSuccess={refreshContentList} />
    </div>
    </div>
  )
} 
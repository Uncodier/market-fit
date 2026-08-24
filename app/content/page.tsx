"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
import { Badge } from "@/app/components/ui/badge"
import { Filter, FileText, Megaphone, ListOrdered, LayoutGrid, FileVideo, Globe, ChevronDown, Check } from "@/app/components/ui/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import { useSite } from "@/app/context/SiteContext"
import { useLayout } from "@/app/context/LayoutContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { getContent, updateContentStatus, type ContentItem } from "./actions"
import { combineOutstandContent, filterAndSortContent } from "./content-list"
import { openContentItem } from "./open-content-item"
import { fetchOutstandPosts } from "./outstand"
import { getContentAssetsByContentIds } from "@/app/assets/actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { toast } from "sonner"
import React from "react"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { useRouter } from "next/navigation"
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
import { EmptyCard } from "@/app/components/ui/empty-card"
import { TrendsSection, TrendsColumn } from "@/app/components/trends"
import { cn } from "@/lib/utils"

export default function ContentPage() {
  const { t } = useLocalization()
  const { currentSite, getSettings } = useSite()
  const { isLayoutCollapsed } = useLayout()
  const isMobile = useIsMobile()
  const router = useRouter()
  const { data: segmentsData = [], isLoading: isLoadingSegments } = useSWR(
    currentSite?.id ? ['segments', currentSite.id] : null,
    async ([_, siteId]) => {
      const { segments, error } = await getSegments(siteId);
      if (error) throw new Error(error);
      return segments ? segments.map(s => ({ id: s.id, name: s.name, description: s.description })) : [];
    },
    {}
  );
  const segments = segmentsData;

  const { data: campaignsData = [], isLoading: isLoadingCampaigns } = useSWR(
    currentSite?.id ? ['campaigns', currentSite.id] : null,
    async ([_, siteId]) => {
      const response = await getCampaigns(siteId);
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    {}
  );
  const campaigns = campaignsData;

  const { data: outstandPostsData, isLoading: isLoadingOutstand, mutate: mutateOutstand } = useSWR(
    currentSite?.id ? ['outstand', currentSite.id] : null,
    async ([_, siteId]) => {
      const result = await fetchOutstandPosts(siteId);
      if (result?.error) throw new Error(result.error);
      return { posts: result?.data || [] };
    },
    {}
  );
  const outstandPosts = outstandPostsData?.posts || [];

  const { data: contentData, isLoading: isContentLoading, mutate: mutateContent, isValidating: isContentValidating } = useSWR(
    currentSite?.id ? ['content', currentSite.id] : null,
    async ([_, siteId]) => {
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

  const contentItems = contentData?.content || [];
  const totalContent = contentData?.count || 0;
  const assetsByContentId = contentData?.assetsByContentId || {};
  const isLoading = isContentLoading;

  const [socialMedia, setSocialMedia] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [viewType, setViewType] = useState<ViewType>('kanban')
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)
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

  const combinedContentItems = React.useMemo(
    () => combineOutstandContent(contentItems, outstandPosts, currentSite?.id),
    [contentItems, outstandPosts, currentSite?.id]
  )

  // Sort state
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "rate_desc" | "rate_asc">("newest")

  // Initialize command+k hook
  useCommandK()
  
  useEffect(() => {
    if (currentSite?.id) {
      // Load social media settings for publishing
      const loadSettings = async () => {
        try {
          const settings = await getSettings(currentSite.id)
          if (settings?.social_media) {
            setSocialMedia(settings.social_media.filter((s: any) => s.isActive && (s.platform === 'facebook' || s.platform === 'linkedin' || s.platform === 'tiktok' || s.platform === 'twitter' || s.platform === 'x' || s.platform === 'instagram')))
          }
        } catch (e) {
          console.error('Failed to load social media settings', e)
        }
      }
      loadSettings()
    }
  }, [currentSite?.id])

  const refreshContentList = mutateContent;

  const filteredContent = React.useMemo(
    () => filterAndSortContent(combinedContentItems, searchTerm, filters, sortBy),
    [combinedContentItems, sortBy, searchTerm, filters]
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
    mutateContent((data: any) => {
      if (!data) return data;
      return {
        ...data,
        content: data.content.map((item: ContentItem) => 
          item.id === contentId 
            ? { 
                ...item, 
                status: newStatus as any,
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
        status: newStatus as any
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

  const handleContentClick = async (content: ContentItem) => {
    if (!currentSite?.id) return
    await openContentItem(content, currentSite.id, router)
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
      mutateContent((data: any) => {
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



  const sidebarLeft = isMobile ? '0px' : (isLayoutCollapsed ? '64px' : '256px')

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
              <MobileFiltersDrawer triggerText={t('common.search') || "Buscar"}>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 min-w-0">
                  <div className="md:hidden w-full">
                    <SearchInput  placeholder="Search content..." value={searchTerm} onChange={handleSearchChange} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                  </div>
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    <span className="text-xs font-semibold text-muted-foreground md:hidden mb-1 uppercase">{t('common.filters') || 'Filtros'}</span>
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                      <TabsTrigger value="all" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap" title={t('content.tabs.all')}>
                        <LayoutGrid size={13} className="md:!hidden" />
                        <span className="tab-label">{t('content.tabs.all')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="blog_post" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap" title={t('content.tabs.blog')}>
                        <FileText size={13} className="md:!hidden" />
                        <span className="tab-label">{t('content.tabs.blog')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="video" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap" title={t('content.tabs.video')}>
                        <FileVideo size={13} className="md:!hidden" />
                        <span className="tab-label">{t('content.tabs.video')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="social_post" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap" title={t('content.tabs.social')}>
                        <Globe size={13} className="md:!hidden" />
                        <span className="tab-label">{t('content.tabs.social')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="ad" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap" title={t('content.tabs.ads')}>
                        <Megaphone size={13} className="md:!hidden" />
                        <span className="tab-label">{t('content.tabs.ads')}</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <div className="hidden md:flex items-center gap-2 w-full md:w-auto">
                    <SearchInput  placeholder="Search content..." value={searchTerm} onChange={handleSearchChange}    className="w-full bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"  containerClassName="w-64" />
                  </div>
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                    <Button 
                      variant="secondary" 
                      size={(filters.status.length > 0 || filters.type.length > 0 || filters.segments.length > 0) ? "default" : "sm"}
                      className={cn(
                        "w-full md:w-auto h-10 md:h-9 rounded-md md:rounded-full justify-center",
                        (filters.status.length > 0 || filters.type.length > 0 || filters.segments.length > 0) ? "px-4" : "md:w-9 md:px-0 px-4"
                      )}
                      onClick={() => setIsFiltersDialogOpen(true)}
                    >
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        <span className="md:hidden">Filters</span>
                      </div>
                      {(filters.status.length > 0 || filters.type.length > 0 || filters.segments.length > 0) && (
                        <Badge variant="secondary" className="ml-2">
                          {filters.status.length + filters.type.length + filters.segments.length}
                        </Badge>
                      )}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" className="w-full md:w-auto h-10 md:h-9 gap-2 rounded-md md:rounded-full px-4 justify-between md:justify-center" title={t('content.sortBy') === 'content.sortBy' ? 'Sort by' : t('content.sortBy')}>
                          <div className="flex items-center gap-2">
                            <ListOrdered className="h-4 w-4" />
                            <span className="font-normal">
                              {sortBy === "newest"
                                ? (t('content.sort.newest') === 'content.sort.newest' ? 'Newest' : t('content.sort.newest'))
                                : sortBy === "oldest"
                                  ? (t('content.sort.oldest') === 'content.sort.oldest' ? 'Oldest' : t('content.sort.oldest'))
                                  : sortBy === "rate_desc"
                                    ? (t('content.sort.rateDesc') === 'content.sort.rateDesc' ? 'Highest Rated' : t('content.sort.rateDesc'))
                                    : (t('content.sort.rateAsc') === 'content.sort.rateAsc' ? 'Lowest Rated' : t('content.sort.rateAsc'))}
                            </span>
                          </div>
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-40">
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          onClick={() => setSortBy("newest")}
                        >
                          <Check className={cn("mr-2 h-4 w-4", sortBy === "newest" ? "opacity-100" : "opacity-0")} />
                          {t('content.sort.newest') === 'content.sort.newest' ? 'Newest' : t('content.sort.newest')}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          onClick={() => setSortBy("oldest")}
                        >
                          <Check className={cn("mr-2 h-4 w-4", sortBy === "oldest" ? "opacity-100" : "opacity-0")} />
                          {t('content.sort.oldest') === 'content.sort.oldest' ? 'Oldest' : t('content.sort.oldest')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => setSortBy("rate_desc")}
                        >
                          <Check className={cn("mr-2 h-4 w-4", sortBy === "rate_desc" ? "opacity-100" : "opacity-0")} />
                          {t('content.sort.rateDesc') === 'content.sort.rateDesc' ? 'Highest Rated' : t('content.sort.rateDesc')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => setSortBy("rate_asc")}
                        >
                          <Check className={cn("mr-2 h-4 w-4", sortBy === "rate_asc" ? "opacity-100" : "opacity-0")} />
                          {t('content.sort.rateAsc') === 'content.sort.rateAsc' ? 'Lowest Rated' : t('content.sort.rateAsc')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </MobileFiltersDrawer>
              <div className="ml-auto shrink-0 mt-2 md:mt-0">
                <ViewSelector 
                  currentView={viewType} 
                  onViewChange={(view) => setViewType(view)} />
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div 
          className="p-8 space-y-6 bg-muted/30 flex-1 flex flex-col justify-start w-full h-full transition-all duration-300 ease-in-out"
          style={{
            paddingLeft: `calc(${sidebarLeft} + 2rem)`
          }}
        >
          {/* Trends Section - Only for Table View */}
          {viewType === 'table' && (
            <div className="px-8">
              <TrendsSection segments={segments as any} currentSiteId={currentSite?.id} displayMode="table" />
            </div>
          )}
          
          {/* Main Content Layout */}
          <div className={viewType === 'kanban' ? "overflow-x-auto pb-4 -mx-8 flex-1 flex flex-col justify-start" : "px-8"}>
            <div className={viewType === 'kanban' ? "flex items-start gap-4 min-w-fit px-8 pt-0 mt-0 flex-1 flex-row" : "px-8"}>
              {/* Left Sidebar - Trends Column (Only for Kanban View) */}
              {viewType === 'kanban' && (
                <div className="flex-shrink-0 pt-0 mt-0 flex flex-col justify-start self-stretch min-h-0">
                  <TrendsColumn
                    className="self-stretch"
                    segments={segments as any}
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
                  segments={segments as any}
                  campaigns={campaigns}
                  isLoadingCampaigns={isLoadingCampaigns}
                  assetsByContentId={assetsByContentId}
                  outstandPosts={outstandPosts}
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
        onPublished={() => mutateOutstand()}
        onUpdateStatus={handleUpdateContentStatus} />


      {/* Filters Dialog */}
      <ContentFiltersDialog 
        isOpen={isFiltersDialogOpen}
        onOpenChange={setIsFiltersDialogOpen}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        segments={segments} />
      
      <CreateContentDialog 
        segments={segments as any}
        campaigns={campaigns}
        onSuccess={refreshContentList} />
    </div>
    </div>
  )
} 
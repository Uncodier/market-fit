"use client"

import { useState } from "react"
import useSWR from "swr"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Target, Filter, LayoutGrid, PlayCircle, Clock, CheckCircle2 } from "@/app/components/ui/icons"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer, FilterContainer, FilterSection, FilterSeparator } from "@/app/components/ui/mobile-filters-drawer"
import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { SearchInput } from "@/app/components/ui/search-input"
import { ViewSelector } from "@/app/components/view-selector"
import { useCommandK } from "@/app/hooks/use-command-k"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { useSite } from "@/app/context/SiteContext"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import type { Campaign } from "@/app/types"
import { createClient } from "@/lib/supabase/client"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { useRouter, useSearchParams } from "next/navigation"
import { navigateToCampaign } from "@/lib/navigation/navigation-helpers"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { CampaignsTable, CampaignsTableSkeleton } from "./components/CampaignsTable"
import { CampaignsKanban, CampaignsKanbanSkeleton } from "./components/CampaignsKanban"

function asCampaignList(value: unknown): Campaign[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: Campaign[] }).data
  }
  return []
}

export default function CampaignsPage() {
  const { t } = useLocalization()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlSort = searchParams ? searchParams.get('sort') : null
  const defaultSort = urlSort === 'updated_at' ? 'newest' : (urlSort === 'created_at' || urlSort === 'newest' ? 'newest' : (urlSort === 'oldest' ? 'oldest' : (urlSort === 'budget' ? 'budget' : (urlSort === 'roi' ? 'roi' : 'due_date'))))
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>(["high", "medium", "low"])
  const [sortBy, setSortBy] = useState<"due_date" | "oldest" | "newest" | "budget" | "roi">(defaultSort as any)
  const [activeTab, setActiveTab] = useState("all")
  const [viewType, setViewType] = useMobileView("table")
  const { currentSite } = useSite()

  useCommandK()

  const { data: campaignsData = [], error: campaignsError, isLoading, mutate: reloadCampaigns } = useSWR(
    currentSite?.id ? ["campaigns", currentSite.id] : null,
    async ([_, siteId]) => {
      const response = await getCampaigns(siteId)
      if (response.error) throw new Error(response.error)
      return response.data || []
    }
  )

  const { data: requirements = [] } = useSWR(
    currentSite?.id && viewType === 'kanban' ? ["campaign-board-requirements", currentSite.id] : null,
    async ([_, siteId]) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("requirements")
        .select("id, title, description, status, priority, completion_status, campaign_requirements(campaign_id)")
        .eq("site_id", siteId)

      if (error) throw error
      return data || []
    }
  )

  const campaigns = asCampaignList(campaignsData)

  const getCampaignRoi = (campaign: Campaign) => {
    const budgetAllocated = campaign.budget?.allocated ?? 0
    if (budgetAllocated <= 0) return -Infinity
    const revenueActual = campaign.revenue?.actual ?? 0
    return ((revenueActual - budgetAllocated) / budgetAllocated) * 100
  }

  const compareCampaigns = (campaignA: Campaign, campaignB: Campaign) => {
    const dateA = new Date(campaignA.createdAt).getTime()
    const dateB = new Date(campaignB.createdAt).getTime()

    if (sortBy === "oldest") return dateA - dateB
    if (sortBy === "newest") return dateB - dateA
    if (sortBy === "due_date") {
      return new Date(campaignA.dueDate).getTime() - new Date(campaignB.dueDate).getTime()
    }
    if (sortBy === "budget") {
      return (campaignB.budget?.allocated ?? 0) - (campaignA.budget?.allocated ?? 0)
    }
    if (sortBy === "roi") return getCampaignRoi(campaignB) - getCampaignRoi(campaignA)
    return 0
  }

  const matchesFilters = (campaign: Campaign) => {
    const campaignStatus = campaign.status || "active"
    if (activeTab !== "all" && campaignStatus !== activeTab) return false
    if (!selectedPriorities.includes(campaign.priority)) return false
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      campaign.title?.toLowerCase().includes(query) ||
      campaign.description?.toLowerCase().includes(query)
    )
  }

  const filteredCampaigns = campaigns.filter(matchesFilters).sort(compareCampaigns)

  const campaignsByType: Record<string, Campaign[]> = {}
  filteredCampaigns.forEach((campaign) => {
    if (!campaignsByType[campaign.type]) campaignsByType[campaign.type] = []
    campaignsByType[campaign.type].push(campaign)
  })

  const handleCampaignClick = (campaign: Campaign) => {
    navigateToCampaign({
      campaignId: campaign.id,
      campaignName: campaign.title,
      router,
      origin: { siteId: currentSite?.id, rows: filteredCampaigns },
    })
  }

  const emptyTitle =
    activeTab === "active"
      ? t("campaigns.empty.active.title") || "No Active Campaigns"
      : activeTab === "pending"
        ? t("campaigns.empty.pending.title") || "No Pending Campaigns"
        : activeTab === "completed"
          ? t("campaigns.empty.completed.title") || "No Completed Campaigns"
          : t("campaigns.empty.title") || "No Campaigns"

  const emptyDescription =
    activeTab === "active"
      ? t("campaigns.empty.active.desc") || "You don't have any active campaigns yet."
      : activeTab === "pending"
        ? t("campaigns.empty.pending.desc") || "You don't have any pending campaigns at the moment."
        : activeTab === "completed"
          ? t("campaigns.empty.completed.desc") || "You don't have any completed campaigns yet."
          : t("campaigns.empty.desc") || "You don't have any campaigns yet. Create your first campaign to get started."

  return (
    <div className="flex-1 min-w-0 w-full p-0 h-auto overflow-visible bg-muted/30 min-h-[calc(100vh-var(--topbar-height,64px))]">
      <StickyHeader>
        <div className="flex items-center justify-between w-full">
          <MobileFiltersDrawer triggerText={t('common.search') || "Search"}
              controls={<>
              <SortDropdown sortBy={sortBy} setSortBy={setSortBy} options={[
                { value: "due_date", label: "Due date" },
                { value: "oldest", label: "Oldest" },
                { value: "newest", label: "Newest" },
                { value: "budget", label: "Budget" },
                { value: "roi", label: "ROI" }
              ]} />
              <ViewSelector currentView={viewType} onViewChange={setViewType} />
            </>}
            >
              <FilterContainer>
                <FilterSection zone="search" mobileOnly>
                  <SearchInput data-command-k-input placeholder={t("campaigns.search.placeholder") || "Search campaigns..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} alwaysExpanded={true} className="w-full h-10 md:h-9" containerClassName="w-full" />
                </FilterSection>

                

                <FilterSection zone="tabs" title={t('common.status') || 'Estado'}>
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "all" | "active" | "pending" | "completed")}>
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap md:flex-row w-full md:max-w-full overflow-y-visible md:overflow-x-auto justify-start items-center gap-2 md:gap-0">
                      <TabsTrigger value="all" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t("campaigns.tabs.all") || "All Campaigns"}>
                        <LayoutGrid size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t("campaigns.tabs.all") || "All"}</span>
                      </TabsTrigger>
                      <TabsTrigger value="active" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t("campaigns.tabs.active") || "Active"}>
                        <PlayCircle size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t("campaigns.tabs.active") || "Active"}</span>
                      </TabsTrigger>
                      <TabsTrigger value="pending" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t("campaigns.tabs.pending") || "Pending"}>
                        <Clock size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t("campaigns.tabs.pending") || "Pending"}</span>
                      </TabsTrigger>
                      <TabsTrigger value="draft" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t("campaigns.tabs.draft") || "Drafts"}>
                        <LayoutGrid size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t("campaigns.tabs.draft") || "Drafts"}</span>
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t("campaigns.tabs.completed") || "Completed"}>
                        <CheckCircle2 size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t("campaigns.tabs.completed") || "Completed"}</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FilterSection>
                    
                    <FilterSection className="flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <ToolbarIconButton variant="secondary" label={t("common.filters") || "Filters"} className="md:h-9 md:w-9">
                        <Filter className="h-4 w-4" aria-hidden />
                      </ToolbarIconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px]">
                      <DropdownMenuCheckboxItem
                        checked={selectedPriorities.length === 3}
                        onCheckedChange={(checked) => setSelectedPriorities(checked ? ["high", "medium", "low"] : [])}
                        className={selectedPriorities.length === 3 ? "bg-primary/10 font-medium" : ""}
                      >
                        {t("campaigns.filter.all") || "All Priorities"}
                      </DropdownMenuCheckboxItem>
                      {(["high", "medium", "low"] as const).map((priority) => (
                        <DropdownMenuCheckboxItem
                          key={priority}
                          checked={selectedPriorities.includes(priority)}
                          onCheckedChange={(checked) => {
                            setSelectedPriorities(
                              checked
                                ? [...selectedPriorities, priority]
                                : selectedPriorities.filter((value) => value !== priority)
                            )
                          }}
                          className={selectedPriorities.includes(priority) && selectedPriorities.length === 1 ? "bg-primary/10 font-medium" : ""}
                        >
                          {t(`campaigns.filter.${priority}`) || `${priority} Priority`}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <CalendarDateRangePicker iconOnly />
                </FilterSection>

                <FilterSection zone="search" desktopOnly>
                  <SearchInput data-command-k-input placeholder={t("campaigns.search.placeholder") || "Search campaigns..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full" containerClassName="w-full w-64" />
                </FilterSection>
              </FilterContainer>
            </MobileFiltersDrawer>


        </div>
      </StickyHeader>

      {isLoading ? (
        viewType === "table" ? (
          <div className="p-8 bg-muted/30 flex-1">
            <CampaignsTableSkeleton />
          </div>
        ) : (
          <CampaignsKanbanSkeleton />
        )
      ) : campaignsError ? (
        <div role="alert" className="space-y-3 p-6 text-sm"><p>{t('campaigns.error.fetch')}</p>
          <Button variant="outline" size="sm" onClick={() => void reloadCampaigns()}>{t('common.retry')}</Button>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <EmptyState
          icon={<Target className="h-12 w-12 text-muted-foreground" />}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Button onClick={() => window.dispatchEvent(new Event('campaigns:create'))}>
              {t("campaigns.empty.action") || "New Campaign"}
            </Button>
          }
          features={[
            {
              title: t("campaigns.empty.feature.title") || "Campaign Management",
              items: [
                t("campaigns.empty.feature.item1") || "Organize marketing initiatives",
                t("campaigns.empty.feature.item2") || "Track performance and ROI",
                t("campaigns.empty.feature.item3") || "Manage subtasks and deadlines",
              ],
            },
          ]} />
      ) : (
        <div className={cn(
          "bg-muted/30 flex-1 min-w-0 overflow-y-auto",
          viewType === "kanban" ? "py-4 md:py-8" : "p-4 md:p-8 space-y-4 overflow-x-hidden"
        )}>
          {viewType === "table" ? (
            <CampaignsTable campaigns={filteredCampaigns} onCampaignClick={handleCampaignClick} />
          ) : (
            <CampaignsKanban
              campaignsByType={campaignsByType}
              requirements={requirements}
              siteId={currentSite?.id}
              searchQuery={searchQuery} />
          )}
        </div>
      )}
    </div>
  )
}

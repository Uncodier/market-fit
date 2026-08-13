"use client"

import React, { useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import {
  Filter,
  ChevronDown,
  XCircle,
  Clock,
  LayoutGrid,
  ListOrdered,
  CheckCircle2,
  Ban,
} from "@/app/components/ui/icons"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"
import { FilterModal } from "@/app/components/ui/filter-modal"
import { ViewSelector } from "@/app/components/view-selector"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { navigateToRequirement } from "@/app/hooks/use-navigation-history"
import { safeReload } from "@/app/utils/safe-reload"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { KanbanView } from "./kanban-view"
import { RequirementsTable, RequirementsTableSkeleton } from "./RequirementsTable"
import { useRequirementsList } from "./use-requirements-list"
import { COMPLETION_STATUS, REQUIREMENT_STATUS, type Requirement } from "./types"

export default function RequirementsPage() {
  const { t } = useLocalization()
  const router = useRouter()
  const [viewMode, setViewMode] = useMobileView("table")
  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const list = useRequirementsList()

  const handleOpen = (requirement: Requirement) => {
    navigateToRequirement({
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      router,
    })
  }

  const handleClearFilters = () => {
    list.handleClearFilters()
    if (searchInputRef.current) searchInputRef.current.value = ""
  }

  const activeFilterCount = list.filters.priority.length + list.filters.completionStatus.length + list.filters.segments.length

  const emptyMessage = () => {
    if (list.searchQuery) {
      return {
        title: t("requirements.empty.searchTitle") || "No matching requirements found",
        description: t("requirements.empty.searchDesc") || "No results for your search. Try with other terms.",
      }
    }
    return {
      title: t("requirements.empty.noTitle") || "No requirements found",
      description: t("requirements.empty.noDesc") || "No requirements created yet. Create a new one to start.",
    }
  }

  const renderContent = () => {
    if (list.isLoading || (!list.currentSite && !list.visibleError)) {
      return <RequirementsTableSkeleton />
    }
    if (list.visibleError) {
      return (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
          <h3 className="mb-2 font-semibold">{t("requirements.error.loading") || "Error loading requirements"}</h3>
          <p>{list.visibleError}</p>
          <button
            onClick={() => safeReload(false, "Requirements page error retry")}
            className="mt-2 rounded-md bg-red-100 px-4 py-2 text-red-800 hover:bg-red-200"
          >
            {t("requirements.error.retry") || "Retry"}
          </button>
        </div>
      )
    }
    if (!list.currentSite) {
      return (
        <div className="flex h-[300px] flex-col items-center justify-center p-8 text-center">
          <XCircle className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-xl font-medium">{t("requirements.noSite.title") || "No site selected"}</h3>
          <p className="max-w-md text-muted-foreground">
            {t("requirements.noSite.desc") || "Please create or select a site to manage its requirements."}
          </p>
        </div>
      )
    }
    if (viewMode === "table") {
      return (
        <RequirementsTable
          requirements={list.filteredRequirements}
          currency={list.currentSite?.settings?.currency || "USD"}
          onOpen={handleOpen}
          onUpdateStatus={list.handleUpdateStatus}
          onUpdatePriority={list.handleUpdatePriority}
          emptyTitle={emptyMessage().title}
          emptyDescription={emptyMessage().description}
        />
      )
    }
    return (
      <KanbanView
        requirements={list.filteredRequirements}
        onUpdateRequirementStatus={(id, status) => list.handleUpdateStatus(id, status)}
        segments={list.segments}
        onRequirementClick={handleOpen}
        filters={list.filters}
        onOpenFilters={() => setIsFilterModalOpen(true)}
      />
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-var(--topbar-height,64px))] w-full min-w-0 flex-1 flex-col p-0">
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={list.filters}
        onApplyFilters={list.setFilters}
        segments={list.segments}
        completionStatusOptions={[COMPLETION_STATUS.PENDING, COMPLETION_STATUS.COMPLETED, COMPLETION_STATUS.REJECTED]}
        statusOptions={[
          REQUIREMENT_STATUS.IN_PROGRESS,
          REQUIREMENT_STATUS.ON_REVIEW,
          REQUIREMENT_STATUS.DONE,
          REQUIREMENT_STATUS.BACKLOG,
          REQUIREMENT_STATUS.CANCELED,
        ]}
      />

      <Tabs value={list.activeTab} onValueChange={list.setActiveTab} className="flex h-full min-h-0 w-full flex-1 flex-col">
        <StickyHeader>
          <div className="w-full pt-0">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-8">
                <TabsList className="h-8 rounded-full bg-muted/30 p-0.5">
                  <TabsTrigger value="all" className="flex items-center justify-center gap-1.5 rounded-full text-xs" title={t("requirements.tabs.all") || "All Requirements"}>
                    <LayoutGrid size={13} className="md:!hidden" />
                    <span className="tab-label">{t("requirements.tabs.all") || "All Requirements"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="flex items-center justify-center gap-1.5 rounded-full text-xs" title={t("requirements.tabs.pending") || "Pending"}>
                    <Clock size={13} className="md:!hidden" />
                    <span className="tab-label">{t("requirements.tabs.pending") || "Pending"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="flex items-center justify-center gap-1.5 rounded-full text-xs" title={t("requirements.tabs.completed") || "Completed"}>
                    <CheckCircle2 size={13} className="md:!hidden" />
                    <span className="tab-label">{t("requirements.tabs.completed") || "Completed"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="rejected" className="flex items-center justify-center gap-1.5 rounded-full text-xs" title={t("requirements.tabs.rejected") || "Rejected"}>
                    <Ban size={13} className="md:!hidden" />
                    <span className="tab-label">{t("requirements.tabs.rejected") || "Rejected"}</span>
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <SearchInput
                    placeholder={t("requirements.search") || "Search requirements..."}
                    value={list.searchQuery}
                    onSearch={list.setSearchQuery}
                    ref={searchInputRef}
                    className="border-border bg-background focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                    alwaysExpanded={false}
                  />
                  <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full" onClick={() => setIsFilterModalOpen(true)}>
                    <Filter className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-full px-4" title={t("requirements.sortBy") || "Sort by"}>
                        <ListOrdered className="h-4 w-4" />
                        <span className="hidden font-normal sm:inline">
                          {list.sortBy === "priority"
                            ? (t("requirements.sort.priority") || "Priority")
                            : list.sortBy === "newest"
                              ? (t("requirements.sort.newest") || "Newest")
                              : (t("requirements.sort.budget") || "Budget")}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => list.setSortBy("priority")} className="cursor-pointer">
                        {t("requirements.sort.priority") || "Priority"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => list.setSortBy("newest")} className="cursor-pointer">
                        {t("requirements.sort.newest") || "Newest"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => list.setSortBy("budget")} className="cursor-pointer">
                        {t("requirements.sort.budget") || "Budget"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-4">
                {activeFilterCount > 0 ? (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    <Badge variant="outline" className="rounded-full px-2 py-0">{activeFilterCount}</Badge>
                    <span className="ml-2">{t("requirements.clearFilters") || "Clear"}</span>
                  </Button>
                ) : null}
                <ViewSelector currentView={viewMode} onViewChange={setViewMode} />
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="flex-1 space-y-4 bg-muted/30 p-8">
          <div className={viewMode === "kanban" ? "overflow-x-auto pb-4 -mx-8" : ""}>
            <div className={viewMode === "kanban" ? "min-w-fit px-8" : ""}>
              {["all", "pending", "completed", "rejected"].map((tab) => (
                <TabsContent
                  key={tab}
                  value={tab}
                  className={viewMode === "kanban" ? "m-0 mt-0 min-h-[calc(100dvh-220px)]" : "mt-0 min-h-[calc(100dvh-220px)] space-y-4"}
                >
                  {renderContent()}
                </TabsContent>
              ))}
            </div>
            {viewMode === "kanban" ? <div className="w-16 flex-shrink-0" /> : null}
          </div>
        </div>
      </Tabs>
    </div>
  )
}

export { createRequirement } from "./actions"
export type { Segment } from "./types"

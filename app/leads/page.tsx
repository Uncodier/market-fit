"use client"

import React from "react"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
import { Badge } from "@/app/components/ui/badge"
import { MessageSquare, Filter, LayoutGrid, PlusCircle, Star, TrendingDown, Ban, TrendingUp, XCircle } from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"
import { KanbanView } from "@/app/components/kanban-view"
import { LeadFilterModal } from "@/app/components/ui/lead-filter-modal"
import { AttributionModal } from "./components/AttributionModal"
import { GroupedLeadsTable } from "./components/grouped-leads-table"
import { LeadsTableSkeleton } from "./components/LeadsTableSkeleton"
import { LeadsBulkActions } from "./components/LeadsBulkActions"
import { LeadsToolbar } from "./components/LeadsToolbar"
import { LeadsTransferActions } from "./components/LeadsTransferActions"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { useLeadsPage } from "./hooks/use-leads-page"

interface LeadsContextType {
  segments: Array<{ id: string; name: string }>
}

const LeadsContext = React.createContext<LeadsContextType>({
  segments: []
})


export default function LeadsPage() {
  const { t } = useLocalization()
  const {
    segments, loading, searchTotalCount, allLeadsTotalCount, searchQuery, userData,
    currentPage, itemsPerPage, activeTab, setActiveTab, viewType, setViewType,
    isFilterModalOpen, setIsFilterModalOpen, filters, sortBy, handleSortChange,
    forceReload, leadJourneyStages, isLoadingJourneyStages, reloadingLeads,
    invalidateJourneyStageCache, kanbanPagination, totalCounts, handleLoadMoreKanban,
    showAttributionModal, setShowAttributionModal, pendingStatusChange,
    handleUpdateLead, handleDeleteLead, handleImportLeads, handleExportLeads,
    handleUpdateLeadStatus, handleAttributionConfirm, handleAttributionCancel,
    selectedLeads, setSelectedLeads, isBulkActionLoading,
    handleBulkDelete, handleBulkAssign, handleBulkStatusChange,
    filteredLeads, companyGroups, handlePageChange, handleItemsPerPageChange,
    handleToggleCompanyExpansion, handleSearchChange, handleLeadClick,
    handleApplyFilters, handleClearFilters, handleOpenFilterModal
  } = useLeadsPage()

  return (
    <LeadsContext.Provider value={{ segments }}>
    <div className="flex-1 min-w-0 w-full p-0 min-h-[calc(100dvh-var(--topbar-height,64px))] flex flex-col">
      {/* Attribution Modal */}
      {pendingStatusChange && (pendingStatusChange.newStatus === "converted" || pendingStatusChange.newStatus === "lost") && (
        <AttributionModal
          isOpen={showAttributionModal}
          onOpenChange={setShowAttributionModal}
          leadName={pendingStatusChange.leadName}
          statusType={pendingStatusChange.newStatus as "converted" | "lost"}
          onConfirm={handleAttributionConfirm}
          onCancel={handleAttributionCancel} />
      )}
      
      {/* Filter modal */}
      <LeadFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        segments={segments} />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col w-full h-full min-h-0">
        <StickyHeader>
          <div className="w-full pt-0">
            {selectedLeads.size > 0 ? (
              <LeadsBulkActions
                isLoading={isBulkActionLoading}
                onCancel={() => setSelectedLeads(new Set())}
                onAssign={handleBulkAssign}
                onStatusChange={handleBulkStatusChange}
                onDelete={handleBulkDelete}
              />
            ) : (
              <div className="flex min-w-0 items-center justify-between gap-2 md:gap-0 w-full">
                <MobileFiltersDrawer triggerText={t('common.search') || "Search"}>
                  <FilterContainer>
                    <FilterSection mobileOnly>
                      <SearchInput  
                        placeholder="Search leads..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        alwaysExpanded={true}
                        className="w-full h-10 md:h-9 bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"  
                        containerClassName="w-full" 
                      />
                    </FilterSection>

                    

                    <FilterSection title={t('common.status') || 'Status'} className={cn(searchQuery && "max-md:hidden")}>
                      <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap md:flex-row w-full md:max-w-full overflow-y-visible md:overflow-x-auto justify-start items-center gap-2 md:gap-0">
                        <TabsTrigger value="all" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('leads.tabs.all') || 'All Companies'}>
                          <LayoutGrid size={13} className="mr-2 md:mr-0" />
                          <span className="tab-label">{t('leads.tabs.all') || 'All Companies'}</span>
                        </TabsTrigger>
                        <TabsTrigger value="new" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('leads.tabs.new') || 'New'}>
                          <PlusCircle size={13} className="mr-2 md:mr-0" />
                          <span className="tab-label">{t('leads.tabs.new') || 'New'}</span>
                        </TabsTrigger>
                        <TabsTrigger value="contacted" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('leads.tabs.contacted') || 'Contacted'}>
                          <MessageSquare size={13} className="mr-2 md:mr-0" />
                          <span className="tab-label">{t('leads.tabs.contacted') || 'Contacted'}</span>
                        </TabsTrigger>
                        <TabsTrigger value="qualified" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('leads.tabs.qualified') || 'Qualified'}>
                          <Star size={13} className="mr-2 md:mr-0" />
                          <span className="tab-label">{t('leads.tabs.qualified') || 'Qualified'}</span>
                        </TabsTrigger>
                        <TabsTrigger value="cold" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('leads.tabs.cold') || 'Cold'}>
                          <TrendingDown size={13} className="mr-2 md:mr-0" />
                          <span className="tab-label">{t('leads.tabs.cold') || 'Cold'}</span>
                        </TabsTrigger>
                        <TabsTrigger value="converted" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('leads.tabs.converted') || 'Converted'}>
                          <TrendingUp size={13} className="mr-2 md:mr-0" />
                          <span className="tab-label">{t('leads.tabs.converted') || 'Converted'}</span>
                        </TabsTrigger>
                        <TabsTrigger value="lost" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('leads.tabs.lost') || 'Lost'}>
                          <XCircle size={13} className="mr-2 md:mr-0" />
                          <span className="tab-label">{t('leads.tabs.lost') || 'Lost'}</span>
                        </TabsTrigger>
                        <TabsTrigger value="not_qualified" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('leads.tabs.notQualified') || 'Not Qualified'}>
                          <Ban size={13} className="mr-2 md:mr-0" />
                          <span className="tab-label">{t('leads.tabs.notQualified') || 'Not Qualified'}</span>
                        </TabsTrigger>
                      </TabsList>
                    </FilterSection>
                    
                    <FilterSection className={cn("flex flex-col md:flex-row items-stretch md:items-center gap-2 mt-2 md:mt-0", searchQuery && "max-md:hidden")}>
                      <Button 
                        variant="secondary" 
                        size={(filters.status.length > 0 || filters.segments.length > 0 || filters.origin.length > 0) ? "default" : "sm"}
                        className={cn(
                          "w-full md:w-auto h-10 md:h-9 rounded-md md:rounded-full justify-center",
                          (filters.status.length > 0 || filters.segments.length > 0 || filters.origin.length > 0) ? "px-4" : "md:w-9 md:px-0 px-4"
                        )}
                        onClick={handleOpenFilterModal}
                      >
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4" />
                          <span className="font-normal md:hidden">Filters</span>
                        </div>
                        {(filters.status.length > 0 || filters.segments.length > 0 || filters.origin.length > 0) && (
                          <Badge variant="secondary" className="ml-2">
                            {filters.status.length + filters.segments.length + filters.origin.length}
                          </Badge>
                        )}
                      </Button>

                      {(filters.status.length > 0 || filters.segments.length > 0 || filters.origin.length > 0) && (
                        <Button variant="ghost" size="sm" onClick={handleClearFilters} className="w-full md:w-auto h-10 md:h-9 rounded-md md:rounded-full">
                          <span className="ml-2">{t('leads.filters.clear') || 'Clear filters'}</span>
                        </Button>
                      )}
                    </FilterSection>

                    <FilterSection desktopOnly>
                      <SearchInput  
                        placeholder="Search leads..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="w-full h-10 md:h-9 bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"  
                        containerClassName="w-full md:w-64" 
                      />
                    </FilterSection>
                    <FilterSection mobileOnly>
                      <LeadsTransferActions
                        mobile
                        segments={segments}
                        onImportLeads={handleImportLeads}
                        onExportLeads={handleExportLeads}
                      />
                    </FilterSection>
                  </FilterContainer>
                </MobileFiltersDrawer>
            

                <LeadsToolbar
                  segments={segments}
                  onImportLeads={handleImportLeads}
                  onExportLeads={handleExportLeads}
                  sortBy={sortBy}
                  onSortChange={handleSortChange}
                  currentView={viewType}
                  onViewChange={setViewType}
                />
              </div>
            )}
          </div>
        </StickyHeader>
        
      <div className={cn(
        "bg-muted/30 flex-1 min-w-0 overflow-y-auto",
        viewType === "kanban" ? "py-4 md:py-8" : "p-4 md:p-8 space-y-4 overflow-x-hidden"
      )}>
              {loading ? (
              <LeadsTableSkeleton />
            ) : (
              <>
                {["all", "new", "contacted", "qualified", "cold", "converted", "lost", "not_qualified"].map(tabValue => (
                  <TabsContent key={tabValue} value={tabValue} className="mt-0 h-full min-w-0">
                  {viewType === "table" ? (
                      <GroupedLeadsTable
                        companyGroups={companyGroups}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={searchTotalCount ?? allLeadsTotalCount ?? filteredLeads.length}
                        totalCompanies={companyGroups.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                      forceReload={forceReload}
                      invalidateJourneyStageCache={invalidateJourneyStageCache}
                      onUpdateLead={handleUpdateLead}
                      onDeleteLead={handleDeleteLead}
                      userData={userData}
                        onToggleCompanyExpansion={handleToggleCompanyExpansion}
                      segments={segments}
                        leadJourneyStages={leadJourneyStages}
                        isLoadingJourneyStages={isLoadingJourneyStages}
                        reloadingLeads={reloadingLeads}
                        selectedLeads={selectedLeads}
                        onSelectLeads={setSelectedLeads} />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                      onUpdateLead={handleUpdateLead}
                      userData={userData}
                      kanbanPagination={kanbanPagination}
                      onLoadMore={handleLoadMoreKanban}
                      totalCounts={totalCounts} />
                  )}
                </TabsContent>
                ))}
              </>
            )}
        </div>
      </Tabs>
    </div>
    </LeadsContext.Provider>
  )
}

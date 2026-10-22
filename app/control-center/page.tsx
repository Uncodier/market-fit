"use client"

import { useEffect } from "react"
import { TaskSidebar } from "./components/TaskSidebar"
import { TaskKanban } from "./components/TaskKanban"
import { TasksTable } from "./components/TasksTable"
import { cn } from "@/lib/utils"
import { ControlCenterHeader } from "./components/ControlCenterHeader"
import { ViewSelector } from "@/app/components/view-selector"
import { TaskCalendar } from "@/app/control-center/components/TaskCalendar"
import { TaskFilterModal } from "./components/TaskFilterModal"
import { TaskStatusFilter } from "./components/TaskStatusFilter"
import { SearchInput } from "@/app/components/ui/search-input"
import { Filter } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { ControlCenterSkeleton } from "./components/ControlCenterSkeleton"
import { EmptyState } from "@/app/components/ui/empty-state"
import { ClipboardList, ListOrdered, Check, ChevronDown, Loader } from "@/app/components/ui/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"

import { useControlCenterPage } from "./hooks/useControlCenterPage"

export default function ControlCenterPage() {
  const { t, categories, leads, users, taskTypes, totalCounts, taskCounts, isLoading, isLayoutCollapsed, isMobile, isSidebarCollapsed, setIsSidebarCollapsed, selectedItem, setSelectedItem, searchQuery, setSearchQuery, viewType, setViewType, currentPage, itemsPerPage, isFilterModalOpen, setIsFilterModalOpen, filters, setFilters, statusFilter, setStatusFilter, sortBy, setSortBy, selectedTasks, setSelectedTasks, isBulkActionLoading, kanbanPagination, sidebarLeft, handleUpdateTaskStatus, handleTaskClick, toggleTaskSelection, handleBulkDelete, handleBulkStatusChange, handleLoadMoreKanban, filteredTasks, handlePageChange, handleItemsPerPageChange, getTotalActiveFilters } = useControlCenterPage()
  useEffect(() => {
    const title = t("operations.controlCenter.title")
    document.title = `${title} | Market Fit`
    window.dispatchEvent(new CustomEvent("breadcrumb:update", {
      detail: { title, path: "/control-center", section: "Control Center" },
    }))
  }, [t])

  if (isLoading) {
    return <ControlCenterSkeleton 
      isLayoutCollapsed={isLayoutCollapsed}
      isSidebarCollapsed={isSidebarCollapsed}
    />
  }

  return (
    <div className="flex h-full relative">
      {/* Sidebar - hidden on mobile */}
      <div 
        className={cn(
          "hidden md:block fixed h-screen transition-[width,opacity,left] duration-300 ease-in-out z-[100]",
          isSidebarCollapsed ? "w-0 opacity-0" : "w-[319px] opacity-100"
        )}
        style={{ 
          left: sidebarLeft,
          top: '64px'
        }}
      >
        <TaskSidebar
          categories={categories}
          taskTypes={taskTypes}
          selectedItem={selectedItem}
          onSelectItem={setSelectedItem}
          taskCountByCategory={taskCounts.byCategory}
          taskCountByType={taskCounts.byType}
          isCollapsed={isSidebarCollapsed}

        />
      </div>

      {/* Main content */}
      <div 
        className={cn(
          "flex flex-col h-full flex-1 min-w-0 transition-all duration-300 ease-in-out relative",
          !isSidebarCollapsed ? "md:ml-0" : ""
        )}
        style={{
          marginLeft: `-${sidebarLeft}`,
          width: `calc(100% + ${sidebarLeft})`
        }}
      >
        {/* Header */}
        <div className="relative">
          <ControlCenterHeader
            isSidebarCollapsed={isSidebarCollapsed}
            toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            sidebarLeft={sidebarLeft}
            leftContent={
              selectedTasks.size > 0 ? (
                <div className="flex items-center gap-4 lg:gap-8 overflow-hidden">
                  <Badge variant="outline" className="rounded-full px-2 py-0">
                    {t("operations.controlCenter.selected", { count: selectedTasks.size })}
                  </Badge>
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                    {t("operations.controlCenter.chooseBulkAction")}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTasks(new Set())}
                      disabled={isBulkActionLoading}
                    >
                      {t("common.cancel")}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 gap-2 rounded-full px-4"
                          disabled={isBulkActionLoading}
                        >
                          {isBulkActionLoading ? (
                            <Loader className="h-4 w-4 animate-spin" />
                          ) : null}
                          {t("operations.controlCenter.bulkActions")}
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-40">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => handleBulkStatusChange('completed')}
                        >
                          {t("complete")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => handleBulkStatusChange('canceled')}
                        >
                          {t("common.cancel")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-destructive focus:text-destructive"
                          onClick={handleBulkDelete}
                        >
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ) : (
              <div className="flex items-center gap-4 lg:gap-8 overflow-hidden">
                <TaskStatusFilter
                  selectedFilter={statusFilter}
                  onFilterChange={setStatusFilter}
                  className="px-0 py-0 border-0 min-h-0"
                />
                <div className="flex items-center gap-2">
                  <SearchInput
                    placeholder={t('controlCenter.search')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                    alwaysExpanded={false}
                  />

                  <Button variant="secondary" size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={() => setIsFilterModalOpen(true)} aria-label={t("controlCenter.filter.title")}>
                    <Filter className="h-4 w-4" />
                    {getTotalActiveFilters() > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                        {getTotalActiveFilters()}
                      </span>
                    )}
                  </Button>
                </div>
              </div>
              )
            }
            rightContent={
              <div className="flex items-center gap-2">
                {getTotalActiveFilters() > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setFilters({ stage: [], status: [], leadId: [], assigneeId: [] })}>
                    <Badge variant="outline" className="rounded-full px-2 py-0">
                      {getTotalActiveFilters()}
                    </Badge>
                    <span className="ml-2">{t('controlCenter.filters.clear')}</span>
                  </Button>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 gap-2 rounded-full px-4" title={t('controlCenter.sortBy')} aria-label={t('controlCenter.sortBy')}>
                      <ListOrdered className="h-4 w-4" />
                      <span className="hidden sm:inline font-normal">
                        {sortBy === "priority"
                          ? t("priority")
                          : sortBy === "newest"
                            ? t('controlCenter.sort.newest')
                            : sortBy === "oldest"
                              ? t('controlCenter.sort.oldest')
                              : sortBy === "dueDateNearest"
                                ? t("operations.controlCenter.dueDateNearest")
                                : t("operations.controlCenter.dueDateOldest")}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setSortBy("priority")}
                    >
                      <Check className={cn("mr-2 h-4 w-4", sortBy === "priority" ? "opacity-100" : "opacity-0")} />
                      {t("priority")}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="cursor-pointer"
                      onClick={() => setSortBy("newest")}
                    >
                      <Check className={cn("mr-2 h-4 w-4", sortBy === "newest" ? "opacity-100" : "opacity-0")} />
                      {t('controlCenter.sort.newest')}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="cursor-pointer"
                      onClick={() => setSortBy("oldest")}
                    >
                      <Check className={cn("mr-2 h-4 w-4", sortBy === "oldest" ? "opacity-100" : "opacity-0")} />
                      {t('controlCenter.sort.oldest')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setSortBy("dueDateNearest")}
                    >
                      <Check className={cn("mr-2 h-4 w-4", sortBy === "dueDateNearest" ? "opacity-100" : "opacity-0")} />
                      {t("operations.controlCenter.dueDateNearest")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setSortBy("dueDateOldest")}
                    >
                      <Check className={cn("mr-2 h-4 w-4", sortBy === "dueDateOldest" ? "opacity-100" : "opacity-0")} />
                      {t("operations.controlCenter.dueDateOldest")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

              <ViewSelector
                  currentView={viewType}
                  onViewChange={(view) => { if (view !== "graph") setViewType(view) }}
                  showCalendar={true}
                />
              </div>
            }
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-muted/30 transition-colors duration-300 ease-in-out pt-[71px]">
          <div 
            className="min-h-full flex flex-col transition-all duration-300 ease-in-out"
            style={{ 
              paddingLeft: isMobile ? '0px' : `calc(${sidebarLeft} + ${!isSidebarCollapsed ? "319px" : "0px"})`
            }}
          >
            {filteredTasks.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState 
                  icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
                  title={t('controlCenter.empty.title')}
                  description={searchQuery ? t('operations.controlCenter.emptySearchDescription') : t('controlCenter.empty.desc')}
                  variant="fancy"
                />
              </div>
            ) : (
              <div className={cn("min-h-full min-w-0", viewType === "kanban" ? "py-4 md:py-8" : "p-4 md:p-8")}>
                {viewType === "kanban" ? (
                <TaskKanban
                  tasks={filteredTasks}
                  sortBy={sortBy}
                  onUpdateTaskStatus={handleUpdateTaskStatus}
                  onTaskClick={handleTaskClick}
                  kanbanPagination={kanbanPagination}
                  onLoadMore={handleLoadMoreKanban}
                  totalCounts={totalCounts}
                  selectedTasks={selectedTasks}
                  onToggleTaskSelection={toggleTaskSelection}
                />
              ) : viewType === "calendar" ? (
                <TaskCalendar
                  tasks={filteredTasks}
                  onTaskClick={handleTaskClick}
                />
              ) : (
                <TasksTable
                  tasks={filteredTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
                  currentPage={currentPage}
                  itemsPerPage={itemsPerPage}
                  totalTasks={filteredTasks.length}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  onTaskClick={handleTaskClick}
                  categories={categories}
                  selectedTasks={selectedTasks}
                  onToggleTaskSelection={toggleTaskSelection}
                />
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Filter Modal */}
      <TaskFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApplyFilters={setFilters}
        leads={leads}
        users={users}
      />
    </div>
  )
} 
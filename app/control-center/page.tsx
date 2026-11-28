"use client"

import { useEffect } from "react"
import { TaskSidebar } from "./components/TaskSidebar"
import { TaskKanban } from "./components/TaskKanban"
import { TasksTable } from "./components/TasksTable"
import { cn } from "@/lib/utils"
import { TaskPageHeader } from "./components/TaskPageHeader"
import { ViewSelector } from "@/app/components/view-selector"
import { TaskCalendar } from "@/app/control-center/components/TaskCalendar"
import { TaskFilterModal } from "./components/TaskFilterModal"
import { TaskStatusFilter } from "./components/TaskStatusFilter"
import { SearchInput } from "@/app/components/ui/search-input"
import { ToolbarFilterButton } from "@/app/components/ui/toolbar-filter-button"
import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { ControlCenterSkeleton } from "./components/ControlCenterSkeleton"
import { EmptyState } from "@/app/components/ui/empty-state"
import { ChevronDown, ClipboardList, Loader, XCircle } from "@/app/components/ui/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"

import { useControlCenterPage } from "./hooks/useControlCenterPage"

export default function ControlCenterPage() {
  const { t, categories, leads, users, taskTypes, totalCounts, taskCounts, isLoading, isMobile, isSidebarCollapsed, setIsSidebarCollapsed, selectedItem, setSelectedItem, searchQuery, setSearchQuery, viewType, setViewType, currentPage, itemsPerPage, isFilterModalOpen, setIsFilterModalOpen, filters, setFilters, statusFilter, setStatusFilter, sortBy, setSortBy, selectedTasks, setSelectedTasks, isBulkActionLoading, kanbanPagination, sidebarLeft, handleUpdateTaskStatus, handleTaskClick, toggleTaskSelection, handleBulkDelete, handleBulkStatusChange, handleLoadMoreKanban, filteredTasks, handlePageChange, handleItemsPerPageChange, getTotalActiveFilters } = useControlCenterPage()
  useEffect(() => {
    const title = t("operations.controlCenter.title")
    document.title = `${title} | Market Fit`
    window.dispatchEvent(new CustomEvent("breadcrumb:update", {
      detail: { title, path: "/control-center", section: "Control Center" },
    }))
  }, [t])

  if (isLoading) {
    return <ControlCenterSkeleton 
      sidebarLeft={sidebarLeft}
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
          <TaskPageHeader
            isMobile={isMobile}
            isSidebarCollapsed={isSidebarCollapsed}
            toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            sidebarLeft={sidebarLeft}
            leftContent={
              selectedTasks.size > 0 ? (
                <div className="flex flex-wrap md:flex-nowrap items-center gap-4 lg:gap-8 md:overflow-hidden">
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
              <div className="flex min-w-0 flex-col md:flex-row items-stretch md:items-center gap-4 lg:gap-8 md:overflow-hidden">
                {!isMobile && <SearchInput
                  placeholder={t('controlCenter.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                />}
                <TaskStatusFilter
                  selectedFilter={statusFilter}
                  onFilterChange={setStatusFilter}
                  className="px-0 py-0 border-0 min-h-0"
                />
              </div>
              )
            }
            mobileSearch={selectedTasks.size === 0 && <SearchInput placeholder={t('controlCenter.search')}
              value={searchQuery} onChange={event => setSearchQuery(event.target.value)} />}
            rightContent={
              <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
                <ToolbarFilterButton label={t("controlCenter.filter.title")} count={getTotalActiveFilters()} onClick={() => setIsFilterModalOpen(true)} />
                {getTotalActiveFilters() > 0 && (
                  <ToolbarIconButton label={t('controlCenter.filters.clear')} onClick={() => setFilters({ stage: [], status: [], leadId: [], assigneeId: [] })}>
                    <XCircle className="h-4 w-4" aria-hidden />
                  </ToolbarIconButton>
                )}
                
                <SortDropdown sortBy={sortBy} setSortBy={setSortBy} title={t("controlCenter.sortBy")}
                  options={[
                    { value: "priority", label: t("priority") },
                    { value: "newest", label: t("controlCenter.sort.newest") },
                    { value: "oldest", label: t("controlCenter.sort.oldest") },
                    { value: "dueDateNearest", label: t("operations.controlCenter.dueDateNearest") },
                    { value: "dueDateOldest", label: t("operations.controlCenter.dueDateOldest") },
                  ]}
                />

              </div>
            }
            viewContent={
              <ViewSelector
                  currentView={viewType}
                  onViewChange={(view) => { if (view !== "graph") setViewType(view) }}
                  showCalendar={true}
                />
            }
          />

        {/* Content */}
        <div className={cn("flex-1 min-h-0 overflow-auto bg-muted/30 transition-colors duration-300 ease-in-out", !isMobile && "pt-[71px]")}>
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
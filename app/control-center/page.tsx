"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLayout } from "@/app/context/LayoutContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { createClient } from "@/utils/supabase/client"
import { Category } from "@/app/types"
import { TaskSidebar } from "./components/TaskSidebar"
import { TaskKanban } from "./components/TaskKanban"
import { TasksTable } from "./components/TasksTable"
import { cn } from "@/lib/utils"
import { ControlCenterHeader } from "./components/ControlCenterHeader"
import { ViewSelector } from "@/app/components/view-selector"
import { TaskCalendar } from "@/app/control-center/components/TaskCalendar"
import { TaskFilterModal, TaskFilters } from "./components/TaskFilterModal"
import { TaskStatusFilter } from "./components/TaskStatusFilter"
import { SearchInput } from "@/app/components/ui/search-input"
import { Filter } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { ControlCenterSkeleton } from "./components/ControlCenterSkeleton"
import { EmptyState } from "@/app/components/ui/empty-state"
import { ClipboardList, ListOrdered, Check, ChevronDown, Loader } from "@/app/components/ui/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { toast } from "react-hot-toast"
import { getUserData } from "@/app/services/user-service"
import { useCommandK } from "@/app/hooks/use-command-k"
import { navigateToTask } from "@/app/hooks/use-navigation-history"
import React from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useControlCenterData, ExtendedTask } from "./hooks/useControlCenterData"


export default function ControlCenterPage() {
  const { t } = useLocalization()
  const router = useRouter()
  const { currentSite } = useSite()
  const { isLayoutCollapsed } = useLayout()
  const isMobile = useIsMobile()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [selectedItem, setSelectedItem] = useState<string>("all")
  const {
    categories,
    leads,
    users,
    tasks,
    taskTypes,
    totalCounts,
    taskCounts,
    initialKanbanPagination,
    isLoading,
    refreshTasks,
    updateTasksCache,
  } = useControlCenterData(currentSite?.id, currentSite?.user_id)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewType, setViewType] = useState<"table" | "kanban" | "calendar">("kanban")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>({
    stage: [],
    status: [],
    leadId: [],
    assigneeId: []
  })
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'completed'>('all')
  const [sortBy, setSortBy] = useState<"priority" | "newest" | "oldest" | "dueDateNearest" | "dueDateOldest">("priority")
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)

  // Kanban pagination state
  const [kanbanPagination, setKanbanPagination] = useState<Record<string, { page: number; hasMore: boolean; isLoading: boolean }>>({
    pending: { page: 1, hasMore: true, isLoading: false },
    in_progress: { page: 1, hasMore: true, isLoading: false },
    completed: { page: 1, hasMore: true, isLoading: false },
    failed: { page: 1, hasMore: true, isLoading: false },
    canceled: { page: 1, hasMore: true, isLoading: false }
  })

  useEffect(() => {
    if (initialKanbanPagination) {
      setKanbanPagination(initialKanbanPagination)
    }
  }, [initialKanbanPagination])

  // Initialize command+k hook
  useCommandK()

  // Calculate sidebar left position based on layout state
  const [sidebarLeft, setSidebarLeft] = useState('256px')

  // Update sidebar position when layout state changes
  useEffect(() => {
    setSidebarLeft(isMobile ? '0px' : (isLayoutCollapsed ? '64px' : '256px'))
  }, [isLayoutCollapsed, isMobile])

  // Update breadcrumb when component mounts
  useEffect(() => {
    // Update the page title for the browser tab
    document.title = "Control Center | Market Fit"
    
    // Emit a custom event to update the breadcrumb
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: "Control Center",
        path: "/control-center",
        section: 'Control Center'
      }
    })
    
    window.dispatchEvent(event)
    
    // Cleanup when component unmounts
    return () => {
      document.title = "Market Fit"
    }
  }, [])

  // Listen for task creation events
  useEffect(() => {
    const handleTaskCreated = () => {
      refreshTasks()
    }

    window.addEventListener('task:created', handleTaskCreated)

    return () => {
      window.removeEventListener('task:created', handleTaskCreated)
    }
  }, [refreshTasks])


  // Handle task status update
  const handleUpdateTaskStatus = async (taskId: string, newStatus: string, newPriority?: number) => {
    if (!currentSite) return

    const supabase = createClient()
    
    if (newPriority !== undefined) {
      // Use the reorder function when priority is provided
      const { error } = await supabase.rpc('reorder_task_priorities', {
        p_task_id: taskId,
        p_new_priority: newPriority,
        p_status: newStatus,
        p_site_id: currentSite.id
      })

      if (error) {
        console.error('Error reordering task:', error)
        toast.error("Failed to reorder task")
        return
      }
    } else {
      // Simple status update without priority change
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId)
        .eq('site_id', currentSite.id)

      if (error) {
        console.error('Error updating task status:', error)
        toast.error("Failed to update task status")
        return
      }
    }

    await refreshTasks()
  }

  // Handle task click
  const handleTaskClick = (task: ExtendedTask) => {
    navigateToTask({
      taskId: task.id,
      taskTitle: task.title,
      router
    })
  }

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const refreshTasksAfterBulkAction = async () => {
    await refreshTasks()
  }

  const handleBulkDelete = async () => {
    if (!currentSite || selectedTasks.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedTasks.size} tasks?`)) return

    const count = selectedTasks.size
    const ids = Array.from(selectedTasks)
    setIsBulkActionLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('tasks')
        .delete()
        .in('id', ids)
        .eq('site_id', currentSite.id)

      if (error) throw error

      setSelectedTasks(new Set())
      await refreshTasksAfterBulkAction()
      toast.success(`${count} tasks deleted successfully`)
    } catch (error) {
      console.error('Error in bulk delete:', error)
      toast.error('Failed to delete some tasks')
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!currentSite || selectedTasks.size === 0) return

    const count = selectedTasks.size
    const ids = Array.from(selectedTasks)
    setIsBulkActionLoading(true)

    try {
      const supabase = createClient()
      const updatePayload: { status: string; completed_date?: string } = { status: newStatus }
      if (newStatus === 'completed') {
        updatePayload.completed_date = new Date().toISOString()
      }

      const { error } = await supabase
        .from('tasks')
        .update(updatePayload)
        .in('id', ids)
        .eq('site_id', currentSite.id)

      if (error) throw error

      setSelectedTasks(new Set())
      await refreshTasksAfterBulkAction()
      toast.success(`Status updated for ${count} tasks`)
    } catch (error) {
      console.error('Error in bulk status change:', error)
      toast.error('Failed to update status for some tasks')
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  // Handle load more for kanban columns
  const handleLoadMoreKanban = async (status: string) => {
    const currentPagination = kanbanPagination[status]
    if (currentPagination.isLoading || !currentPagination.hasMore) return

    if (!currentSite) return

    // Set loading state
    setKanbanPagination(prev => ({
      ...prev,
      [status]: { ...prev[status], isLoading: true }
    }))

    try {
      const supabase = createClient()
      const itemsPerPage = 50
      const offset = currentPagination.page * itemsPerPage

      // Fetch more tasks for this specific status
      const { data: moreTasks, error } = await supabase
        .from('tasks')
        .select(`
          *,
          leads:lead_id (
            id,
            name
          ),
          comments_count:task_comments(count)
        `)
        .eq('site_id', currentSite.id)
        .eq('status', status)
        .order('priority', { ascending: false })
        .order('scheduled_date', { ascending: true })
        .range(offset, offset + itemsPerPage - 1)

      if (error) throw error

      // Enrich the new tasks with user data
      const enrichedMoreTasks = await Promise.all(
        moreTasks.map(async (task) => {
          let assigneeName = undefined
          if (task.assignee) {
            const userData = await getUserData(task.assignee)
            assigneeName = userData?.name
          }

          return {
            ...task,
            leadName: task.leads?.name,
            assigneeName,
            comments_count: task.comments_count?.[0]?.count || 0
          }
        })
      )

      updateTasksCache((prev) => {
        if (!prev) return prev
        const existingTaskIds = new Set(prev.tasks.map((t) => t.id))
        const newTasks = enrichedMoreTasks.filter((t) => !existingTaskIds.has(t.id))
        return { ...prev, tasks: [...prev.tasks, ...newTasks] }
      })

      // Update pagination state
      setKanbanPagination(prev => ({
        ...prev,
        [status]: { 
          ...prev[status], 
          page: prev[status].page + 1,
          isLoading: false,
          hasMore: moreTasks.length === itemsPerPage
        }
      }))

      // Note: totalCounts doesn't need to be updated since it represents the total count in the database
      // which doesn't change when we load more tasks (we're just displaying more of the existing total)

    } catch (error) {
      console.error('Error loading more tasks:', error)
      toast.error("Failed to load more tasks")
      setKanbanPagination(prev => ({
        ...prev,
        [status]: { ...prev[status], isLoading: false }
      }))
    }
  }

  // Filter tasks based on search query and filters
  const filteredTasks = tasks.filter(task => {
    // First apply search filter
    const matchesSearch = searchQuery === "" || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false



    // Apply stage filters
    if (filters.stage.length > 0 && !filters.stage.includes(task.stage || '')) return false

    // Apply status filter from tabs
    if (statusFilter === 'new' && task.status !== 'pending') return false
    if (statusFilter === 'completed' && !['failed', 'canceled', 'completed'].includes(task.status)) return false

    // Apply status filters from modal
    if (filters.status.length > 0 && !filters.status.includes(task.status)) return false

    // Apply lead filters
    if (filters.leadId.length > 0 && !filters.leadId.includes(task.lead_id || '')) return false

    // Apply assignee filters
    if (filters.assigneeId.length > 0 && !filters.assigneeId.includes(task.assignee || '')) return false

    // Apply category/type filter based on selectedItem
    if (selectedItem !== "all") {
      if (selectedItem.startsWith('type-')) {
        // Remove 'type-' prefix and check task type
        const type = selectedItem.replace('type-', '')
        if (task.type !== type) return false
      } else if (selectedItem.startsWith('category-')) {
        // Remove 'category-' prefix and check category_id
        const categoryId = selectedItem.replace('category-', '')
        if (task.category_id !== categoryId) return false
      }
    }

    return true
  }).sort((a, b) => {
    if (sortBy === 'priority') {
      const priorityDiff = (b.priority || 0) - (a.priority || 0)
      if (priorityDiff !== 0) return priorityDiff

      const dateA = new Date(a.scheduled_date || 0).getTime()
      const dateB = new Date(b.scheduled_date || 0).getTime()
      return dateA - dateB
    }

    if (sortBy === 'dueDateNearest') {
      const dueDateA = new Date(a.scheduled_date || 0).getTime()
      const dueDateB = new Date(b.scheduled_date || 0).getTime()
      return dueDateA - dueDateB
    }

    if (sortBy === 'dueDateOldest') {
      const dueDateA = new Date(a.scheduled_date || 0).getTime()
      const dueDateB = new Date(b.scheduled_date || 0).getTime()
      return dueDateB - dueDateA
    }

    const dateA = new Date(a.created_at || 0).getTime()
    const dateB = new Date(b.created_at || 0).getTime()

    if (sortBy === 'newest') return dateB - dateA
    if (sortBy === 'oldest') return dateA - dateB
    return 0
  })

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Handle items per page change
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value))
    setCurrentPage(1)
  }

  // Get total active filters
  const getTotalActiveFilters = () => {
    return filters.stage.length + filters.status.length + filters.leadId.length + filters.assigneeId.length
  }

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
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onFilterClick={() => setIsFilterModalOpen(true)}
          activeFilters={getTotalActiveFilters()}
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
                    {selectedTasks.size} selected
                  </Badge>
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                    Choose bulk action
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTasks(new Set())}
                      disabled={isBulkActionLoading}
                    >
                      Cancel
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
                          Bulk actions
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-40">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => handleBulkStatusChange('completed')}
                        >
                          Complete
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => handleBulkStatusChange('canceled')}
                        >
                          Cancel
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-destructive focus:text-destructive"
                          onClick={handleBulkDelete}
                        >
                          Delete
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
                    placeholder={t('controlCenter.search') === 'controlCenter.search' ? 'Search tasks...' : t('controlCenter.search')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                    alwaysExpanded={false}
                  />

                  <Button variant="secondary" size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={() => setIsFilterModalOpen(true)}>
                    <Filter className="h-4 w-4" />
                    {getTotalActiveFilters() > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                        {getTotalActiveFilters()}
                      </span>
                    )}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 gap-2 rounded-full px-4" title={t('controlCenter.sortBy') === 'controlCenter.sortBy' ? 'Sort by' : t('controlCenter.sortBy')}>
                        <ListOrdered className="h-4 w-4" />
                        <span className="hidden sm:inline font-normal">
                          {sortBy === "priority"
                            ? "Priority"
                            : sortBy === "newest"
                              ? (t('controlCenter.sort.newest') === 'controlCenter.sort.newest' ? 'Newest' : t('controlCenter.sort.newest'))
                              : sortBy === "oldest"
                                ? (t('controlCenter.sort.oldest') === 'controlCenter.sort.oldest' ? 'Oldest' : t('controlCenter.sort.oldest'))
                                : sortBy === "dueDateNearest"
                                  ? "Due Date (Nearest)"
                                  : "Due Date (Oldest)"}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setSortBy("priority")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "priority" ? "opacity-100" : "opacity-0")} />
                        Priority
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        onClick={() => setSortBy("newest")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "newest" ? "opacity-100" : "opacity-0")} />
                        {t('controlCenter.sort.newest') === 'controlCenter.sort.newest' ? 'Newest' : t('controlCenter.sort.newest')}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        onClick={() => setSortBy("oldest")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "oldest" ? "opacity-100" : "opacity-0")} />
                        {t('controlCenter.sort.oldest') === 'controlCenter.sort.oldest' ? 'Oldest' : t('controlCenter.sort.oldest')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setSortBy("dueDateNearest")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "dueDateNearest" ? "opacity-100" : "opacity-0")} />
                        Due Date (Nearest)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setSortBy("dueDateOldest")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "dueDateOldest" ? "opacity-100" : "opacity-0")} />
                        Due Date (Oldest)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              )
            }
            rightContent={
              <div className="flex items-center gap-4">
                {getTotalActiveFilters() > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setFilters({ stage: [], status: [], leadId: [], assigneeId: [] })}>
                    <Badge variant="outline" className="rounded-full px-2 py-0">
                      {getTotalActiveFilters()}
                    </Badge>
                    <span className="ml-2">{t('controlCenter.filters.clear') || 'Clear'}</span>
                  </Button>
                )}
                <ViewSelector
                  currentView={viewType}
                  onViewChange={(view) => setViewType(view)}
                  showCalendar={true}
                />
              </div>
            }
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-muted/30 transition-colors duration-300 ease-in-out pt-[71px]">
          <div 
            className="h-full transition-all duration-300 ease-in-out"
            style={{ 
              paddingLeft: isMobile ? '0px' : `calc(${sidebarLeft} + ${!isSidebarCollapsed ? "319px" : "0px"})`
            }}
          >
            {filteredTasks.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState 
                  icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
                  title={t('controlCenter.empty.title') || "No tasks found"}
                  description={searchQuery ? (t('controlCenter.empty.searchDesc') || "Try adjusting your search or filters to find what you're looking for.") : (t('controlCenter.empty.desc') || "There are no tasks to display at this time.")}
                  variant="fancy"
                />
              </div>
            ) : (
              <div className="p-4 md:p-8 h-full">
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
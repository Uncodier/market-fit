"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLayout } from "@/app/context/LayoutContext"
import { createClient } from "@/utils/supabase/client"
import { Category, Task } from "@/app/types"
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
import { ClipboardList, ListOrdered, Check, ChevronDown } from "@/app/components/ui/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { toast } from "react-hot-toast"
import { getUserData } from "@/app/services/user-service"
import { useCommandK } from "@/app/hooks/use-command-k"
import { navigateToTask } from "@/app/hooks/use-navigation-history"
import React from "react"
import { useLocalization } from "@/app/context/LocalizationContext"

interface ExtendedTask extends Task {
  leadName?: string
  assigneeName?: string
  comments_count?: number
}



interface TaskCounts {
  byCategory: Record<string, number>
  byType: Record<string, number>
}

export default function ControlCenterPage() {
  const { t } = useLocalization()
  const router = useRouter()
  const { currentSite } = useSite()
  const { isLayoutCollapsed } = useLayout()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [selectedItem, setSelectedItem] = useState<string>("all")
  const [categories, setCategories] = useState<Category[]>([])
  const [tasks, setTasks] = useState<ExtendedTask[]>([])
  const [taskTypes, setTaskTypes] = useState<string[]>([])
  const [taskCounts, setTaskCounts] = useState<TaskCounts>({ byCategory: {}, byType: {} })
  const [isLoading, setIsLoading] = useState(true)
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

  const [leads, setLeads] = useState<Array<{ id: string; name: string }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])

  // Kanban pagination state
  const [kanbanPagination, setKanbanPagination] = useState<Record<string, { page: number; hasMore: boolean; isLoading: boolean }>>({
    pending: { page: 1, hasMore: true, isLoading: false },
    in_progress: { page: 1, hasMore: true, isLoading: false },
    completed: { page: 1, hasMore: true, isLoading: false },
    failed: { page: 1, hasMore: true, isLoading: false },
    canceled: { page: 1, hasMore: true, isLoading: false }
  })

  // Total counts for each status from the database
  const [totalCounts, setTotalCounts] = useState<Record<string, number>>({
    pending: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    canceled: 0
  })

  // Initialize command+k hook
  useCommandK()

  // Calculate sidebar left position based on layout state
  const [sidebarLeft, setSidebarLeft] = useState('256px')

  // Update sidebar position when layout state changes
  useEffect(() => {
    setSidebarLeft(isLayoutCollapsed ? '64px' : '256px')
  }, [isLayoutCollapsed])

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

  // Fetch leads
  useEffect(() => {
    const fetchLeads = async () => {
      if (!currentSite) return

      const supabase = createClient()
      const { data, error } = await supabase
        .from('leads')
        .select('id, name')
        .eq('site_id', currentSite.id)
        .order('name')

      if (error) {
        console.error('Error fetching leads:', error)
        return
      }

      console.log('Fetched leads:', data)
      setLeads(data || [])
    }

    fetchLeads()
  }, [currentSite])

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentSite) return

      const supabase = createClient()
      
      // Get site owner
      const { data: ownerData, error: ownerError } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', currentSite.user_id)
        .single()

      if (ownerError && ownerError.code !== 'PGRST116') {
        console.error('Error fetching site owner:', ownerError)
      }

      // Get site members - first get the member records
      const { data: siteMembers, error: siteMembersError } = await supabase
        .from('site_members')
        .select('user_id')
        .eq('site_id', currentSite.id)
        .eq('status', 'active')
        .not('user_id', 'is', null)

      if (siteMembersError) {
        console.error('Error fetching site members:', siteMembersError)
      }

      // Get profiles for site members
      let memberProfiles: Array<{ id: string; name: string }> = []
      if (siteMembers && siteMembers.length > 0) {
        const memberUserIds = siteMembers.map(m => m.user_id)
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', memberUserIds)

        if (profilesError) {
          console.error('Error fetching member profiles:', profilesError)
        } else {
          memberProfiles = profilesData || []
        }
      }

      // Combine owner and members
      const allUsers = []
      
      // Add owner if found
      if (ownerData) {
        allUsers.push(ownerData)
      }
      
      // Add members
      allUsers.push(...memberProfiles)

      // Remove duplicates (in case owner is also in members table) and sort
      const uniqueUsers = allUsers.filter((user, index, self) => 
        index === self.findIndex(u => u.id === user.id)
      ).sort((a, b) => a.name.localeCompare(b.name))

      console.log('Fetched users:', uniqueUsers)
      setUsers(uniqueUsers)
    }

    fetchUsers()
  }, [currentSite])

  // Fetch initial tasks with user data and comments count (first 50 per status for kanban pagination)
  const fetchTasks = React.useCallback(async () => {
    if (!currentSite) return

    setIsLoading(true)
    const supabase = createClient()

    try {
      // Get initial tasks (limit to 50 per status for each status type for kanban view)
      const statuses = ['pending', 'in_progress', 'completed', 'failed', 'canceled']
      const allTasks = []
      const counts: Record<string, number> = {}

      // Fetch first 50 tasks and total count for each status
      for (const status of statuses) {
        // Get total count for this status
        const { count, error: countError } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('site_id', currentSite.id)
          .eq('status', status)

        if (countError) throw countError
        counts[status] = count || 0

        // Get first 50 tasks for this status
        const { data: statusTasks, error } = await supabase
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
          .limit(50)

        if (error) throw error
        if (statusTasks) allTasks.push(...statusTasks)
      }

      // Set total counts
      setTotalCounts(counts)

      // Enrich tasks with user data
      const enrichedTasks = await Promise.all(
        allTasks.map(async (task) => {
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

      setTasks(enrichedTasks)

      // Set kanban pagination state based on total counts
      setKanbanPagination({
        pending: { page: 1, hasMore: counts.pending > 50, isLoading: false },
        in_progress: { page: 1, hasMore: counts.in_progress > 50, isLoading: false },
        completed: { page: 1, hasMore: counts.completed > 50, isLoading: false },
        failed: { page: 1, hasMore: counts.failed > 50, isLoading: false },
        canceled: { page: 1, hasMore: counts.canceled > 50, isLoading: false }
      })

      // Extract unique task types from the fetched tasks
      const uniqueTypes = Array.from(new Set(
        enrichedTasks
          .map(task => task.type)
          .filter(type => type && type.trim() !== '')
      )).sort()
      
      console.log('Dynamic task types found:', uniqueTypes)
      setTaskTypes(uniqueTypes)

    } catch (error) {
      console.error('Error fetching tasks:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
        site_id: currentSite?.id
      })
      toast.error("Failed to load tasks")
    } finally {
      setIsLoading(false)
    }
  }, [currentSite])

  // Refresh tasks function that can be called from dialogs
  const refreshTasks = React.useCallback(() => {
    fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

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

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      if (!currentSite) return

      console.log('Fetching categories for site:', currentSite.id)
      
      const supabase = createClient()
      const { data: categoriesData, error } = await supabase
        .from('categories')
        .select('*')
        .eq('site_id', currentSite.id)
        .eq('is_active', true)

      if (error) {
        console.error('Error fetching categories:', error)
        return
      }

      console.log('Fetched categories:', {
        count: categoriesData?.length || 0,
        categories: categoriesData?.map(c => ({ id: c.id, name: c.name }))
      })
      
      setCategories(categoriesData || [])
    }

    fetchCategories()
  }, [currentSite])

  // Calculate task counts
  useEffect(() => {
    const newTaskCounts = {
      byCategory: {} as Record<string, number>,
      byType: {} as Record<string, number>
    }

    tasks.forEach(task => {
      // Count by type
      if (task.type) {
        newTaskCounts.byType[task.type] = (newTaskCounts.byType[task.type] || 0) + 1
      }

      // Count by category
      if (task.category_id) {
        newTaskCounts.byCategory[task.category_id] = (newTaskCounts.byCategory[task.category_id] || 0) + 1
      }
    })

    setTaskCounts(newTaskCounts)
  }, [tasks])

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

    // Refresh tasks and counts after update
    const fetchTasksAgain = async () => {
      try {
        // Fetch updated counts for all statuses
        const statuses = ['pending', 'in_progress', 'completed', 'failed', 'canceled']
        const counts: Record<string, number> = {}
        
        for (const status of statuses) {
          const { count, error: countError } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('site_id', currentSite.id)
            .eq('status', status)

          if (countError) throw countError
          counts[status] = count || 0
        }
        
        setTotalCounts(counts)

        // Fetch updated tasks
        const { data: tasksData, error: tasksError } = await supabase
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
          .order('priority', { ascending: false })
          .order('scheduled_date', { ascending: true })

        if (tasksError) throw tasksError

        const enrichedTasks = await Promise.all(
          tasksData.map(async (task) => {
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

        setTasks(enrichedTasks)

        // Update task types as well
        const uniqueTypes = Array.from(new Set(
          enrichedTasks
            .map(task => task.type)
            .filter(type => type && type.trim() !== '')
        )).sort()
        
        setTaskTypes(uniqueTypes)

      } catch (error) {
        console.error('Error fetching tasks:', error)
      }
    }

    await fetchTasksAgain()
  }

  // Handle task click
  const handleTaskClick = (task: ExtendedTask) => {
    navigateToTask({
      taskId: task.id,
      taskTitle: task.title,
      router
    })
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

      // Add new tasks to the existing tasks array
      setTasks(prevTasks => {
        // Remove any existing tasks with the same IDs to avoid duplicates
        const existingTaskIds = new Set(prevTasks.map(t => t.id))
        const newTasks = enrichedMoreTasks.filter(t => !existingTaskIds.has(t.id))
        return [...prevTasks, ...newTasks]
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
              paddingLeft: `calc(${sidebarLeft} + ${!isSidebarCollapsed ? "319px" : "0px"})`
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
              <div className="p-8 h-full">
                {viewType === "kanban" ? (
                <TaskKanban
                  tasks={filteredTasks}
                  sortBy={sortBy}
                  onUpdateTaskStatus={handleUpdateTaskStatus}
                  onTaskClick={handleTaskClick}
                  kanbanPagination={kanbanPagination}
                  onLoadMore={handleLoadMoreKanban}
                  totalCounts={totalCounts}
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
"use client"

import { isTaskStatus } from "../task-data"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLayout } from "@/app/context/LayoutContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { useAutoCollapseSidebar } from "@/app/hooks/use-auto-collapse-sidebar"
import { createClient } from "@/utils/supabase/client"
import { Task } from "@/app/types"

import { TaskFilters } from "../components/TaskFilterModal"

import { toast } from "react-hot-toast"

import { useCommandK } from "@/app/hooks/use-command-k"
import { navigateToTask } from "@/lib/navigation/navigation-helpers"

import { useLocalization } from "@/app/context/LocalizationContext"
import { useControlCenterData, ExtendedTask, enrichTasks } from "../hooks/useControlCenterData"

export function useControlCenterPage() {
  const { t } = useLocalization()
  const router = useRouter()
  const { currentSite } = useSite()
  const { isLayoutCollapsed } = useLayout()
  const isMobile = useIsMobile()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useAutoCollapseSidebar()
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
  const handleUpdateTaskStatus = async (taskId: string, newStatus: string, newPosition?: number) => {
    if (!currentSite || !isTaskStatus(newStatus)) return

    const supabase = createClient()
    
    if (newPosition !== undefined) {
      // The RPC accepts a 1-based destination position, not a priority value.
      const { error } = await supabase.rpc('reorder_task_priorities', {
        p_task_id: taskId,
        p_new_position: newPosition,
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
    if (!currentSite || selectedTasks.size === 0 || !isTaskStatus(newStatus)) return

    const count = selectedTasks.size
    const ids = Array.from(selectedTasks)
    setIsBulkActionLoading(true)

    try {
      const supabase = createClient()
      const updatePayload: { status: Task["status"]; completed_date?: string } = { status: newStatus }
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
    if (!isTaskStatus(status)) return
    const currentPagination = kanbanPagination[status]
    if (!currentPagination || currentPagination.isLoading || !currentPagination.hasMore) return

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
      const enrichedMoreTasks = await enrichTasks(moreTasks)

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

  return { t, categories, leads, users, taskTypes, totalCounts, taskCounts, isLoading, isLayoutCollapsed, isMobile, isSidebarCollapsed, setIsSidebarCollapsed, selectedItem, setSelectedItem, searchQuery, setSearchQuery, viewType, setViewType, currentPage, itemsPerPage, isFilterModalOpen, setIsFilterModalOpen, filters, setFilters, statusFilter, setStatusFilter, sortBy, setSortBy, selectedTasks, setSelectedTasks, isBulkActionLoading, kanbanPagination, sidebarLeft, handleUpdateTaskStatus, handleTaskClick, toggleTaskSelection, handleBulkDelete, handleBulkStatusChange, handleLoadMoreKanban, filteredTasks, handlePageChange, handleItemsPerPageChange, getTotalActiveFilters }
}

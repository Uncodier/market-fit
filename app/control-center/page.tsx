"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLayout } from "@/app/context/LayoutContext"
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
import { ControlCenterSkeleton } from "./components/ControlCenterSkeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ClipboardList } from "@/app/components/ui/icons"

// Task types
const TASK_TYPES = [
  'website_visit',
  'demo',
  'meeting',
  'email',
  'call',
  'quote',
  'contract',
  'payment',
  'referral',
  'feedback'
]

interface Task {
  id: string
  title: string
  description: string | null
  status: 'completed' | 'in_progress' | 'pending' | 'failed' | 'canceled'
  stage?: 'awareness' | 'consideration' | 'decision' | 'purchase' | 'retention' | 'referral'
  scheduled_date: string
  lead_id?: string
  assignee?: string
  type?: string
  leads?: {
    id: string
    name: string
  }
  leadName?: string
  assigneeName?: string
}

type TaskStatusFilter = Task['status'] | 'all'

interface TaskCounts {
  byCategory: Record<string, number>
  byType: Record<string, number>
}

export default function ControlCenterPage() {
  const router = useRouter()
  const { currentSite } = useSite()
  const { isLayoutCollapsed } = useLayout()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [selectedItem, setSelectedItem] = useState<string>("all")
  const [categories, setCategories] = useState<Category[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskCounts, setTaskCounts] = useState<TaskCounts>({ byCategory: {}, byType: {} })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewType, setViewType] = useState<"table" | "kanban" | "calendar">("kanban")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>({
    stage: [],
    leadId: [],
    assigneeId: []
  })
  const [currentStatus, setCurrentStatus] = useState<TaskStatusFilter>("all")
  const [leads, setLeads] = useState<Array<{ id: string; name: string }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])

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
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name')

      if (error) {
        console.error('Error fetching users:', error)
        return
      }

      console.log('Fetched users:', profiles)
      setUsers(profiles || [])
    }

    fetchUsers()
  }, [currentSite])

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      if (!currentSite) return

      setIsLoading(true)
      const supabase = createClient()

      console.log('Fetching tasks for site:', currentSite.id)
      
      // First fetch tasks
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          status,
          stage,
          scheduled_date,
          lead_id,
          assignee,
          type,
          leads:lead_id (
            id,
            name
          )
        `)
        .eq('site_id', currentSite.id)

      if (error) {
        console.error('Error fetching tasks:', error)
        setIsLoading(false)
        return
      }

      // Format tasks
      const formattedTasks: Task[] = tasks?.map(task => {
        // Ensure leads is properly typed
        const taskLeads = Array.isArray(task.leads) ? task.leads[0] : task.leads

        return {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          stage: task.stage,
          scheduled_date: task.scheduled_date,
          lead_id: task.lead_id,
          assignee: task.assignee,
          type: task.type,
          leads: taskLeads ? {
            id: taskLeads.id,
            name: taskLeads.name
          } : undefined,
          leadName: taskLeads?.name,
          assigneeName: task.assignee || 'Unassigned'
        }
      }) || []

      setTasks(formattedTasks)
      setIsLoading(false)
    }

    fetchTasks()
  }, [currentSite])

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
      if (task.lead_id) {
        newTaskCounts.byCategory[task.lead_id] = (newTaskCounts.byCategory[task.lead_id] || 0) + 1
      }
    })

    setTaskCounts(newTaskCounts)
  }, [tasks])

  // Handle task status update
  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    if (!currentSite) return

    const supabase = createClient()
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId)
      .eq('site_id', currentSite.id)

    if (error) {
      console.error('Error updating task status:', error)
      return
    }

    // Update local state
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, status: newStatus as any } : task
    ))
  }

  // Handle task click
  const handleTaskClick = (task: Task) => {
    router.push(`/control-center/${task.id}`)
  }

  // Filter tasks based on search query and filters
  const filteredTasks = tasks.filter(task => {
    // First apply search filter
    const matchesSearch = searchQuery === "" || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    // Apply status filter
    if (currentStatus !== "all" && task.status !== currentStatus) return false

    // Apply stage filters
    if (filters.stage.length > 0 && !filters.stage.includes(task.stage || '')) return false

    // Apply lead filters
    if (filters.leadId.length > 0 && !filters.leadId.includes(task.lead_id || '')) return false

    // Apply assignee filters
    if (filters.assigneeId.length > 0 && !filters.assigneeId.includes(task.assignee || '')) return false

    return true
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
    return filters.stage.length + filters.leadId.length + filters.assigneeId.length
  }

  if (isLoading) {
    return <ControlCenterSkeleton />
  }

  return (
    <div className="flex h-full relative overflow-hidden">
      {/* Sidebar */}
      <div className={cn(
        "fixed h-[calc(100vh-64px)] transition-all duration-300 ease-in-out bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-[9999]",
        isSidebarCollapsed ? "w-0 opacity-0" : "w-[319px]",
        !isSidebarCollapsed && (isLayoutCollapsed ? "left-[64px]" : "left-[256px]")
      )} style={{ top: "64px" }}>
        <TaskSidebar
          categories={categories}
          taskTypes={TASK_TYPES}
          selectedItem={selectedItem}
          onSelectItem={setSelectedItem}
          taskCountByCategory={taskCounts.byCategory}
          taskCountByType={taskCounts.byType}
          isCollapsed={isSidebarCollapsed}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* Main content */}
      <div className={cn(
        "flex flex-col h-full flex-1 transition-all duration-300 ease-in-out",
        isSidebarCollapsed 
          ? "pl-0"
          : isLayoutCollapsed 
            ? "pl-[319px]" 
            : "pl-[319px]"
      )}>
        {/* Header */}
        <div className="relative">
          <ControlCenterHeader
            isSidebarCollapsed={isSidebarCollapsed}
            toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            rightContent={
              <ViewSelector
                currentView={viewType}
                onViewChange={(view) => setViewType(view)}
              />
            }
            currentStatus={currentStatus}
            onStatusChange={setCurrentStatus}
            onFilterClick={() => setIsFilterModalOpen(true)}
            activeFilters={getTotalActiveFilters()}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-muted/30 transition-colors duration-300 ease-in-out pt-[71px]">
          <div className="p-8 h-full">
            {filteredTasks.length === 0 ? (
              <div className="h-[calc(100%-2rem)] flex items-center justify-center">
                <EmptyCard 
                  icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
                  title="No tasks found"
                  description={searchQuery ? "Try adjusting your search or filters to find what you're looking for." : "There are no tasks to display at this time."}
                  showShadow={false}
                  contentClassName="py-12"
                  className="max-w-md"
                />
              </div>
            ) : viewType === "kanban" ? (
              <TaskKanban
                tasks={filteredTasks}
                onUpdateTaskStatus={handleUpdateTaskStatus}
                onTaskClick={handleTaskClick}
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
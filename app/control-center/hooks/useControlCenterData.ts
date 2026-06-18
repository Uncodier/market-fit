import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { createClient } from '@/utils/supabase/client'
import { Category, Task } from '@/app/types'
import { getUserData } from '@/app/services/user-service'

export interface ExtendedTask extends Task {
  leadName?: string
  assigneeName?: string
  comments_count?: number
}

export interface TaskCounts {
  byCategory: Record<string, number>
  byType: Record<string, number>
}

export interface KanbanPaginationState {
  page: number
  hasMore: boolean
  isLoading: boolean
}

export interface TasksBundle {
  tasks: ExtendedTask[]
  totalCounts: Record<string, number>
  taskTypes: string[]
  kanbanPagination: Record<string, KanbanPaginationState>
}

const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'failed', 'canceled'] as const

async function enrichTasks(rawTasks: any[]): Promise<ExtendedTask[]> {
  return Promise.all(
    rawTasks.map(async (task) => {
      let assigneeName = undefined
      if (task.assignee) {
        const userData = await getUserData(task.assignee)
        assigneeName = userData?.name
      }

      return {
        ...task,
        leadName: task.leads?.name,
        assigneeName,
        comments_count: task.comments_count?.[0]?.count || 0,
      }
    })
  )
}

async function fetchTasksBundle(siteId: string): Promise<TasksBundle> {
  const supabase = createClient()
  const allTasks: any[] = []
  const counts: Record<string, number> = {}

  for (const status of TASK_STATUSES) {
    const { count, error: countError } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', status)

    if (countError) throw countError
    counts[status] = count || 0

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
      .eq('site_id', siteId)
      .eq('status', status)
      .order('priority', { ascending: false })
      .order('scheduled_date', { ascending: true })
      .limit(50)

    if (error) throw error
    if (statusTasks) allTasks.push(...statusTasks)
  }

  const enrichedTasks = await enrichTasks(allTasks)
  const uniqueTypes = Array.from(
    new Set(enrichedTasks.map((task) => task.type).filter((type): type is string => Boolean(type && type.trim() !== '')))
  ).sort()

  const kanbanPagination = TASK_STATUSES.reduce((acc, status) => {
    acc[status] = {
      page: 1,
      hasMore: (counts[status] || 0) > 50,
      isLoading: false,
    }
    return acc
  }, {} as Record<string, KanbanPaginationState>)

  return {
    tasks: enrichedTasks,
    totalCounts: counts,
    taskTypes: uniqueTypes,
    kanbanPagination,
  }
}

async function fetchCategories(siteId: string): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('site_id', siteId)
    .eq('is_active', true)

  if (error) throw error
  return data || []
}

async function fetchLeads(siteId: string): Promise<Array<{ id: string; name: string }>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('leads')
    .select('id, name')
    .eq('site_id', siteId)
    .order('name')

  if (error) throw error
  return data || []
}

async function fetchUsers(siteId: string, ownerId?: string): Promise<Array<{ id: string; name: string }>> {
  const supabase = createClient()
  const allUsers: Array<{ id: string; name: string }> = []

  if (ownerId) {
    const { data: ownerData, error: ownerError } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('id', ownerId)
      .single()

    if (!ownerError && ownerData) {
      allUsers.push(ownerData)
    }
  }

  const { data: siteMembers, error: siteMembersError } = await supabase
    .from('site_members')
    .select('user_id')
    .eq('site_id', siteId)
    .eq('status', 'active')
    .not('user_id', 'is', null)

  if (siteMembersError) throw siteMembersError

  if (siteMembers && siteMembers.length > 0) {
    const memberUserIds = siteMembers.map((m) => m.user_id)
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', memberUserIds)

    if (profilesError) throw profilesError
    if (profilesData) allUsers.push(...profilesData)
  }

  return allUsers
    .filter((user, index, self) => index === self.findIndex((u) => u.id === user.id))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function useControlCenterData(siteId?: string, ownerId?: string) {
  const tasksKey = siteId ? ['control-center-tasks', siteId] : null
  const categoriesKey = siteId ? ['control-center-categories', siteId] : null
  const leadsKey = siteId ? ['control-center-leads', siteId] : null
  const usersKey = siteId ? ['control-center-users', siteId, ownerId || ''] : null

  const {
    data: tasksBundle,
    isLoading: isTasksLoading,
    mutate: mutateTasks,
  } = useSWR(tasksKey, ([, id]) => fetchTasksBundle(id))

  const { data: categoriesData, mutate: mutateCategories } = useSWR(
    categoriesKey,
    ([, id]) => fetchCategories(id)
  )

  const { data: leadsData } = useSWR(leadsKey, ([, id]) => fetchLeads(id))

  const { data: usersData } = useSWR(usersKey, ([, id, owner]) => fetchUsers(id, owner || undefined))

  const categories = categoriesData || []
  const leads = leadsData || []
  const users = usersData || []
  const tasks = tasksBundle?.tasks || []
  const totalCounts = tasksBundle?.totalCounts || {
    pending: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    canceled: 0,
  }
  const taskTypes = tasksBundle?.taskTypes || []
  const initialKanbanPagination = tasksBundle?.kanbanPagination

  const isLoading = isTasksLoading && !tasksBundle

  const taskCounts = useMemo<TaskCounts>(() => {
    const byCategory: Record<string, number> = {}
    const byType: Record<string, number> = {}

    tasks.forEach((task) => {
      if (task.type) {
        byType[task.type] = (byType[task.type] || 0) + 1
      }
      if (task.category_id) {
        byCategory[task.category_id] = (byCategory[task.category_id] || 0) + 1
      }
    })

    return { byCategory, byType }
  }, [tasks])

  const refreshTasks = useCallback(async () => {
    await mutateTasks()
  }, [mutateTasks])

  const refreshCategories = useCallback(async () => {
    await mutateCategories()
  }, [mutateCategories])

  const updateTasksCache = useCallback(
    (updater: TasksBundle | ((prev: TasksBundle | undefined) => TasksBundle | undefined)) => {
      mutateTasks(updater, false)
    },
    [mutateTasks]
  )

  const fetchAllTasksForSite = useCallback(async (id: string): Promise<ExtendedTask[]> => {
    const supabase = createClient()
    const { data: tasksData, error } = await supabase
      .from('tasks')
      .select(`
        *,
        leads:lead_id (
          id,
          name
        ),
        comments_count:task_comments(count)
      `)
      .eq('site_id', id)
      .order('priority', { ascending: false })
      .order('scheduled_date', { ascending: true })

    if (error) throw error
    return enrichTasks(tasksData || [])
  }, [])

  const refreshCounts = useCallback(async (id: string) => {
    const supabase = createClient()
    const counts: Record<string, number> = {}

    for (const status of TASK_STATUSES) {
      const { count, error } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', id)
        .eq('status', status)

      if (error) throw error
      counts[status] = count || 0
    }

    return counts
  }, [])

  return {
    categories,
    leads,
    users,
    tasks,
    taskTypes,
    totalCounts,
    initialKanbanPagination,
    taskCounts,
    isLoading,
    refreshTasks,
    refreshCategories,
    updateTasksCache,
    fetchAllTasksForSite,
    refreshCounts,
    mutateTasks,
  }
}

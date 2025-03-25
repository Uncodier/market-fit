"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { Task, TaskFilters, JOURNEY_STAGES } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { useSite } from "@/app/context/SiteContext"
import { createTask as createTaskAction, getTasksByLeadId as getTasksByLeadIdAction, updateTask as updateTaskAction, deleteTask as deleteTaskAction } from '../tasks/actions'
import { toast } from "sonner"

// Initial values for filters
const initialFilters: TaskFilters = {
  status: [],
  type: [],
  stage: []
}

interface TasksContextType {
  tasks: Task[]
  loading: boolean
  error: string | null
  filters: TaskFilters
  updateFilters: (newFilters: TaskFilters) => void
  clearFilters: () => void
  createTask: (task: Omit<Task, 'id' | 'created_at'>) => Promise<Task>
  updateTask: (id: string, updates: Partial<Task>) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  getTasksByLeadId: (leadId: string) => Task[]
  getTasksGroupedByStage: (leadId: string) => {
    stage: string
    label: string
    tasks: Task[]
  }[]
}

const TasksContext = createContext<TasksContextType | undefined>(undefined)

interface TasksProviderProps {
  children: React.ReactNode
  leadId: string
}

export function TasksProvider({ children, leadId }: TasksProviderProps) {
  const { currentSite } = useSite()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TaskFilters>(initialFilters)
  const [isInitialized, setIsInitialized] = useState(false)

  // Function to load tasks for a lead
  const loadTasksForLead = async (leadId: string) => {
    if (!currentSite?.id) return

    setLoading(true)
    try {
      const result = await getTasksByLeadIdAction(leadId)
      
      if (result.error || !result.tasks) {
        const errorMessage = result.error || 'Failed to load tasks'
        setError(errorMessage)
        // Solo mostrar el toast si no es un error de inicialización y la app ya está inicializada
        if (!errorMessage.includes('Not authenticated') && isInitialized) {
          toast.error(errorMessage)
        }
        setTasks([])
        return
      }
      
      setTasks(result.tasks as Task[])
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tasks'
      setError(errorMessage)
      // Solo mostrar el toast si no es un error de inicialización y la app ya está inicializada
      if (!errorMessage.includes('Not authenticated') && isInitialized) {
        toast.error(errorMessage)
      }
      setTasks([])
      console.error(errorMessage, err)
    } finally {
      setLoading(false)
    }
  }

  // Function to update filters
  const updateFilters = (newFilters: TaskFilters) => {
    setFilters(newFilters)
  }

  // Function to clear all filters
  const clearFilters = () => {
    setFilters(initialFilters)
  }

  // Function to create a new task
  const createTask = async (taskData: Omit<Task, 'id' | 'created_at'>) => {
    setLoading(true)
    try {
      if (!currentSite?.id) {
        throw new Error('No site selected')
      }
      
      const result = await createTaskAction({
        ...taskData,
        site_id: currentSite.id
      })
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      if (!result.task) {
        throw new Error('Failed to create task: No task data returned')
      }
      
      // Actualizar el estado local inmediatamente
      setTasks(prevTasks => [...prevTasks, result.task as Task])
      
      // Recargar las tareas del servidor para asegurar sincronización
      await loadTasksForLead(taskData.lead_id)
      
      toast.success("Task created successfully")
      setLoading(false)
      return result.task as Task
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create task. Please try again.'
      setError(errorMessage)
      toast.error(errorMessage)
      setLoading(false)
      throw err
    }
  }

  // Function to update a task
  const updateTask = async (id: string, updates: Partial<Task>) => {
    setLoading(true)
    try {
      const result = await updateTaskAction(id, updates)
      
      if (result.error || !result.task) {
        throw new Error(result.error || 'Failed to update task')
      }
      
      const updatedTask = result.task as Task
      
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === id ? updatedTask : task
        )
      )
      
      setLoading(false)
      return updatedTask
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update task'
      setError(errorMessage)
      toast.error(errorMessage)
      setLoading(false)
      throw err
    }
  }

  // Function to delete a task
  const deleteTask = async (id: string) => {
    setLoading(true)
    try {
      const result = await deleteTaskAction(id)
      
      if (result.error) {
        throw new Error(result.error || 'Failed to delete task')
      }
      
      setTasks(prevTasks => prevTasks.filter(task => task.id !== id))
      toast.success("Task deleted successfully")
      setLoading(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete task'
      setError(errorMessage)
      toast.error(errorMessage)
      setLoading(false)
      throw err
    }
  }

  // Function to get tasks by lead ID
  const getTasksByLeadId = (leadId: string) => {
    return tasks.filter(task => task.lead_id === leadId)
  }

  // Function to get tasks grouped by stage (for journey view)
  const getTasksGroupedByStage = (leadId: string) => {
    const leadTasks = getTasksByLeadId(leadId)
    
    return JOURNEY_STAGES.map(stage => {
      return {
        stage: stage.id,
        label: stage.label,
        tasks: leadTasks.filter(task => task.stage === stage.id)
      }
    })
  }

  // Load tasks when leadId or currentSite changes
  useEffect(() => {
    if (leadId && currentSite?.id) {
      loadTasksForLead(leadId)
    }
  }, [leadId, currentSite?.id])

  // Marcar la app como inicializada después de un tiempo
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <TasksContext.Provider value={{
      tasks,
      loading,
      error,
      filters,
      updateFilters,
      clearFilters,
      createTask,
      updateTask,
      deleteTask,
      getTasksByLeadId,
      getTasksGroupedByStage
    }}>
      {children}
    </TasksContext.Provider>
  )
}

export function useTasks() {
  const context = useContext(TasksContext)
  if (context === undefined) {
    throw new Error('useTasks must be used within a TasksProvider')
  }
  return context
} 
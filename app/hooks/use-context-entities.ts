import { useState, useEffect } from 'react'
import { useSite } from '@/app/context/SiteContext'
import { 
  ContextEntitiesService,
  ContextLead,
  ContextContent,
  ContextRequirement,
  ContextTask
} from '@/app/services/context-entities.service'

interface UseContextEntitiesReturn {
  leads: ContextLead[]
  contents: ContextContent[]
  requirements: ContextRequirement[]
  tasks: ContextTask[]
  loading: {
    leads: boolean
    contents: boolean
    requirements: boolean
    tasks: boolean
  }
  errors: {
    leads: string | null
    contents: string | null
    requirements: string | null
    tasks: string | null
  }
  refreshLeads: () => Promise<void>
  refreshContents: () => Promise<void>
  refreshRequirements: () => Promise<void>
  refreshTasks: () => Promise<void>
}

export function useContextEntities(): UseContextEntitiesReturn {
  const { currentSite } = useSite()
  const [service] = useState(() => new ContextEntitiesService())

  // Data states
  const [leads, setLeads] = useState<ContextLead[]>([])
  const [contents, setContents] = useState<ContextContent[]>([])
  const [requirements, setRequirements] = useState<ContextRequirement[]>([])
  const [tasks, setTasks] = useState<ContextTask[]>([])

  // Loading states
  const [loading, setLoading] = useState({
    leads: false,
    contents: false,
    requirements: false,
    tasks: false
  })

  // Error states
  const [errors, setErrors] = useState({
    leads: null as string | null,
    contents: null as string | null,
    requirements: null as string | null,
    tasks: null as string | null
  })

  // Individual fetch functions
  const refreshLeads = async () => {
    if (!currentSite?.id || leads.length > 0) return

    setLoading(prev => ({ ...prev, leads: true }))
    setErrors(prev => ({ ...prev, leads: null }))

    try {
      const result = await service.getLeads(currentSite.id)
      if (result.error) {
        setErrors(prev => ({ ...prev, leads: result.error }))
      } else {
        setLeads(result.data)
      }
    } catch (error) {
      console.error('Error in refreshLeads:', error)
      setErrors(prev => ({ 
        ...prev, 
        leads: error instanceof Error ? error.message : 'Failed to fetch leads' 
      }))
    } finally {
      setLoading(prev => ({ ...prev, leads: false }))
    }
  }

  const refreshContents = async () => {
    if (!currentSite?.id || contents.length > 0) return

    setLoading(prev => ({ ...prev, contents: true }))
    setErrors(prev => ({ ...prev, contents: null }))

    try {
      const result = await service.getContent(currentSite.id)
      if (result.error) {
        setErrors(prev => ({ ...prev, contents: result.error }))
      } else {
        setContents(result.data)
      }
    } catch (error) {
      console.error('Error in refreshContents:', error)
      setErrors(prev => ({ 
        ...prev, 
        contents: error instanceof Error ? error.message : 'Failed to fetch content' 
      }))
    } finally {
      setLoading(prev => ({ ...prev, contents: false }))
    }
  }

  const refreshRequirements = async () => {
    if (!currentSite?.id || requirements.length > 0) return

    setLoading(prev => ({ ...prev, requirements: true }))
    setErrors(prev => ({ ...prev, requirements: null }))

    try {
      const result = await service.getRequirements(currentSite.id)
      if (result.error) {
        setErrors(prev => ({ ...prev, requirements: result.error }))
      } else {
        setRequirements(result.data)
      }
    } catch (error) {
      console.error('Error in refreshRequirements:', error)
      setErrors(prev => ({ 
        ...prev, 
        requirements: error instanceof Error ? error.message : 'Failed to fetch requirements' 
      }))
    } finally {
      setLoading(prev => ({ ...prev, requirements: false }))
    }
  }

  const refreshTasks = async () => {
    if (!currentSite?.id || tasks.length > 0) return

    setLoading(prev => ({ ...prev, tasks: true }))
    setErrors(prev => ({ ...prev, tasks: null }))

    try {
      const result = await service.getTasks(currentSite.id)
      if (result.error) {
        setErrors(prev => ({ ...prev, tasks: result.error }))
      } else {
        setTasks(result.data)
      }
    } catch (error) {
      console.error('Error in refreshTasks:', error)
      setErrors(prev => ({ 
        ...prev, 
        tasks: error instanceof Error ? error.message : 'Failed to fetch tasks' 
      }))
    } finally {
      setLoading(prev => ({ ...prev, tasks: false }))
    }
  }

  // Clear data when site changes
  useEffect(() => {
    setLeads([])
    setContents([])
    setRequirements([])
    setTasks([])
    setErrors({
      leads: null,
      contents: null,
      requirements: null,
      tasks: null
    })
  }, [currentSite?.id])

  return {
    leads,
    contents,
    requirements,
    tasks,
    loading,
    errors,
    refreshLeads,
    refreshContents,
    refreshRequirements,
    refreshTasks
  }
}

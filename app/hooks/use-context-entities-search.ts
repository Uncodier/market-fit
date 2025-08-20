import { useState, useCallback } from 'react'
import { useSite } from '@/app/context/SiteContext'
import { createClient } from "@/lib/supabase/client"
import { getLeads } from '@/app/leads/actions'
import { getContent } from '@/app/content/actions'
import {
  ContextLead,
  ContextContent,
  ContextRequirement,
  ContextTask,
  ContextCampaign
} from '@/app/services/context-entities.service'

// Auxiliary functions for requirements and tasks
async function getRequirementsForSite(siteId: string, limit: number = 20): Promise<ContextRequirement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('requirements')
    .select('id, title, description, status, priority, completion_status, created_at')
    .eq('site_id', siteId)
    .neq('completion_status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error && error.code === 'PGRST116') {
    return []
  }
  
  if (error) {
    throw error
  }

  return data?.map(req => ({
    id: req.id,
    title: req.title || '',
    description: req.description || '',
    status: req.status || '',
    priority: req.priority || '',
    completion_status: req.completion_status || '',
    created_at: req.created_at
  })) || []
}

async function getTasksForSite(siteId: string, limit: number = 20): Promise<ContextTask[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('id, serial_id, title, description, status, type, priority, created_at')
    .eq('site_id', siteId)
    .not('status', 'in', '(failed,canceled,completed)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error && error.code === 'PGRST116') {
    return []
  }
  
  if (error) {
    throw error
  }

  return data?.map(task => ({
    id: task.id,
    serial_id: task.serial_id || '',
    title: task.title || '',
    description: task.description || '',
    status: task.status || '',
    type: task.type || '',
    priority: task.priority || '',
    created_at: task.created_at
  })) || []
}

async function getCampaignsForSite(siteId: string, limit: number = 20): Promise<ContextCampaign[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, title, description, status, priority, type, created_at')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error && error.code === 'PGRST116') {
    return []
  }
  
  if (error) {
    throw error
  }

  return data?.map(campaign => ({
    id: campaign.id,
    title: campaign.title || '',
    description: campaign.description || '',
    status: campaign.status || '',
    priority: campaign.priority || '',
    type: campaign.type || '',
    created_at: campaign.created_at
  })) || []
}

interface SearchResults {
  leads: ContextLead[]
  contents: ContextContent[]
  requirements: ContextRequirement[]
  tasks: ContextTask[]
  campaigns: ContextCampaign[]
}

interface UseContextEntitiesSearchReturn {
  searchResults: SearchResults
  loading: boolean
  error: string | null
  searchAll: (query: string) => Promise<void>
  clearSearch: () => void
  loadInitialData: () => Promise<void>
}

export function useContextEntitiesSearch(): UseContextEntitiesSearchReturn {
  const { currentSite } = useSite()
  const supabase = createClient()
  
  const [searchResults, setSearchResults] = useState<SearchResults>({
    leads: [],
    contents: [],
    requirements: [],
    tasks: [],
    campaigns: []
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)

  const loadInitialData = useCallback(async () => {
    if (!currentSite?.id) {
      console.warn('LoadInitialData called without currentSite')
      return
    }

    console.log('Loading initial data for site:', currentSite.id)
    setLoading(true)
    setError(null)

    try {
      // Load recent data from all entities (no search filter)
      // Using safe queries that handle 404 errors gracefully
      const [leadsResult, contentResult, requirementsResult, tasksResult, campaignsResult] = await Promise.allSettled([
        // Use leads service (client-side compatible)
        getLeads(currentSite.id),
        // Use direct query for content (since getContent is server-only)
        supabase
          .from('content')
          .select('id, title, description, type, status, created_at')
          .eq('site_id', currentSite.id)
          .neq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(20)
          .then(result => {
            if (result.error && result.error.code === 'PGRST116') {
              return { data: [], error: null }
            }
            return result
          }),
        // Use auxiliary functions for requirements and tasks
        getRequirementsForSite(currentSite.id, 20),
        getTasksForSite(currentSite.id, 20),
        // Use auxiliary function for campaigns
        getCampaignsForSite(currentSite.id, 20)
      ])

      // Process results same as search
      const results: SearchResults = {
        leads: [],
        contents: [],
        requirements: [],
        tasks: [],
        campaigns: []
      }

      // Process leads response
      if (leadsResult.status === 'fulfilled' && leadsResult.value.leads) {
        // Convert Lead[] to ContextLead[] by picking needed fields
        results.leads = leadsResult.value.leads.slice(0, 20).map(lead => ({
          id: lead.id,
          name: lead.name || '',
          email: lead.email || '',
          company: lead.company?.name || lead.companies?.name || '',
          position: lead.position || '',
          status: lead.status || '',
          created_at: lead.created_at
        }))
      }

      // Process content response (direct query)
      if (contentResult.status === 'fulfilled' && contentResult.value.data) {
        // Convert from direct Supabase response to ContextContent[] by picking needed fields
        results.contents = contentResult.value.data.slice(0, 20).map(content => ({
          id: content.id,
          title: content.title || '',
          description: content.description || '',
          type: content.type || '',
          status: content.status || '',
          created_at: content.created_at
        }))
      }

      // Process requirements
      if (requirementsResult.status === 'fulfilled') {
        results.requirements = requirementsResult.value
      }

      // Process tasks
      if (tasksResult.status === 'fulfilled') {
        results.tasks = tasksResult.value
      }

      // Process campaigns
      if (campaignsResult.status === 'fulfilled') {
        results.campaigns = campaignsResult.value
      }

      setSearchResults(results)
      setHasInitialized(true)

      // Log initial data results for debugging
      console.log('Initial data loaded:', {
        leads: results.leads.length,
        contents: results.contents.length,
        requirements: results.requirements.length,
        tasks: results.tasks.length,
        campaigns: results.campaigns.length
      })

    } catch (error) {
      console.error('Error loading initial data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [currentSite?.id])

  const searchAll = useCallback(async (query: string) => {
    if (!currentSite?.id) {
      console.warn('SearchAll called without currentSite')
      return
    }

    // If empty query, load initial data
    if (!query.trim()) {
      console.log('Empty query, loading initial data')
      return loadInitialData()
    }

    console.log('Searching for:', query, 'in site:', currentSite.id)
    setLoading(true)
    setError(null)

    try {
      // Search in parallel across all entities with improved search
      // Using safe queries that handle 404 errors gracefully
      const [leadsResult, contentResult, requirementsResult, tasksResult, campaignsResult] = await Promise.allSettled([
        // Search leads using client-side filtering since getLeads doesn't support search
        getLeads(currentSite.id),

        // Search content with direct query
        supabase
          .from('content')
          .select('id, title, description, type, status, created_at')
          .eq('site_id', currentSite.id)
          .neq('status', 'published')
          .or(`title.ilike.%${query}%,description.ilike.%${query}%,type.ilike.%${query}%`)
          .order('created_at', { ascending: false })
          .limit(50)
          .then(result => {
            if (result.error && result.error.code === 'PGRST116') {
              return { data: [], error: null }
            }
            return result
          }),

        // Search requirements using auxiliary function (client-side filtering)
        getRequirementsForSite(currentSite.id, 50),

        // Search tasks using auxiliary function (client-side filtering)
        getTasksForSite(currentSite.id, 50),

        // Search campaigns using auxiliary function (client-side filtering)
        getCampaignsForSite(currentSite.id, 50)
      ])

      // Process results
      const results: SearchResults = {
        leads: [],
        contents: [],
        requirements: [],
        tasks: [],
        campaigns: []
      }

      // Process leads response with client-side filtering
      if (leadsResult.status === 'fulfilled' && leadsResult.value.leads) {
        const searchLower = query.toLowerCase()
        // Filter leads client-side by search query
        const filteredLeads = leadsResult.value.leads.filter(lead => {
          return (lead.name && typeof lead.name === 'string' && lead.name.toLowerCase().includes(searchLower)) ||
                 (lead.email && typeof lead.email === 'string' && lead.email.toLowerCase().includes(searchLower)) ||
                 (lead.position && typeof lead.position === 'string' && lead.position.toLowerCase().includes(searchLower)) ||
                 (lead.status && typeof lead.status === 'string' && lead.status.toLowerCase().includes(searchLower)) ||
                 (lead.company?.name && typeof lead.company.name === 'string' && lead.company.name.toLowerCase().includes(searchLower)) ||
                 (lead.companies?.name && typeof lead.companies.name === 'string' && lead.companies.name.toLowerCase().includes(searchLower))
        })
        
        // Convert to ContextLead[] format
        results.leads = filteredLeads.slice(0, 50).map(lead => ({
          id: lead.id,
          name: lead.name || '',
          email: lead.email || '',
          company: lead.company?.name || lead.companies?.name || '',
          position: lead.position || '',
          status: lead.status || '',
          created_at: lead.created_at
        }))
      }

      // Process content response (direct query already filtered)
      if (contentResult.status === 'fulfilled' && contentResult.value.data) {
        results.contents = contentResult.value.data.map(content => ({
          id: content.id,
          title: content.title || '',
          description: content.description || '',
          type: content.type || '',
          status: content.status || '',
          created_at: content.created_at
        }))
      }

      // Process requirements with client-side filtering
      if (requirementsResult.status === 'fulfilled') {
        const searchLower = query.toLowerCase()
        const filteredRequirements = requirementsResult.value.filter(req => {
          return (req.title && typeof req.title === 'string' && req.title.toLowerCase().includes(searchLower)) ||
                 (req.description && typeof req.description === 'string' && req.description.toLowerCase().includes(searchLower)) ||
                 (req.status && typeof req.status === 'string' && req.status.toLowerCase().includes(searchLower)) ||
                 (req.priority && typeof req.priority === 'string' && req.priority.toLowerCase().includes(searchLower))
        })
        results.requirements = filteredRequirements.slice(0, 50)
      }

      // Process tasks with client-side filtering
      if (tasksResult.status === 'fulfilled') {
        const searchLower = query.toLowerCase()
        const filteredTasks = tasksResult.value.filter(task => {
          return (task.title && typeof task.title === 'string' && task.title.toLowerCase().includes(searchLower)) ||
                 (task.description && typeof task.description === 'string' && task.description.toLowerCase().includes(searchLower)) ||
                 (task.status && typeof task.status === 'string' && task.status.toLowerCase().includes(searchLower)) ||
                 (task.type && typeof task.type === 'string' && task.type.toLowerCase().includes(searchLower)) ||
                 (task.priority && typeof task.priority === 'string' && task.priority.toLowerCase().includes(searchLower)) ||
                 (task.serial_id && typeof task.serial_id === 'string' && task.serial_id.toLowerCase().includes(searchLower))
        })
        results.tasks = filteredTasks.slice(0, 50)
      }

      // Process campaigns with client-side filtering
      if (campaignsResult.status === 'fulfilled') {
        const searchLower = query.toLowerCase()
        const filteredCampaigns = campaignsResult.value.filter(campaign => {
          return (campaign.title && typeof campaign.title === 'string' && campaign.title.toLowerCase().includes(searchLower)) ||
                 (campaign.description && typeof campaign.description === 'string' && campaign.description.toLowerCase().includes(searchLower)) ||
                 (campaign.status && typeof campaign.status === 'string' && campaign.status.toLowerCase().includes(searchLower)) ||
                 (campaign.priority && typeof campaign.priority === 'string' && campaign.priority.toLowerCase().includes(searchLower)) ||
                 (campaign.type && typeof campaign.type === 'string' && campaign.type.toLowerCase().includes(searchLower))
        })
        results.campaigns = filteredCampaigns.slice(0, 50)
      }

      setSearchResults(results)

      // Log results for debugging
      console.log('Search results:', {
        leads: results.leads.length,
        contents: results.contents.length,
        requirements: results.requirements.length,
        tasks: results.tasks.length,
        campaigns: results.campaigns.length
      })

      // Check if all searches failed (excluding table not found errors)
      const availableResults = [leadsResult, contentResult, requirementsResult, tasksResult, campaignsResult]
        .filter(result => {
          if (result.status === 'rejected') {
            // Don't count table not found as a failure
            return !result.reason?.message?.includes('does not exist') && 
                   !result.reason?.code?.includes('PGRST116')
          }
          return true
        })
      
      const allAvailableFailed = availableResults.length > 0 && 
        availableResults.every(result => result.status === 'rejected')
      
      if (allAvailableFailed) {
        setError('Failed to search across available databases. Please try again.')
        console.error('All available search queries failed')
      } else if (availableResults.length === 0) {
        console.warn('No searchable tables found - all tables appear to be missing')
      }

    } catch (error) {
      console.error('Error in searchAll:', error)
      setError(error instanceof Error ? error.message : 'Failed to search')
    } finally {
      setLoading(false)
    }
  }, [currentSite?.id, supabase])

  const clearSearch = useCallback(() => {
    setSearchResults({
      leads: [],
      contents: [],
      requirements: [],
      tasks: [],
      campaigns: []
    })
    setError(null)
    setHasInitialized(false)
  }, [])

  return {
    searchResults,
    loading,
    error,
    searchAll,
    clearSearch,
    loadInitialData
  }
}

export default useContextEntitiesSearch

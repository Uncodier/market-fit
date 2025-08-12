import { createClient } from "@/lib/supabase/client"

// Types for context entities
export interface ContextLead {
  id: string
  name: string
  email: string
  company: string | null
  position: string | null
  status: string
  created_at: string
}

export interface ContextContent {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  created_at: string
}

export interface ContextRequirement {
  id: string
  title: string
  description: string
  status: string
  priority: string
  completion_status: string
  created_at: string
}

export interface ContextTask {
  id: string
  serial_id: string
  title: string
  description: string
  status: "pending" | "in_progress" | "completed"
  type: string | null
  priority: number
  created_at: string
}

export interface ContextEntitiesResponse<T> {
  data: T[]
  error: string | null
}

/**
 * Service for fetching context entities using the same patterns as their respective pages
 */
export class ContextEntitiesService {
  private supabase = createClient()

  /**
   * Fetch leads using the same pattern as leads page
   */
  async getLeads(siteId: string): Promise<ContextEntitiesResponse<ContextLead>> {
    try {
      const { data, error } = await this.supabase
        .from('leads')
        .select('id, name, email, company, position, status, created_at')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error fetching context leads:', error)
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Failed to fetch leads' 
      }
    }
  }

  /**
   * Fetch content using the same pattern as content page
   */
  async getContent(siteId: string): Promise<ContextEntitiesResponse<ContextContent>> {
    try {
      const { data, error } = await this.supabase
        .from('content')
        .select('id, title, description, type, status, created_at')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error fetching context content:', error)
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Failed to fetch content' 
      }
    }
  }

  /**
   * Fetch requirements using the same pattern as requirements page
   */
  async getRequirements(siteId: string): Promise<ContextEntitiesResponse<ContextRequirement>> {
    try {
      const { data, error } = await this.supabase
        .from('requirements')
        .select('id, title, description, status, priority, completion_status, created_at')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error fetching context requirements:', error)
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Failed to fetch requirements' 
      }
    }
  }

  /**
   * Fetch tasks using the same pattern as control center page
   */
  async getTasks(siteId: string): Promise<ContextEntitiesResponse<ContextTask>> {
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .select('id, serial_id, title, description, status, type, priority, created_at')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error fetching context tasks:', error)
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Failed to fetch tasks' 
      }
    }
  }
}

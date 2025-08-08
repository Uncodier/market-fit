"use client"

import { createClient } from "@/lib/supabase/client"

export interface ContextData {
  leads: Array<{
    id: string
    name: string
    email: string
    phone: string | null
    company: {
      name?: string
      website?: string
      industry?: string
      size?: string
      description?: string
    } | null
    position: string | null
    status: "new" | "contacted" | "qualified" | "converted" | "lost"
    notes: string | null
    social_networks: {
      linkedin?: string | null
      twitter?: string | null
      facebook?: string | null
      instagram?: string | null
      whatsapp?: string | null
    } | null
    created_at: string
  }>
  contents: Array<{
    id: string
    title: string
    description: string | null
    type: "blog_post" | "video" | "podcast" | "social_post" | "newsletter" | "case_study" | "whitepaper" | "infographic" | "webinar" | "ebook" | "ad" | "landing_page"
    content: string | null
    text: string | null
    instructions: string | null
    status: string
    tags: string[] | null
    word_count: number | null
    estimated_reading_time: number | null
    created_at: string
  }>
  requirements: Array<{
    id: string
    title: string
    description: string
    type: "content" | "design" | "research" | "follow_up" | "task" | "develop" | "analytics" | "testing" | "approval" | "coordination" | "strategy" | "optimization" | "automation" | "integration" | "planning" | "payment"
    priority: "high" | "medium" | "low"
    status: string
    budget: number | null
    source: string
    created_at: string
  }>
  tasks: Array<{
    id: string
    serial_id: string
    title: string
    description: string | null
    status: "completed" | "in_progress" | "pending" | "failed"
    type: string
    priority: number
    scheduled_date: string
    completed_date?: string
    amount?: number
    assignee?: string
    notes?: string
    created_at: string
  }>
}

export interface SelectedContextIds {
  leads: string[]
  contents: string[]
  requirements: string[]
  tasks: string[]
}

export class ContextService {
  private supabase = createClient()

  async getContextData(selectedIds: SelectedContextIds, siteId: string): Promise<ContextData> {
    const results: ContextData = {
      leads: [],
      contents: [],
      requirements: [],
      tasks: []
    }

    try {
      // Fetch Leads
      if (selectedIds.leads.length > 0) {
        const { data: leadsData, error: leadsError } = await this.supabase
          .from('leads')
          .select(`
            id,
            name,
            email,
            phone,
            company,
            position,
            status,
            notes,
            social_networks,
            created_at
          `)
          .eq('site_id', siteId)
          .in('id', selectedIds.leads)

        if (leadsError) {
          console.error('Error fetching leads:', leadsError)
        } else {
          results.leads = leadsData || []
        }
      }

      // Fetch Contents
      if (selectedIds.contents.length > 0) {
        const { data: contentsData, error: contentsError } = await this.supabase
          .from('content')
          .select(`
            id,
            title,
            description,
            type,
            content,
            text,
            instructions,
            status,
            tags,
            word_count,
            estimated_reading_time,
            created_at
          `)
          .eq('site_id', siteId)
          .in('id', selectedIds.contents)

        if (contentsError) {
          console.error('Error fetching contents:', contentsError)
        } else {
          results.contents = contentsData || []
        }
      }

      // Fetch Requirements
      if (selectedIds.requirements.length > 0) {
        const { data: requirementsData, error: requirementsError } = await this.supabase
          .from('requirements')
          .select(`
            id,
            title,
            description,
            type,
            priority,
            status,
            budget,
            source,
            created_at
          `)
          .eq('site_id', siteId)
          .in('id', selectedIds.requirements)

        if (requirementsError) {
          console.error('Error fetching requirements:', requirementsError)
        } else {
          results.requirements = requirementsData || []
        }
      }

      // Fetch Tasks
      if (selectedIds.tasks.length > 0) {
        const { data: tasksData, error: tasksError } = await this.supabase
          .from('tasks')
          .select(`
            id,
            serial_id,
            title,
            description,
            status,
            type,
            priority,
            scheduled_date,
            completed_date,
            amount,
            assignee,
            notes,
            created_at
          `)
          .eq('site_id', siteId)
          .in('id', selectedIds.tasks)

        if (tasksError) {
          console.error('Error fetching tasks:', tasksError)
        } else {
          results.tasks = tasksData || []
        }
      }

    } catch (error) {
      console.error('Error in getContextData:', error)
      throw new Error('Failed to fetch context data')
    }

    return results
  }

  // Helper method to get summary of context for logging
  getContextSummary(contextData: ContextData): string {
    const summary = []
    
    if (contextData.leads.length > 0) {
      summary.push(`${contextData.leads.length} leads`)
    }
    if (contextData.contents.length > 0) {
      summary.push(`${contextData.contents.length} contents`)
    }
    if (contextData.requirements.length > 0) {
      summary.push(`${contextData.requirements.length} requirements`)
    }
    if (contextData.tasks.length > 0) {
      summary.push(`${contextData.tasks.length} tasks`)
    }

    return summary.length > 0 ? `Context: ${summary.join(', ')}` : 'No context selected'
  }

  // Validate that user has access to all requested items
  async validateAccess(selectedIds: SelectedContextIds, siteId: string, userId: string): Promise<boolean> {
    try {
      // Check if user has access to the site
      const { data: siteAccess, error: siteError } = await this.supabase
        .from('sites')
        .select('id')
        .eq('id', siteId)
        .eq('user_id', userId)
        .single()

      if (siteError || !siteAccess) {
        console.error('User does not have access to site:', siteId)
        return false
      }

      // Additional validation could be added here for specific items
      // For now, if user has site access, they can access all items in that site
      
      return true
    } catch (error) {
      console.error('Error validating access:', error)
      return false
    }
  }
}

// Export singleton instance
export const contextService = new ContextService()



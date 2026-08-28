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
  campaigns: Array<{
    id: string
    title: string
    description: string
    status: string
    priority: string
    type: string
    created_at: string
  }>
  quotations: Array<{
    id: string
    title: string
    status: string
    total: number
    currency: string
    created_at: string
  }>
  deals: Array<{
    id: string
    name: string
    stage: string
    amount: number | null
    currency: string
    created_at: string
  }>
  records: Array<{
    id: string
    title: string
    description: string | null
    status: string
    category?: { name: string } | null
    created_at: string
  }>
}

export interface SelectedContextIds {
  leads: string[]
  contents: string[]
  requirements: string[]
  tasks: string[]
  campaigns: string[]
  quotations: string[]
  deals: string[]
  records: string[]
}

export class ContextService {
  private supabase = createClient()

  async getContextData(selectedIds: SelectedContextIds, siteId: string): Promise<ContextData> {
    const results: ContextData = {
      leads: [],
      contents: [],
      requirements: [],
      tasks: [],
      campaigns: [],
      quotations: [],
      deals: [],
      records: []
    }

    try {
      // Fetch Leads
      if (selectedIds.leads?.length > 0) {
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
      if (selectedIds.contents?.length > 0) {
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
      if (selectedIds.requirements?.length > 0) {
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
      if (selectedIds.tasks?.length > 0) {
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

      // Fetch Campaigns
      if (selectedIds.campaigns?.length > 0) {
        const { data: campaignsData, error: campaignsError } = await this.supabase
          .from('campaigns')
          .select(`
            id,
            title,
            description,
            status,
            priority,
            type,
            created_at
          `)
          .eq('site_id', siteId)
          .in('id', selectedIds.campaigns)

        if (campaignsError) {
          console.error('Error fetching campaigns:', campaignsError)
        } else {
          results.campaigns = campaignsData || []
        }
      }

      // Fetch Quotations
      if (selectedIds.quotations?.length > 0) {
        const { data: quotesData, error: quotesError } = await this.supabase
          .from('quotations')
          .select(`
            id,
            title,
            status,
            total,
            currency,
            created_at
          `)
          .eq('site_id', siteId)
          .in('id', selectedIds.quotations)

        if (quotesError) {
          console.error('Error fetching quotations:', quotesError)
        } else {
          results.quotations = quotesData || []
        }
      }

      // Fetch Deals
      if (selectedIds.deals?.length > 0) {
        const { data: dealsData, error: dealsError } = await this.supabase
          .from('deals')
          .select(`
            id,
            name,
            stage,
            amount,
            currency,
            created_at
          `)
          .eq('site_id', siteId)
          .in('id', selectedIds.deals)

        if (dealsError) {
          console.error('Error fetching deals:', dealsError)
        } else {
          results.deals = dealsData || []
        }
      }

      // Fetch Records
      if (selectedIds.records?.length > 0) {
        const { data: recordsData, error: recordsError } = await this.supabase
          .from('records')
          .select(`
            id,
            title,
            description,
            status,
            created_at,
            category:record_categories(name)
          `)
          .eq('site_id', siteId)
          .in('id', selectedIds.records)

        if (recordsError) {
          console.error('Error fetching records:', recordsError)
        } else {
          results.records = (recordsData || []).map((r: any) => ({
            ...r,
            category: r.category && !Array.isArray(r.category) ? { name: r.category.name } : null
          }))
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
    if (contextData.campaigns?.length > 0) {
      summary.push(`${contextData.campaigns.length} campaigns`)
    }
    if (contextData.quotations?.length > 0) {
      summary.push(`${contextData.quotations.length} quotations`)
    }
    if (contextData.deals?.length > 0) {
      summary.push(`${contextData.deals.length} deals`)
    }
    if (contextData.records?.length > 0) {
      summary.push(`${contextData.records.length} records`)
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



import { createClient } from "@/lib/supabase/client"
import { type CreateTaskFormValues, type Task } from "./types"

export async function createTask(values: CreateTaskFormValues): Promise<{ data?: Task; error?: string }> {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: "User not authenticated" }
    }

    // Clean the data - convert undefined to null for database
    const cleanedValues = {
      ...values,
      lead_id: values.lead_id || null,
      deal_id: values.deal_id || null,
      assignee: values.assignee || null,
      type: values.type || null,
      stage: values.stage || null,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert([cleanedValues])
      .select()
      .single()

    if (error) {
      console.error("Error creating task:", error)
      return { error: error.message }
    }

    return { data }
  } catch (error) {
    console.error("Error in createTask:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}

export async function getTasksByDealId(dealId: string) {
  try {
    const supabase = createClient()
    
    // First, get all lead IDs associated with this deal
    const { data: dealLeads } = await supabase
      .from('deal_leads')
      .select('lead_id')
      .eq('deal_id', dealId)
      
    const leadIds = (dealLeads || []).map(dl => dl.lead_id)
    
    // Now fetch tasks that are either linked to the deal_id (if it exists) OR linked to any of the leads
    let query = supabase.from('tasks').select('*')
    
    // We try to use deal_id if it exists, but we can't reliably know without catching the error.
    // However, if we know leadIds, we can definitely fetch by lead_id.
    let tasks: any[] = []
    
    // 1. Try fetching by deal_id
      const { data: dealTasks, error: dealError } = await supabase
      .from('tasks')
      .select('*')
      .eq('deal_id', dealId)
      .order('scheduled_date', { ascending: true })
      
    if (!dealError && dealTasks) {
      tasks = [...dealTasks]
    }
    
    // 2. Try fetching by lead_id if we have any
    if (leadIds.length > 0) {
      const { data: leadTasks, error: leadError } = await supabase
        .from('tasks')
        .select('*')
        .in('lead_id', leadIds)
        .order('scheduled_date', { ascending: true })
        
      if (!leadError && leadTasks) {
        // Add tasks that aren't already in the list
        const existingIds = new Set(tasks.map(t => t.id))
        const newTasks = leadTasks.filter(t => !existingIds.has(t.id))
        tasks = [...tasks, ...newTasks]
      }
    }

    // Sort combined tasks by scheduled_date asc, handling potential nulls
    tasks.sort((a, b) => {
      if (!a.scheduled_date) return 1;
      if (!b.scheduled_date) return -1;
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    })

    return { data: tasks }
  } catch (error) {
    console.error("Error fetching tasks by deal:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}
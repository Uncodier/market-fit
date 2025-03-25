"use server"

import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"

// Define the task schema for validation
const TaskSchema = z.object({
  id: z.string().uuid().optional(),
  lead_id: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  type: z.enum([
    "website_visit", 
    "demo", 
    "meeting", 
    "email", 
    "call", 
    "quote", 
    "contract", 
    "payment", 
    "referral", 
    "feedback"
  ]),
  stage: z.enum([
    "awareness", 
    "consideration", 
    "decision", 
    "purchase", 
    "retention", 
    "referral"
  ]),
  status: z.enum([
    "completed", 
    "in_progress", 
    "pending", 
    "failed"
  ]),
  scheduled_date: z.string(),
  completed_date: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  assignee: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  site_id: z.string().uuid(),
})

// Input type for creating a task
export type CreateTaskInput = z.infer<typeof TaskSchema>

// Response type for task operations
export interface TaskResponse {
  task?: {
    id: string
    lead_id: string
    title: string
    description: string | null
    type: "website_visit" | "demo" | "meeting" | "email" | "call" | "quote" | "contract" | "payment" | "referral" | "feedback"
    stage: "awareness" | "consideration" | "decision" | "purchase" | "retention" | "referral"
    status: "completed" | "in_progress" | "pending" | "failed"
    scheduled_date: string
    completed_date: string | null
    amount: number | null
    assignee: string | null
    notes: string | null
    site_id: string
    user_id: string
    created_at: string
    updated_at: string
  } | null
  error?: string
}

// Response type for getting multiple tasks
export interface TasksResponse {
  tasks: Array<{
    id: string
    lead_id: string
    title: string
    description: string | null
    type: "website_visit" | "demo" | "meeting" | "email" | "call" | "quote" | "contract" | "payment" | "referral" | "feedback"
    stage: "awareness" | "consideration" | "decision" | "purchase" | "retention" | "referral"
    status: "completed" | "in_progress" | "pending" | "failed"
    scheduled_date: string
    completed_date: string | null
    amount: number | null
    assignee: string | null
    notes: string | null
    site_id: string
    user_id: string
    created_at: string
    updated_at: string
  }> | null
  error?: string
}

/**
 * Create a new task
 */
export async function createTask(data: CreateTaskInput): Promise<TaskResponse> {
  try {
    // Validate input data
    const validatedData = TaskSchema.parse(data)
    
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: "Not authenticated", task: null }
    }
    
    // Create task
    const { data: task, error } = await supabase
      .from("tasks")
      .insert([
        {
          ...validatedData,
          user_id: user.id,
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single()
    
    if (error) {
      console.error("Error creating task:", error)
      if (error.code === '23503') {
        return { error: "Lead or site not found", task: null }
      }
      if (error.code === '23514') {
        return { error: "Invalid task data", task: null }
      }
      return { error: `Error creating task: ${error.message}`, task: null }
    }
    
    if (!task) {
      return { error: "Failed to create task: No data returned", task: null }
    }
    
    // Revalidate the lead page path
    revalidatePath(`/leads/${data.lead_id}`)
    
    return { task }
  } catch (error) {
    console.error("Error in createTask:", error)
    if (error instanceof z.ZodError) {
      return { error: "Invalid task data: " + error.errors.map(e => e.message).join(", "), task: null }
    }
    return { error: "Error creating task: " + (error instanceof Error ? error.message : "Unknown error"), task: null }
  }
}

/**
 * Get a task by ID
 */
export async function getTaskById(id: string): Promise<TaskResponse> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single()
    
    if (error) {
      if (error.code === "PGRST116") {
        return { error: "Task not found", task: null }
      }
      throw error
    }
    
    return { task: data }
  } catch (error) {
    console.error("Error getting task:", error)
    return { error: "Error loading task", task: null }
  }
}

/**
 * Get tasks by lead ID
 */
export async function getTasksByLeadId(leadId: string): Promise<TasksResponse> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("lead_id", leadId)
      .order("scheduled_date", { ascending: true })
    
    if (error) {
      throw error
    }
    
    return { tasks: data || [] }
  } catch (error) {
    console.error("Error getting tasks:", error)
    return { error: "Error loading tasks", tasks: [] }
  }
}

/**
 * Update a task
 */
export async function updateTask(id: string, data: Partial<CreateTaskInput>): Promise<TaskResponse> {
  try {
    const supabase = await createClient()
    
    // Get current user for logging
    const { data: { user } } = await supabase.auth.getUser()
    
    // Get current task to get lead_id for path revalidation
    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("lead_id")
      .eq("id", id)
      .single()
    
    if (fetchError) {
      return { error: "Task not found", task: null }
    }
    
    // Update task
    const { data: task, error } = await supabase
      .from("tasks")
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single()
    
    if (error) {
      console.error("Error updating task:", error)
      if (error.code === '23503') {
        return { error: "Referenced record not found", task: null }
      }
      if (error.code === '23514') {
        return { error: "Invalid task data", task: null }
      }
      return { error: `Error updating task: ${error.message}`, task: null }
    }
    
    // Revalidate the lead page path
    if (currentTask?.lead_id) {
      revalidatePath(`/leads/${currentTask.lead_id}`)
    }
    
    return { task }
  } catch (error) {
    console.error("Error in updateTask:", error)
    if (error instanceof z.ZodError) {
      return { error: "Invalid task data", task: null }
    }
    return { error: "Error updating task", task: null }
  }
}

/**
 * Delete a task
 */
export async function deleteTask(id: string): Promise<{ success?: boolean, error?: string }> {
  try {
    const supabase = await createClient()
    
    // Get current task to get lead_id for path revalidation
    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("lead_id")
      .eq("id", id)
      .single()
    
    if (fetchError) {
      return { error: "Task not found" }
    }
    
    // Delete task
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
    
    if (error) {
      console.error("Error deleting task:", error)
      return { error: `Error deleting task: ${error.message}` }
    }
    
    // Revalidate the lead page path
    if (currentTask?.lead_id) {
      revalidatePath(`/leads/${currentTask.lead_id}`)
    }
    
    return { success: true }
  } catch (error) {
    console.error("Error in deleteTask:", error)
    return { error: "Error deleting task" }
  }
} 
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
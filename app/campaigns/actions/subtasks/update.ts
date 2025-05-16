"use server"

import { createClient } from "@/lib/supabase/server"
import { transformSubtaskData } from "../utils/transformers"

// Update subtask status
export async function updateSubtaskStatus(id: string, status: 'completed' | 'in-progress' | 'pending') {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("campaign_subtasks")
      .update({ status })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      throw new Error(`Error updating subtask: ${error.message}`)
    }

    return { data: transformSubtaskData(data), error: null }
  } catch (error) {
    console.error("Error in updateSubtaskStatus:", error)
    return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
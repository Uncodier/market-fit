"use server"

import { createClient } from "@/lib/supabase/server"
import { transformSubtaskData } from "../utils/transformers"

// Create subtask
export async function createSubtask(values: {
  campaignId: string;
  title: string;
  status?: 'completed' | 'in-progress' | 'pending';
}) {
  try {
    const supabase = await createClient()

    const subtaskData = {
      campaign_id: values.campaignId,
      title: values.title,
      status: values.status || "pending"
    }

    const { data, error } = await supabase
      .from("campaign_subtasks")
      .insert(subtaskData)
      .select()
      .single()

    if (error) {
      throw new Error(`Error creating subtask: ${error.message}`)
    }

    return { data: transformSubtaskData(data), error: null }
  } catch (error) {
    console.error("Error in createSubtask:", error)
    return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
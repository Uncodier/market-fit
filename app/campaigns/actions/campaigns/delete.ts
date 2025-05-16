"use server"

import { createClient } from "@/lib/supabase/server"

// Delete campaign
export async function deleteCampaign(id: string) {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id)

    if (error) {
      throw new Error(`Error deleting campaign: ${error.message}`)
    }

    return { success: true, error: null }
  } catch (error) {
    console.error("Error in deleteCampaign:", error)
    return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
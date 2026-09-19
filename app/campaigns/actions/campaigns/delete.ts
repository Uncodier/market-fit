"use server"

import { createClient } from "@/lib/supabase/server"
import { requestServerVoiceAgentResync } from "@/app/agents/server-voice-sync"

// Delete campaign
export async function deleteCampaign(id: string) {
  try {
    const supabase = await createClient()
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("site_id")
      .eq("id", id)
      .single()

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id)

    if (error) {
      throw new Error(`Error deleting campaign: ${error.message}`)
    }

    if (campaign?.site_id) {
      await requestServerVoiceAgentResync(campaign.site_id)
    }
    return { success: true, error: null }
  } catch (error) {
    console.error("Error in deleteCampaign:", error)
    return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
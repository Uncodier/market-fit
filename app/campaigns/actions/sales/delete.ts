"use server"

import { createClient } from "@/lib/supabase/server"
import { updateCampaignRevenue } from "./utils"

// Delete sale
export async function deleteSale(saleId: string) {
  try {
    const supabase = await createClient()

    // First get the sale to get its campaign ID
    const { data: existingSale, error: fetchError } = await supabase
      .from("sales")
      .select("campaign_id")
      .eq("id", saleId)
      .single()

    if (fetchError) {
      throw new Error(`Error fetching sale: ${fetchError.message}`)
    }

    // Delete the sale
    const { error } = await supabase
      .from("sales")
      .delete()
      .eq("id", saleId)

    if (error) {
      throw new Error(`Error deleting sale: ${error.message}`)
    }

    // Update campaign revenue after sale deletion
    await updateCampaignRevenue(existingSale.campaign_id)

    return { success: true, error: null }
  } catch (error) {
    console.error("Error in deleteSale:", error)
    return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
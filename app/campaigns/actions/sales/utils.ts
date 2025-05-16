"use server"

import { createClient } from "@/lib/supabase/server"

export async function updateCampaignRevenue(campaignId: string) {
  try {
    const supabase = await createClient()

    // Get all completed sales for this campaign
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "completed")

    if (salesError) {
      throw new Error(`Error fetching sales: ${salesError.message}`)
    }

    // Calculate total actual revenue
    const actualRevenue = sales.reduce((sum, sale) => {
      return sum + parseFloat(sale.amount.toString())
    }, 0)

    // Get current campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError) {
      throw new Error(`Error fetching campaign: ${campaignError.message}`)
    }

    // Create updated revenue object
    const updatedRevenue = {
      ...campaign.revenue,
      actual: actualRevenue
    }

    // Update campaign
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ revenue: updatedRevenue })
      .eq("id", campaignId)

    if (updateError) {
      throw new Error(`Error updating campaign revenue: ${updateError.message}`)
    }

    return { success: true, error: null }
  } catch (error) {
    console.error("Error in updateCampaignRevenue:", error)
    return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
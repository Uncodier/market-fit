"use server"

import { createClient } from "@/lib/supabase/server"
import { transformSaleData } from "@/app/campaigns/actions/utils/transformers"
import { sumCompletedSalesByLead } from "@/lib/leads/converted-lead-value"

// Get sales for a campaign
export async function getCampaignSales(campaignId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("sales")
      .select(`
        *,
        leads:lead_id (
          name
        )
      `)
      .eq("campaign_id", campaignId)
      .order("sale_date", { ascending: false })

    if (error) {
      throw new Error(`Error fetching sales: ${error.message}`)
    }

    // Transform data to include lead name
    const formattedData = data.map(sale => ({
      ...sale,
      lead_name: sale.leads?.name || null
    }))

    return { data: formattedData.map(transformSaleData), error: null }
  } catch (error) {
    console.error("Error in getCampaignSales:", error)
    return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
}

export async function getLeadSalesTotals(leadIds: string[], siteId: string) {
  if (leadIds.length === 0) return { data: {} as Record<string, number>, error: null }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("sales")
      .select("lead_id, amount, status")
      .eq("site_id", siteId)
      .in("lead_id", leadIds)

    if (error) {
      throw new Error(`Error fetching lead sales: ${error.message}`)
    }

    return { data: sumCompletedSalesByLead(data || []), error: null }
  } catch (error) {
    console.error("Error in getLeadSalesTotals:", error)
    return {
      data: {} as Record<string, number>,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
} 
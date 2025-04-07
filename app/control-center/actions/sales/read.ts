"use server"

import { createClient } from "@/lib/supabase/server"
import { type Sale, type SaleData } from "@/app/types"
import { transformSaleData } from "@/app/control-center/actions/utils/transformers"

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
"use server"

import { createClient } from "@/lib/supabase/server"
import { transformTransactionData } from "../utils/transformers"

// Get transactions for a campaign
export async function getCampaignTransactions(campaignId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("date", { ascending: false })

    if (error) {
      throw new Error(`Error fetching transactions: ${error.message}`)
    }

    return { data: data.map(transformTransactionData), error: null }
  } catch (error) {
    console.error("Error in getCampaignTransactions:", error)
    return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
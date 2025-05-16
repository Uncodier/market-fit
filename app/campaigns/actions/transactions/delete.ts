"use server"

import { createClient } from "@/lib/supabase/server"
import { updateCampaignCosts } from "./updateCampaignCosts"

// Delete transaction
export async function deleteTransaction(transactionId: string) {
  try {
    const supabase = await createClient()

    // First get the transaction to get its campaign ID
    const { data: existingTransaction, error: fetchError } = await supabase
      .from("transactions")
      .select("campaign_id")
      .eq("id", transactionId)
      .single()

    if (fetchError) {
      throw new Error(`Error fetching transaction: ${fetchError.message}`)
    }

    // Delete the transaction
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId)

    if (error) {
      throw new Error(`Error deleting transaction: ${error.message}`)
    }

    // Update campaign costs after transaction deletion
    await updateCampaignCosts(existingTransaction.campaign_id)

    return { success: true, error: null }
  } catch (error) {
    console.error("Error in deleteTransaction:", error)
    return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
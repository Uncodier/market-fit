"use server"

import { createClient } from "@/lib/supabase/server"

// Helper function to update campaign costs based on transactions
export async function updateCampaignCosts(campaignId: string) {
  try {
    const supabase = await createClient()

    // Get all transactions for this campaign
    const { data: transactions, error: transactionError } = await supabase
      .from("transactions")
      .select("*")
      .eq("campaign_id", campaignId)

    if (transactionError) {
      throw new Error(`Error fetching transactions: ${transactionError.message}`)
    }

    // Calculate total costs
    let fixedCosts = 0
    let variableCosts = 0

    transactions.forEach((transaction: any) => {
      if (transaction.type === 'fixed') {
        fixedCosts += parseFloat(transaction.amount.toString())
      } else if (transaction.type === 'variable') {
        variableCosts += parseFloat(transaction.amount.toString())
      }
    })

    const totalCosts = fixedCosts + variableCosts

    // Get current campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError) {
      throw new Error(`Error fetching campaign: ${campaignError.message}`)
    }

    // Update budget remaining
    const allocated = campaign.budget?.allocated || 0
    const remaining = allocated - totalCosts

    // Create updated budget object
    const updatedBudget = {
      ...campaign.budget,
      remaining
    }

    // Update campaign
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ budget: updatedBudget })
      .eq("id", campaignId)

    if (updateError) {
      throw new Error(`Error updating campaign budget: ${updateError.message}`)
    }

    return { success: true, error: null }
  } catch (error) {
    console.error("Error in updateCampaignCosts:", error)
    return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
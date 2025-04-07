"use server"

import { createClient } from "@/lib/supabase/server"
import { transformTransactionData } from "../utils/transformers"
import { updateCampaignCosts } from "./updateCampaignCosts"

// Update transaction
export async function updateTransaction(
  transactionId: string,
  values: {
    type?: 'fixed' | 'variable';
    amount?: number;
    description?: string;
    date?: string;
  }
) {
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

    // Update the transaction
    const { data, error } = await supabase
      .from("transactions")
      .update({
        type: values.type,
        amount: values.amount,
        description: values.description,
        date: values.date
      })
      .eq("id", transactionId)
      .select()
      .single()

    if (error) {
      throw new Error(`Error updating transaction: ${error.message}`)
    }

    // Update campaign costs after transaction update
    await updateCampaignCosts(existingTransaction.campaign_id)

    return { data: transformTransactionData(data), error: null }
  } catch (error) {
    console.error("Error in updateTransaction:", error)
    return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
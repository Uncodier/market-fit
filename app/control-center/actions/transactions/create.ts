"use server"

import { createClient } from "@/lib/supabase/server"
import { transformTransactionData } from "../utils/transformers"
import { updateCampaignCosts } from "./updateCampaignCosts"

// Create transaction
export async function createTransaction(values: {
  campaignId: string;
  type: 'fixed' | 'variable';
  amount: number;
  description?: string;
  category: string;
  date: string;
  currency?: string;
  siteId: string;
  userId: string;
}) {
  try {
    const supabase = await createClient()

    const transactionData = {
      campaign_id: values.campaignId,
      type: values.type,
      amount: values.amount,
      description: values.description || null,
      category: values.category,
      date: values.date,
      currency: values.currency || "USD",
      site_id: values.siteId,
      user_id: values.userId
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert(transactionData)
      .select()
      .single()

    if (error) {
      throw new Error(`Error creating transaction: ${error.message}`)
    }

    // After creating a transaction, update the campaign costs
    await updateCampaignCosts(values.campaignId)

    return { data: transformTransactionData(data), error: null }
  } catch (error) {
    console.error("Error in createTransaction:", error)
    return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
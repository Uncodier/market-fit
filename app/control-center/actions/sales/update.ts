"use server"

import { createClient } from "@/lib/supabase/server"
import { type Sale, type SaleData } from "@/app/types"
import { transformSaleData } from "@/app/control-center/actions/utils/transformers"
import { updateCampaignRevenue } from "./utils"

// Update sale
export async function updateSale(
  saleId: string,
  values: {
    title?: string;
    amount?: number;
    status?: 'pending' | 'completed' | 'cancelled' | 'refunded';
    productName?: string;
    saleDate?: string;
    paymentMethod?: string;
    source?: 'retail' | 'online';
  }
) {
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

    // Update the sale
    const { data, error } = await supabase
      .from("sales")
      .update({
        title: values.title,
        amount: values.amount,
        status: values.status,
        product_name: values.productName,
        sale_date: values.saleDate,
        payment_method: values.paymentMethod,
        source: values.source
      })
      .eq("id", saleId)
      .select()
      .single()

    if (error) {
      throw new Error(`Error updating sale: ${error.message}`)
    }

    // Update campaign revenue after sale update
    await updateCampaignRevenue(existingSale.campaign_id)

    return { data: transformSaleData(data), error: null }
  } catch (error) {
    console.error("Error in updateSale:", error)
    return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
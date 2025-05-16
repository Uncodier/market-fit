"use server"

import { createClient } from "@/lib/supabase/server"
import { type Sale, type SaleData } from "@/app/types"
import { transformSaleData } from "@/app/campaigns/actions/utils/transformers"
import { updateCampaignRevenue } from "./utils"

export async function createSale(values: {
  title: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  leadId?: string | null;
  campaignId: string;
  segmentId?: string | null;
  productName?: string;
  saleDate: string;
  paymentMethod?: string;
  source?: 'retail' | 'online';
  notes?: string;
  siteId: string;
  userId: string;
}) {
  try {
    const supabase = await createClient()

    const saleData = {
      title: values.title,
      amount: values.amount,
      status: values.status,
      lead_id: values.leadId || null,
      campaign_id: values.campaignId,
      segment_id: values.segmentId || null,
      product_name: values.productName || null,
      sale_date: values.saleDate,
      payment_method: values.paymentMethod || "other",
      source: values.source || "online",
      notes: values.notes || null,
      site_id: values.siteId,
      user_id: values.userId
    }

    const { data, error } = await supabase
      .from("sales")
      .insert(saleData)
      .select()
      .single()

    if (error) {
      throw new Error(`Error creating sale: ${error.message}`)
    }

    // After creating a sale, update the campaign revenue
    await updateCampaignRevenue(values.campaignId)

    return { data: transformSaleData(data), error: null }
  } catch (error) {
    console.error("Error in createSale:", error)
    return { data: null, error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
} 
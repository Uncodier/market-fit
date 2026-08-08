"use server"

import { createClient } from "@/lib/supabase/server"
import { updateCampaignCosts } from "@/app/campaigns/actions/transactions/updateCampaignCosts"

async function verifySiteMembership(supabase: any, userId: string, siteId: string) {
  const { data, error } = await supabase
    .from('sites')
    .select(`
      id,
      user_id,
      site_members (user_id, status)
    `)
    .eq('id', siteId)
    .single()
    
  if (error || !data) return false
  if (data.user_id === userId) return true
  
  const isMember = data.site_members?.some((m: any) => m.user_id === userId && m.status === 'active')
  return !!isMember
}

// List expenses (transactions)
export async function listExpenses(params: {
  siteId: string;
  page?: number;
  pageSize?: number;
  category?: string;
  campaignId?: string;
  locationId?: string;
}) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { error: "Not authenticated" }

    const isMember = await verifySiteMembership(supabase, session.user.id, params.siteId)
    if (!isMember) return { error: "Not authorized for this site" }

    let query = supabase
      .from("transactions")
      .select("*, campaign:campaigns(id, title)", { count: 'exact' })
      .eq("site_id", params.siteId)

    if (params.category && params.category !== 'all') {
      query = query.eq("category", params.category)
    }

    if (params.campaignId && params.campaignId !== 'all') {
      query = query.eq("campaign_id", params.campaignId)
    }

    if (params.locationId && params.locationId !== 'all') {
      query = query.eq("location_id", params.locationId)
    }

    const page = params.page || 1
    const pageSize = params.pageSize || 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.range(from, to).order("date", { ascending: false }).order("created_at", { ascending: false })

    const { data, count, error } = await query

    if (error) throw new Error(error.message)

    return { data: data || [], count: count || 0, error: null }
  } catch (error) {
    console.error("Error in listExpenses:", error)
    return { data: null, count: 0, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// Get expense by ID
export async function getExpenseById(siteId: string, id: string) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { error: "Not authenticated" }

    const isMember = await verifySiteMembership(supabase, session.user.id, siteId)
    if (!isMember) return { error: "Not authorized for this site" }

    const { data, error } = await supabase
      .from("transactions")
      .select(`
        *,
        campaign:campaigns(id, title),
        location:locations(id, name),
        lead:leads(id, name, email),
        catalogItem:catalog_items(id, name),
        catalogCategory:catalog_categories(id, name)
      `)
      .eq("id", id)
      .eq("site_id", siteId)
      .single()

    if (error) throw new Error(`Error fetching expense: ${error.message}`)

    return { expense: data, error: null }
  } catch (error) {
    console.error("Error in getExpenseById:", error)
    return { expense: null, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// Create expense
export async function createExpense(values: {
  siteId: string;
  type: 'fixed' | 'variable';
  amount: number;
  description?: string;
  category: string;
  date: string;
  currency?: string;
  campaignId?: string | null;
  locationId?: string | null;
  leadId?: string | null;
  catalogItemId?: string | null;
  catalogCategoryId?: string | null;
}) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { error: "Not authenticated" }

    const isMember = await verifySiteMembership(supabase, session.user.id, values.siteId)
    if (!isMember) return { error: "Not authorized for this site" }

    const transactionData = {
      site_id: values.siteId,
      user_id: session.user.id,
      campaign_id: values.campaignId || null,
      location_id: values.locationId || null,
      lead_id: values.leadId || null,
      catalog_item_id: values.catalogItemId || null,
      catalog_category_id: values.catalogCategoryId || null,
      type: values.type,
      amount: values.amount,
      description: values.description || null,
      category: values.category,
      date: values.date,
      currency: values.currency || "USD",
      accounting_state: 'pending'
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert(transactionData)
      .select()
      .single()

    if (error) throw new Error(`Error creating expense: ${error.message}`)

    if (values.campaignId) {
      await updateCampaignCosts(values.campaignId)
    }

    return { data, error: null }
  } catch (error) {
    console.error("Error in createExpense:", error)
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// Update expense
export async function updateExpense(
  id: string,
  values: {
    siteId: string;
    type?: 'fixed' | 'variable';
    amount?: number;
    currency?: string;
    description?: string;
    category?: string;
    date?: string;
    campaignId?: string | null;
    locationId?: string | null;
    leadId?: string | null;
    catalogItemId?: string | null;
    catalogCategoryId?: string | null;
  }
) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { error: "Not authenticated" }

    const isMember = await verifySiteMembership(supabase, session.user.id, values.siteId)
    if (!isMember) return { error: "Not authorized for this site" }

    // First get the transaction to know if we need to update campaign costs
    const { data: existingTransaction, error: fetchError } = await supabase
      .from("transactions")
      .select("campaign_id")
      .eq("id", id)
      .eq("site_id", values.siteId)
      .single()

    if (fetchError) throw new Error(`Error fetching transaction: ${fetchError.message}`)

    // Update the transaction
    const updateData: any = {}
    if (values.type !== undefined) updateData.type = values.type
    if (values.amount !== undefined) updateData.amount = values.amount
    if (values.currency !== undefined) updateData.currency = values.currency
    if (values.description !== undefined) updateData.description = values.description
    if (values.category !== undefined) updateData.category = values.category
    if (values.date !== undefined) updateData.date = values.date
    if (values.campaignId !== undefined) updateData.campaign_id = values.campaignId
    if (values.locationId !== undefined) updateData.location_id = values.locationId
    if (values.leadId !== undefined) updateData.lead_id = values.leadId
    if (values.catalogItemId !== undefined) updateData.catalog_item_id = values.catalogItemId
    if (values.catalogCategoryId !== undefined) updateData.catalog_category_id = values.catalogCategoryId

    const { data, error } = await supabase
      .from("transactions")
      .update(updateData)
      .eq("id", id)
      .eq("site_id", values.siteId)
      .select()
      .single()

    if (error) throw new Error(`Error updating expense: ${error.message}`)

    // Update campaign costs if the campaign ID was changed, added or removed, or if amount/type changed
    const oldCampaignId = existingTransaction.campaign_id
    const newCampaignId = data.campaign_id

    if (oldCampaignId && oldCampaignId !== newCampaignId) {
      await updateCampaignCosts(oldCampaignId)
    }
    if (newCampaignId) {
      await updateCampaignCosts(newCampaignId)
    }

    return { data, error: null }
  } catch (error) {
    console.error("Error in updateExpense:", error)
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// Delete expense
export async function deleteExpense(id: string, siteId: string) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { error: "Not authenticated" }

    const isMember = await verifySiteMembership(supabase, session.user.id, siteId)
    if (!isMember) return { error: "Not authorized for this site" }

    // First get the transaction to get its campaign ID
    const { data: existingTransaction, error: fetchError } = await supabase
      .from("transactions")
      .select("campaign_id")
      .eq("id", id)
      .eq("site_id", siteId)
      .single()

    if (fetchError) throw new Error(`Error fetching transaction: ${fetchError.message}`)

    // Delete the transaction
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("site_id", siteId)

    if (error) throw new Error(`Error deleting expense: ${error.message}`)

    // Update campaign costs after transaction deletion
    if (existingTransaction.campaign_id) {
      await updateCampaignCosts(existingTransaction.campaign_id)
    }

    return { success: true, error: null }
  } catch (error) {
    console.error("Error in deleteExpense:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

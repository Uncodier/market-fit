import { createClient } from "@/lib/supabase/client"
import { z } from "zod"
import { findOrCreateCompany } from "@/app/companies/actions"
import { Deal, DealContact, DealOwner } from "./types"

export async function getDeals(siteId: string) {
  try {
    const supabase = createClient()
    
    // Get deals with their basic fields, resolving companies
    const { data: deals, error } = await supabase
      .from("deals")
      .select(`
        *,
        companies(name)
      `)
      .eq("site_id", siteId)
      .order("created_at", { ascending: false })

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist yet, return empty array instead of throwing
        return { deals: [], error: null }
      }
      throw error
    }
    
    // Check if we have any deals before trying to map them
    if (!deals || deals.length === 0) {
      return { deals: [], error: null }
    }
    
    // If we want deal_owners and deal_leads, we should fetch them too.
    // For performance on lists, we might just load owners.
    const dealIds = deals.map((d: any) => d.id)
    
    let dealOwners: DealOwner[] = []
    if (dealIds.length > 0) {
      const { data: owners } = await supabase
        .from("deal_owners")
        .select(`
          deal_id,
          user_id
        `)
        .in("deal_id", dealIds)
        
      dealOwners = owners || []
    }

    // Attach owners to deals
    const normalizedDeals = deals.map((deal: any) => ({
      ...deal,
      owners: dealOwners.filter((o) => o.deal_id === deal.id)
    }))

    return { deals: normalizedDeals as Deal[], error: null }
  } catch (error: any) {
    console.error("Error fetching deals:", error, JSON.stringify(error, null, 2))
    return { deals: null, error: error?.message || "Failed to fetch deals" }
  }
}

export async function getDealById(id: string) {
  try {
    const supabase = createClient()
    
    const { data: deal, error } = await supabase
      .from("deals")
      .select(`
        *,
        companies(*)
      `)
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === '42P01') {
        return { deal: null, error: "Deals table does not exist" }
      }
      return { deal: null, error: error.message || "Failed to fetch deal" }
    }
    
    // Fetch owners
    const { data: owners } = await supabase
      .from("deal_owners")
      .select(`*`)
      .eq("deal_id", id)
      
    // Fetch contacts (leads)
    const { data: contacts } = await supabase
      .from("deal_leads")
      .select(`
        *,
        lead:leads(*)
      `)
      .eq("deal_id", id)
      
    return { 
      deal: {
        ...deal,
        owners: owners || [],
        contacts: contacts || []
      } as Deal, 
      error: null 
    }
  } catch (error: any) {
    console.error("Error fetching deal:", error)
    return { deal: null, error: error.message || "Failed to fetch deal" }
  }
}

export async function createDeal(data: Partial<Deal>) {
  try {
    const supabase = createClient()
    
    // Auth context
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    // If company string is provided, try to find or create it
    let company_id = data.company_id
    if (!company_id && data.company) {
      if (typeof data.company === 'string') {
        const result = await findOrCreateCompany(data.company)
        if (result && !result.error && result.company) company_id = result.company.id
      } else if (data.company.name) {
        const result = await findOrCreateCompany(data.company.name)
        if (result && !result.error && result.company) company_id = result.company.id
      }
    }

    const { data: newDeal, error } = await supabase
      .from("deals")
      .insert({
        name: data.name,
        amount: data.amount,
        currency: data.currency || 'USD',
        stage: data.stage || 'prospecting',
        status: data.status || 'open',
        company_id: company_id,
        site_id: data.site_id,
        expected_close_date: data.expected_close_date,
        notes: data.notes,
        qualification_score: data.qualification_score || 0,
        qualification_criteria: data.qualification_criteria || {}
      })
      .select()
      .single()

    if (error) return { deal: null, error: error.message || "Failed to create deal" }

    // By default, add the creator as an owner
    await supabase
      .from("deal_owners")
      .insert({
        deal_id: newDeal.id,
        user_id: user.id
      })

    return { deal: newDeal as Deal, error: null }
  } catch (error: any) {
    console.error("Error creating deal:", error)
    return { deal: null, error: error.message || "Failed to create deal" }
  }
}

export async function updateDeal(data: Partial<Deal>) {
  try {
    if (!data.id) throw new Error("Deal ID is required")
    
    const supabase = createClient()
    
    // If company string is provided, try to find or create it
    let company_id = data.company_id
    if (!company_id && data.company) {
      if (typeof data.company === 'string') {
        const result = await findOrCreateCompany(data.company)
        if (result && !result.error && result.company) company_id = result.company.id
      } else if (data.company.name) {
        const result = await findOrCreateCompany(data.company.name)
        if (result && !result.error && result.company) company_id = result.company.id
      }
    }

    const updatePayload: any = {
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      stage: data.stage,
      status: data.status,
      expected_close_date: data.expected_close_date,
      notes: data.notes,
      qualification_score: data.qualification_score,
      qualification_criteria: data.qualification_criteria,
      sales_order_id: data.sales_order_id
    }
    
    if (company_id !== undefined) {
      updatePayload.company_id = company_id
    }

    const { data: updatedDeal, error } = await supabase
      .from("deals")
      .update(updatePayload)
      .eq("id", data.id)
      .select()
      .single()

    if (error) return { deal: null, error: error.message || "Failed to update deal" }
    return { deal: updatedDeal as Deal, error: null }
  } catch (error: any) {
    console.error("Error updating deal:", error)
    return { deal: null, error: error.message || "Failed to update deal" }
  }
}

export async function deleteDeal(id: string) {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("deals").delete().eq("id", id)
    if (error) return { error: error.message || "Failed to delete deal" }
    return { error: null }
  } catch (error: any) {
    console.error("Error deleting deal:", error)
    return { error: error.message || "Failed to delete deal" }
  }
}

// Contacts (Leads linked to deal)
export async function addDealContact(dealId: string, leadId: string, role: string = '', isPrimary: boolean = false) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("deal_leads")
      .insert({
        deal_id: dealId,
        lead_id: leadId,
        role: role,
        is_primary: isPrimary
      })
      .select()
      .single()

    if (error) return { contact: null, error: error.message || "Failed to add contact" }
    return { contact: data, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to add contact" }
  }
}

export async function removeDealContact(dealId: string, leadId: string) {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from("deal_leads")
      .delete()
      .match({ deal_id: dealId, lead_id: leadId })

    if (error) return { error: error.message || "Failed to remove contact" }
    return { error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to remove contact" }
  }
}

// Owners (Users linked to deal)
export async function addDealOwner(dealId: string, userId: string) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("deal_owners")
      .insert({
        deal_id: dealId,
        user_id: userId
      })
      .select()
      .single()

    if (error) return { owner: null, error: error.message || "Failed to add owner" }
    return { owner: data, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to add owner" }
  }
}

export async function removeDealOwner(dealId: string, userId: string) {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from("deal_owners")
      .delete()
      .match({ deal_id: dealId, user_id: userId })

    if (error) return { error: error.message || "Failed to remove owner" }
    return { error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to remove owner" }
  }
}

export async function getSiteQualificationCriteriaKeys(siteId: string) {
  try {
    const supabase = createClient()
    
    // We only fetch the qualification_criteria column
    const { data, error } = await supabase
      .from("deals")
      .select("qualification_criteria")
      .eq("site_id", siteId)
      
    if (error) {
      if (error.code === '42P01') {
        return { keys: [], error: null }
      }
      return { keys: [], error: error.message || "Failed to fetch criteria" }
    }
    
    if (!data || data.length === 0) return { keys: [], error: null }
    
    const uniqueKeys = new Set<string>()
    data.forEach(deal => {
      if (deal.qualification_criteria && typeof deal.qualification_criteria === 'object') {
        Object.keys(deal.qualification_criteria).forEach(key => uniqueKeys.add(key))
      }
    })
    
    return { keys: Array.from(uniqueKeys), error: null }
  } catch (error: any) {
    console.error("Error fetching qualification criteria keys:", error)
    return { keys: [], error: error.message || "Failed to fetch criteria" }
  }
}

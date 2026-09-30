"use server"

import { createClient } from "@/lib/supabase/server"
import type { LeadResponse, SingleLeadResponse } from "./action-schemas"
import { normalizeOrigin } from "./normalize-origin"

/**
 * Search leads on the server using ilike across key fields
 * Falls back to empty list on error (no mock data)
 */
export async function searchLeads(site_id: string, query: string, limit = 500): Promise<LeadResponse> {
  try {
    const supabase = await createClient()

    // Empty query -> return early to avoid PostgREST errors
    const cleaned = (query || "").trim()
    if (cleaned === "") {
      return { leads: [] }
    }

    // Quote value to safely support commas and special characters in OR clause
    const quoteLogicValue = (value: string) => `"${value.replace(/\"/g, '""')}"`
    const pattern = `%${cleaned}%`
    const orClause = [
      `name.ilike.${quoteLogicValue(pattern)}`,
      `email.ilike.${quoteLogicValue(pattern)}`,
      `personal_email.ilike.${quoteLogicValue(pattern)}`,
      `position.ilike.${quoteLogicValue(pattern)}`,
      `phone.ilike.${quoteLogicValue(pattern)}`,
      `origin.ilike.${quoteLogicValue(pattern)}`,
      // Search company name from JSON column
      `company->>name.ilike.${quoteLogicValue(pattern)}`
    ].join(',')

    const { data, error } = await supabase
      .from("leads")
      .select(`
        id,
        name,
        email,
        personal_email,
        phone,
        company,
        company_id,
        position,
        segment_id,
        campaign_id,
        status,
        notes,
        origin,
        created_at,
        updated_at,
        last_contact,
        site_id,
        user_id,
        birthday,
        language,
        social_networks,
        address,
        attribution,
        assignee_id,
        companies(name)
      `)
      .eq('site_id', site_id)
      .or(orClause)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Error searching leads:", error)
      return { error: error.message, leads: [] }
    }

    const normalizedLeads = (data || []).map((lead: any) => ({
      ...lead,
      origin: normalizeOrigin(lead.origin)
    }))

    return { leads: normalizedLeads }
  } catch (error) {
    console.error("Error in searchLeads:", error)
    return { error: "Error searching leads", leads: [] }
  }
}

/**
 * Search leads with total count (server-side) to support accurate UI totals
 */
export async function searchLeadsWithCount(
  site_id: string,
  query: string,
  limit = 500,
  offset = 0
): Promise<{ leads: Array<any>; totalCount: number; error?: string }> {
  try {
    const supabase = await createClient()

    const cleaned = (query || "").trim()
    if (cleaned === "") {
      return { leads: [], totalCount: 0 }
    }

    const quoteLogicValue = (value: string) => `"${value.replace(/\"/g, '""')}"`
    const pattern = `%${cleaned}%`
    const orClause = [
      `name.ilike.${quoteLogicValue(pattern)}`,
      `email.ilike.${quoteLogicValue(pattern)}`,
      `position.ilike.${quoteLogicValue(pattern)}`,
      `phone.ilike.${quoteLogicValue(pattern)}`,
      `origin.ilike.${quoteLogicValue(pattern)}`,
      `company->>name.ilike.${quoteLogicValue(pattern)}`
    ].join(',')

    const { data, error, count } = await supabase
      .from("leads")
      .select(`
        id,
        name,
        email,
        personal_email,
        phone,
        company,
        company_id,
        position,
        segment_id,
        campaign_id,
        status,
        notes,
        origin,
        created_at,
        updated_at,
        last_contact,
        site_id,
        user_id,
        birthday,
        language,
        social_networks,
        address,
        attribution,
        assignee_id,
        companies(name)
      `, { count: 'exact' })
      .eq('site_id', site_id)
      .or(orClause)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error searching leads (with count):', error)
      return { leads: [], totalCount: 0, error: error.message }
    }

    const leads = (data || []).map((lead: any) => ({
      ...lead,
      origin: normalizeOrigin(lead.origin)
    }))

    return { leads, totalCount: count || 0 }
  } catch (error) {
    console.error('Error in searchLeadsWithCount:', error)
    return { leads: [], totalCount: 0, error: 'Error searching leads' }
  }
}

export async function getLeadById(id: string, site_id: string): Promise<SingleLeadResponse> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("leads")
      .select(`
        id,
        name,
        email,
        personal_email,
        phone,
        company,
        company_id,
        position,
        segment_id,
        campaign_id,
        status,
        notes,
        origin,
        created_at,
        updated_at,
        last_contact,
        site_id,
        user_id,
        birthday,
        language,
        social_networks,
        address,
        attribution,
        assignee_id,
        companies(name)
      `)
      .eq('id', id)
      .eq('site_id', site_id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { error: "Lead not found", lead: null }
      }
      throw error
    }

    const normalizedLead = data ? {
      ...data,
      origin: normalizeOrigin(data.origin)
    } : null

    return { lead: normalizedLead }
  } catch (error) {
    console.error("Error loading lead:", error)
    return { error: "Error loading lead", lead: null }
  }
}

export async function getLeads(site_id: string): Promise<LeadResponse> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("leads")
      .select(`
        id,
        name,
        email,
        personal_email,
        phone,
        company,
        company_id,
        position,
        segment_id,
        campaign_id,
        status,
        notes,
        origin,
        created_at,
        updated_at,
        last_contact,
        site_id,
        user_id,
        buyer_user_id,
        birthday,
        language,
        social_networks,
        address,
        attribution,
        assignee_id,
        companies(name)
      `)
      .eq('site_id', site_id)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Si no hay datos, retornamos un array vacío en lugar de null
    const normalizedLeads = (data || []).map((lead: any) => ({
      ...lead,
      origin: normalizeOrigin(lead.origin)
    }))

    return { leads: normalizedLeads }
  } catch (error) {
    console.error("Error loading leads:", error)
    return { error: "Error loading leads", leads: [] }
  }
}

export async function getLeadsByCampaignId(campaign_id: string, site_id: string): Promise<LeadResponse> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("leads")
      .select(`
        id,
        name,
        email,
        personal_email,
        phone,
        company,
        company_id,
        position,
        segment_id,
        campaign_id,
        status,
        notes,
        origin,
        created_at,
        updated_at,
        last_contact,
        site_id,
        user_id,
        birthday,
        language,
        social_networks,
        address,
        attribution,
        assignee_id,
        companies(name)
      `)
      .eq('campaign_id', campaign_id)
      .eq('site_id', site_id)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Return empty array instead of null if no data
    const normalizedLeads = (data || []).map((lead: any) => ({
      ...lead,
      origin: normalizeOrigin(lead.origin)
    }))

    return { leads: normalizedLeads }
  } catch (error) {
    console.error("Error loading campaign leads:", error)
    return { error: "Error loading campaign leads", leads: [] }
  }
}


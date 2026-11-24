"use server"

import { createClient } from "@/lib/supabase/server"
import type { LeadResponse, SingleLeadResponse } from "./action-schemas"
import { normalizeOrigin } from "./normalize-origin"
import { isLeadSegmentId } from "./segment-scope"
import { exactLeadCount, leadReadFailure, readWithOptionalCount } from "./read-with-optional-count"

type LeadListRow = NonNullable<LeadResponse['leads']>[number] & { companies?: { name: string } | null }
type LeadListResponse = LeadResponse & { totalCount: number | null }

const LEAD_LIST_COLUMNS = `id, name, email, personal_email, phone, company, company_id, position,
  segment_id, campaign_id, status, notes, origin, created_at, updated_at, last_contact, site_id,
  user_id, birthday, language, social_networks, address, attribution, assignee_id, companies(name)`

function isLeadReadSiteId(siteId: unknown): siteId is string {
  return isLeadSegmentId(siteId) || (typeof siteId === 'string' && /^demo-[a-z0-9-]{1,80}$/.test(siteId))
}

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

    const normalizedLeads = (data || []).map((lead: LeadListRow) => ({
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
  offset = 0,
  segmentId?: string
): Promise<{ leads: LeadListRow[]; totalCount: number | null; error?: string }> {
  if (segmentId !== undefined && !isLeadSegmentId(segmentId)) {
    return { leads: [], totalCount: 0 }
  }
  if (!isLeadReadSiteId(site_id) || typeof query !== 'string' ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 1000 ||
      !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(offset + limit)) {
    return { leads: [], totalCount: null, error: 'Invalid lead search' }
  }
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

    const { data, error, count, status } = await readWithOptionalCount<LeadListRow>(withCount => {
      const leadsQuery = supabase.from("leads")
        .select(LEAD_LIST_COLUMNS, withCount ? { count: 'exact' } : undefined)
        .eq('site_id', site_id)
        .or(orClause)
      if (segmentId !== undefined) leadsQuery.eq('segment_id', segmentId)
      return leadsQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    }, supabase._isDemo === true)

    if (error) {
      return { ...leadReadFailure(error, status), leads: [], totalCount: null }
    }

    const leads = (data || []).map((lead: LeadListRow) => ({
      ...lead,
      origin: normalizeOrigin(lead.origin)
    }))

    return { leads, totalCount: exactLeadCount(count) }
  } catch (error) {
    return { ...leadReadFailure(error), leads: [], totalCount: null }
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
        do_not_call,
        voice_call_consent_status,
        voice_call_consent_at,
        default_price_list_id,
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

async function readLeads(siteId: string, segmentId: string | undefined, includeCount: boolean): Promise<LeadListResponse> {
  if (segmentId !== undefined && !isLeadSegmentId(segmentId)) return { leads: [], totalCount: 0 }
  if (!isLeadReadSiteId(siteId)) return { leads: [], totalCount: null, error: 'Invalid lead site' }
  try {
    const supabase = await createClient()
    const build = (withCount: boolean) => {
      const leadsQuery = supabase.from("leads")
        .select(`${LEAD_LIST_COLUMNS}, buyer_user_id`, withCount ? { count: 'exact' } : undefined)
        .eq('site_id', siteId)
      if (segmentId !== undefined) leadsQuery.eq('segment_id', segmentId)
      return leadsQuery.order("created_at", { ascending: false })
    }
    const { data, error, count, status } = includeCount
      ? await readWithOptionalCount<LeadListRow>(build, supabase._isDemo === true)
      : await build(false)

    if (error) return { ...leadReadFailure(error, status), leads: [], totalCount: null }

    const normalizedLeads = (data || []).map((lead: LeadListRow) => ({
      ...lead,
      origin: normalizeOrigin(lead.origin)
    }))

    return { leads: normalizedLeads, totalCount: exactLeadCount(count) }
  } catch (error) {
    return { ...leadReadFailure(error), leads: [], totalCount: null }
  }
}

export async function getLeads(site_id: string, segmentId?: string): Promise<LeadResponse> {
  const { leads, error } = await readLeads(site_id, segmentId, false)
  return error ? { leads, error } : { leads }
}

export async function getLeadsWithCount(siteId: string, segmentId?: string): Promise<LeadListResponse> {
  return readLeads(siteId, segmentId, true)
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
    const normalizedLeads = (data || []).map((lead: LeadListRow) => ({
      ...lead,
      origin: normalizeOrigin(lead.origin)
    }))

    return { leads: normalizedLeads }
  } catch (error) {
    console.error("Error loading campaign leads:", error)
    return { error: "Error loading campaign leads", leads: [] }
  }
}


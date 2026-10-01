"use server"

import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { findOrCreateCompany } from "@/app/companies/actions"
import { CreateLeadSchema, UpdateLeadSchema, type CreateLeadInput, type UpdateLeadInput } from "./action-schemas"
import { normalizeOrigin } from "./normalize-origin"

// Nueva función auxiliar para manejar la creación/búsqueda de company
async function handleCompanyForLead(data: CreateLeadInput | Partial<UpdateLeadInput>) {
  let company_id = data.company_id

  // Handle different company data types
  if (!company_id && data.company) {
    let companyName: string | null = null
    
    // If company is a string, use it directly
    if (typeof data.company === 'string') {
      companyName = data.company
    }
    // If company is an object with a name property, use that
    else if (typeof data.company === 'object' && data.company.name) {
      companyName = data.company.name
    }
    
    // If we have a company name, try to create/find the company
    if (companyName) {
      const { company, error } = await findOrCreateCompany(companyName)
      if (error) {
        console.error("Error handling company:", error)
        return { company_id: null, error }
      }
      company_id = company?.id || null
    }
  }

  return { company_id, error: null }
}

export async function findOrCreateLead(site_id: string, name: string) {
  try {
    if (!name || !name.trim()) return { lead: null, error: "Name is required" }
    const trimmed = name.trim()

    const supabase = await createClient()
    const { data: existing, error: searchError } = await supabase
      .from("leads")
      .select("*")
      .eq("site_id", site_id)
      .ilike("name", trimmed)
      .limit(1)
      .single()

    if (existing) return { lead: existing, error: null }
    if (searchError && searchError.code !== "PGRST116") {
      return { lead: null, error: searchError.message }
    }

    const { lead, error } = await createLead({
      site_id,
      name: trimmed,
      status: "new",
      origin: "inbound"
    })

    return { lead, error }
  } catch (error: any) {
    console.error("Error finding or creating lead:", error)
    return { lead: null, error: error.message || "Failed to find or create lead" }
  }
}

export async function createLead(data: CreateLeadInput): Promise<{ error?: string; lead?: any }> {

  try {
    const supabase = await createClient()
    
    // Validate input data
    const validatedData = CreateLeadSchema.parse(data)
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error("Error getting authenticated user:", authError)
      return { error: "Authentication error" }
    }

    if (!user) {
      return { error: "User not authenticated" }
    }
    
    // Handle company creation/lookup
    const { company_id, error: companyError } = await handleCompanyForLead(validatedData)
    if (companyError) {
      return { error: companyError }
    }
    
    // Prepare data for insertion
    const insertData = {
      ...validatedData,
      name: validatedData.name || (validatedData.email ? validatedData.email.split('@')[0] : (validatedData.phone || 'Unknown')),
      company_id,
      user_id: user.id
    }
    
    // Insert the lead
    const { data: lead, error } = await supabase
      .from("leads")
      .insert([insertData])
      .select()
      .single()
    
    if (error) {
      console.error("Error creating lead:", error)
      return { error: `Error creating lead: ${error.message}` }
    }
    
    const normalizedLead = lead ? {
      ...lead,
      origin: normalizeOrigin(lead.origin)
    } : undefined

    return { lead: normalizedLead }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => `${e.path}: ${e.message}`).join(", ")
      return { error: `Validation errors: ${errors}` }
    }
    
    console.error("Error in createLead:", error)
    return { error: "Error creating lead" }
  }
}

export async function updateLead(data: Partial<UpdateLeadInput>): Promise<{ error?: string; success?: boolean }> {
  try {
    if (["voice_call_consent_status", "voice_call_consent_at", "do_not_call"].some(
      (field) => Object.prototype.hasOwnProperty.call(data, field)
    )) {
      return { error: "Use the call consent editor to confirm changes to outbound-call permissions." }
    }
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error("Error getting authenticated user:", authError)
      return { error: "Authentication error" }
    }

    if (!user) {
      return { error: "User not authenticated" }
    }
    
    // Only validate attribution strictly when changing status to "converted"
    if (data.status === "converted" && data.attribution) {
      // Full validation when converting lead with attribution
      UpdateLeadSchema.parse(data)
    } else {
      // Skip attribution validation for other updates
      const { attribution, ...dataWithoutAttribution } = data
      UpdateLeadSchema.omit({ attribution: true }).parse(dataWithoutAttribution)
    }
    
    // Handle company creation/lookup if needed (only if company field is present)
    let company_id = undefined
    let companyError = null
    
    if ('company' in data) {
      const result = await handleCompanyForLead(data)
      company_id = result.company_id
      companyError = result.error
      
      if (companyError) {
        return { error: companyError }
      }
    }
    
    // Extract ID and site_id for the WHERE condition (security: ensure we only update leads from the correct site)
    const { id, site_id, ...updateData } = data
    
    // Add company_id to update data if it was determined
    if (company_id !== undefined) {
      updateData.company_id = company_id
    }
    
    // Update the lead - filter by both id AND site_id for security (defense in depth)
    const { error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", id)
      .eq("site_id", site_id)
    
    if (error) {
      console.error("Error updating lead:", error)
      return { error: `Error updating lead: ${error.message}` }
    }
    
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => `${e.path}: ${e.message}`).join(", ")
      return { error: `Validation errors: ${errors}` }
    }
    
    console.error("Error in updateLead:", error)
    return { error: "Error updating lead" }
  }
}

export async function deleteLead(id: string): Promise<{ error?: string; success?: boolean }> {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error("Error getting authenticated user:", authError)
      return { error: "Authentication error" }
    }

    if (!user) {
      return { error: "User not authenticated" }
    }
    
    // Delete the lead
    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting lead:", error)
      return { error: `Error deleting lead: ${error.message}` }
    }
    
    return { success: true }
  } catch (error) {
    console.error("Error in deleteLead:", error)
    return { error: "Error deleting lead" }
  }
}

/**
 * Assign a lead to the currently authenticated user
 */
export async function assignLeadToUser(leadId: string, userId: string, siteId: string): Promise<{ error?: string; success?: boolean }> {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error("Error getting authenticated user:", authError)
      return { error: "Authentication error" }
    }

    if (!user) {
      return { error: "User not authenticated" }
    }
    
    // Verify that the lead exists and belongs to the site
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .eq("site_id", siteId)
      .single()
    
    if (leadError) {
      console.error("Error verifying lead:", leadError)
      return { error: "Lead not found or access denied" }
    }
    
    // Update the lead with the assignee
    const { error } = await supabase
      .from("leads")
      .update({ 
        assignee_id: userId,
        updated_at: new Date().toISOString()
      })
      .eq("id", leadId)
    
    if (error) {
      console.error("Error assigning lead:", error)
      return { error: `Error assigning lead: ${error.message}` }
    }
    
    return { success: true }
  } catch (error) {
    console.error("Error in assignLeadToUser:", error)
    return { error: "Error assigning lead" }
  }
} 
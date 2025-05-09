import { createClient } from "@/lib/supabase/client"
import { z } from "zod"

// Definir el schema de respuesta
const LeadSchema = z.object({
  leads: z.array(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    company: z.object({
      name: z.string().optional(),
      website: z.string().optional(),
      industry: z.string().optional(),
      size: z.string().optional(),
      annual_revenue: z.string().optional(),
      founded: z.string().optional(),
      description: z.string().optional(),
      address: z.object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipcode: z.string().optional(),
        country: z.string().optional(),
      }).optional(),
    }).nullable(),
    position: z.string().nullable(),
    segment_id: z.string().nullable(),
    campaign_id: z.string().nullable(),
    status: z.enum(["new", "contacted", "qualified", "converted", "lost"]),
    notes: z.string().nullable(),
    origin: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    last_contact: z.string().nullable(),
    site_id: z.string(),
    user_id: z.string(),
    birthday: z.string().nullable(),
    language: z.string().nullable(),
    social_networks: z.object({
      linkedin: z.string().optional(),
      twitter: z.string().optional(),
      facebook: z.string().optional(),
      instagram: z.string().optional(),
      tiktok: z.string().optional(),
      youtube: z.string().optional(),
      whatsapp: z.string().optional(),
      pinterest: z.string().optional(),
    }).nullable(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipcode: z.string().optional(),
      country: z.string().optional(),
    }).nullable(),
  })).nullable(),
  error: z.string().optional()
})

export type LeadResponse = z.infer<typeof LeadSchema>

// Schema for single lead response
const SingleLeadSchema = z.object({
  lead: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    company: z.object({
      name: z.string().optional(),
      website: z.string().optional(),
      industry: z.string().optional(),
      size: z.string().optional(),
      annual_revenue: z.string().optional(),
      founded: z.string().optional(),
      description: z.string().optional(),
      address: z.object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipcode: z.string().optional(),
        country: z.string().optional(),
      }).optional(),
    }).nullable(),
    position: z.string().nullable(),
    segment_id: z.string().nullable(),
    campaign_id: z.string().nullable(),
    status: z.enum(["new", "contacted", "qualified", "converted", "lost"]),
    notes: z.string().nullable(),
    origin: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    last_contact: z.string().nullable(),
    site_id: z.string(),
    user_id: z.string(),
    birthday: z.string().nullable(),
    language: z.string().nullable(),
    social_networks: z.object({
      linkedin: z.string().optional(),
      twitter: z.string().optional(),
      facebook: z.string().optional(),
      instagram: z.string().optional(),
      tiktok: z.string().optional(),
      youtube: z.string().optional(),
      whatsapp: z.string().optional(),
      pinterest: z.string().optional(),
    }).nullable(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipcode: z.string().optional(),
      country: z.string().optional(),
    }).nullable(),
  }).nullable(),
  error: z.string().optional()
})

export type SingleLeadResponse = z.infer<typeof SingleLeadSchema>

// Schema para validar los datos de entrada al crear un lead
const CreateLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  company: z.object({
    name: z.string().optional(),
    website: z.string().optional(),
    industry: z.string().optional(),
    size: z.string().optional(),
    annual_revenue: z.string().optional(),
    founded: z.string().optional(),
    description: z.string().optional(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipcode: z.string().optional(),
      country: z.string().optional(),
    }).optional(),
  }).nullable(),
  position: z.string().optional(),
  segment_id: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).default("new"),
  notes: z.string().optional(),
  origin: z.string().optional(),
  site_id: z.string().min(1, "Site ID is required"),
  birthday: z.string().optional(),
  language: z.string().optional(),
  social_networks: z.object({
    linkedin: z.string().optional(),
    twitter: z.string().optional(),
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    tiktok: z.string().optional(),
    youtube: z.string().optional(),
    whatsapp: z.string().optional(),
    pinterest: z.string().optional(),
  }).optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipcode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
})

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>

// Schema para validar los datos de entrada al actualizar un lead
const UpdateLeadSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional().nullable(),
  company: z.object({
    name: z.string().optional(),
    website: z.string().optional(),
    industry: z.string().optional(),
    size: z.string().optional(),
    annual_revenue: z.string().optional(),
    founded: z.string().optional(),
    description: z.string().optional(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipcode: z.string().optional(),
      country: z.string().optional(),
    }).optional(),
  }).nullable(),
  position: z.string().optional().nullable(),
  segment_id: z.string().optional().nullable(),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]),
  notes: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
  site_id: z.string().min(1, "Site ID is required"),
  birthday: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  social_networks: z.object({
    linkedin: z.string().optional(),
    twitter: z.string().optional(),
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    tiktok: z.string().optional(),
    youtube: z.string().optional(),
    whatsapp: z.string().optional(),
    pinterest: z.string().optional(),
  }).optional().nullable(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipcode: z.string().optional(),
    country: z.string().optional(),
  }).optional().nullable(),
})

export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>

export async function getLeadById(id: string, site_id: string): Promise<SingleLeadResponse> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("leads")
      .select(`
        id,
        name,
        email,
        phone,
        company,
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
        address
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

    return { lead: data }
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
        phone,
        company,
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
        address
      `)
      .eq('site_id', site_id)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Si no hay datos, retornamos un array vacío en lugar de null
    return { leads: data || [] }
  } catch (error) {
    console.error("Error loading leads:", error)
    return { error: "Error al cargar los leads", leads: [] }
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
        phone,
        company,
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
        address
      `)
      .eq('campaign_id', campaign_id)
      .eq('site_id', site_id)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Return empty array instead of null if no data
    return { leads: data || [] }
  } catch (error) {
    console.error("Error loading campaign leads:", error)
    return { error: "Error loading campaign leads", leads: [] }
  }
}

export async function createLead(data: CreateLeadInput): Promise<{ error?: string; lead?: any }> {
  try {
    const supabase = await createClient()
    
    // Validate input data
    const validatedData = CreateLeadSchema.parse(data)
    
    // Insert the lead
    const { data: lead, error } = await supabase
      .from("leads")
      .insert([validatedData])
      .select()
      .single()
    
    if (error) {
      console.error("Error creating lead:", error)
      return { error: `Error creating lead: ${error.message}` }
    }
    
    return { lead }
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
    const supabase = await createClient()
    
    // Validate input data (we use partial to allow for partial updates)
    UpdateLeadSchema.parse(data) // This should throw if validation fails
    
    // Extract ID for the condition
    const { id, ...updateData } = data
    
    // Update the lead
    const { error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", id)
    
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
    return { error: "Error al actualizar el lead" }
  }
}

export async function deleteLead(id: string): Promise<{ error?: string; success?: boolean }> {
  try {
    const supabase = await createClient()
    
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
import { createClient } from "@/lib/supabase/client"
import { z } from "zod"
import { findOrCreateCompany } from "@/app/companies/actions"
import { Lead } from "./types"

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
    company_id: z.string().nullable(),
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
      linkedin: z.string().optional().nullable(),
      twitter: z.string().optional().nullable(),
      facebook: z.string().optional().nullable(),
      instagram: z.string().optional().nullable(),
      tiktok: z.string().optional().nullable(),
      youtube: z.string().optional().nullable(),
      whatsapp: z.string().optional().nullable(),
      pinterest: z.string().optional().nullable(),
    }).nullable(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipcode: z.string().optional(),
      country: z.string().optional(),
    }).nullable(),
    attribution: z.object({
      user_id: z.string(),
      user_name: z.string(),
      date: z.string(),
      final_amount: z.number().optional(),
      is_market_fit_influenced: z.boolean(),
      notes: z.string().optional(),
    }).nullable().optional(),
    assignee_id: z.string().nullable().optional(),
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
    company_id: z.string().nullable(),
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
      linkedin: z.string().optional().nullable(),
      twitter: z.string().optional().nullable(),
      facebook: z.string().optional().nullable(),
      instagram: z.string().optional().nullable(),
      tiktok: z.string().optional().nullable(),
      youtube: z.string().optional().nullable(),
      whatsapp: z.string().optional().nullable(),
      pinterest: z.string().optional().nullable(),
    }).nullable(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipcode: z.string().optional(),
      country: z.string().optional(),
    }).nullable(),
    attribution: z.object({
      user_id: z.string(),
      user_name: z.string(),
      date: z.string(),
      final_amount: z.number().optional(),
      is_market_fit_influenced: z.boolean(),
      notes: z.string().optional(),
    }).nullable().optional(),
    assignee_id: z.string().nullable().optional(),
  }).nullable(),
  error: z.string().optional()
})

export type SingleLeadResponse = z.infer<typeof SingleLeadSchema>

// Schema para validar los datos de entrada al crear un lead
const CreateLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  company: z.union([
    z.string(),
    z.object({
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
    })
  ]).optional().nullable(),
  company_id: z.string().optional(),
  position: z.string().optional(),
  segment_id: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).default("new"),
  notes: z.string().optional(),
  origin: z.string().optional(),
  site_id: z.string().min(1, "Site ID is required"),
  birthday: z.string().optional(),
  language: z.string().optional(),
  social_networks: z.object({
    linkedin: z.string().optional().nullable(),
    twitter: z.string().optional().nullable(),
    facebook: z.string().optional().nullable(),
    instagram: z.string().optional().nullable(),
    tiktok: z.string().optional().nullable(),
    youtube: z.string().optional().nullable(),
    whatsapp: z.string().optional().nullable(),
    pinterest: z.string().optional().nullable(),
  }).optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipcode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  assignee_id: z.string().optional().nullable(),
})

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>

// Schema para validar los datos de entrada al actualizar un lead
const UpdateLeadSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  company: z.union([
    z.string(),
    z.object({
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
    })
  ]).optional().nullable(),
  company_id: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  campaign_id: z.string().optional().nullable(),
  segment_id: z.string().optional().nullable(),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]),
  notes: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
  site_id: z.string().min(1, "Site ID is required"),
  birthday: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  social_networks: z.object({
    linkedin: z.string().optional().nullable(),
    twitter: z.string().optional().nullable(),
    facebook: z.string().optional().nullable(),
    instagram: z.string().optional().nullable(),
    tiktok: z.string().optional().nullable(),
    youtube: z.string().optional().nullable(),
    whatsapp: z.string().optional().nullable(),
    pinterest: z.string().optional().nullable(),
  }).optional().nullable(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipcode: z.string().optional(),
    country: z.string().optional(),
  }).optional().nullable(),
  attribution: z.object({
    user_id: z.string(),
    user_name: z.string(),
    date: z.string(),
    final_amount: z.number().optional(),
    is_market_fit_influenced: z.boolean(),
    notes: z.string().optional(),
  }).optional().nullable(),
  assignee_id: z.string().optional().nullable(),
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
    return { leads: data || [] }
  } catch (error) {
    console.error("Error loading campaign leads:", error)
    return { error: "Error loading campaign leads", leads: [] }
  }
}

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
    
    // Handle company creation/lookup if needed
    const { company_id, error: companyError } = await handleCompanyForLead(data)
    if (companyError) {
      return { error: companyError }
    }
    
    // Extract ID for the condition
    const { id, ...updateData } = data
    
    // Add company_id to update data if it was determined
    if (company_id !== undefined) {
      updateData.company_id = company_id
    }
    
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
 * Get conversations for a lead
 */
export async function getLeadConversations(siteId: string, leadId: string) {
  try {
    const supabase = await createClient();

    // Fetch conversations from the database with specific filters including channel and status
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        id,
        title,
        channel,
        custom_data,
        status,
        last_message_at,
        created_at,
        messages (
          content,
          created_at,
          role
        )
      `)
      .eq('site_id', siteId)
      .eq('lead_id', leadId)
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error("Error fetching lead conversations:", error);
      return { error: error.message };
    }

    if (!data || data.length === 0) {
      return { conversations: [] };
    }
    
    // Transform the data to match the Conversation interface needed by the component
    const conversations = data.map((item: {
      id: string
      title: string | null
      channel: string | null
      custom_data: any
      status: string | null
      last_message_at: string | null
      created_at: string
      messages?: Array<{
        content: string
        created_at: string
        role: string
      }> | null
    }) => {
      // Get the last message content if available from the nested messages
      const lastMessageContent = item.messages && item.messages.length > 0 
        ? item.messages[item.messages.length - 1].content 
        : '';
      
      // Get channel from direct field or custom_data, default to 'web'
      let channel = item.channel || item.custom_data?.channel || 'web';
      
      // Normalize website_chat to web since they are the same
      if (channel === 'website_chat') {
        channel = 'web';
      }
      
      // Get status from database, default to 'active'
      const status = item.status || 'active';
      
      return {
        id: item.id,
        channel: channel as 'web' | 'email' | 'whatsapp',
        subject: item.title || 'No Subject',
        message: lastMessageContent || '',
        date: item.last_message_at || item.created_at,
        status: status as 'pending' | 'active' | 'closed' | 'archived'
      };
    });

    return { conversations };
  } catch (error) {
    console.error("Error in getLeadConversations:", error);
    return { error: "Failed to fetch lead conversations", conversations: [] };
  }
}

export async function exportLeads(siteId: string) {
  try {
    const supabase = await createClient()
    
    // Get all leads for the site with segment name
    const { data: leads, error } = await supabase
      .from('leads')
      .select(`
        *,
        segments:segment_id (
          name
        )
      `)
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
    
    if (error) {
      return { error: error.message }
    }

    // Transform leads data for CSV
    const csvData = leads.map((lead: {
      name: string
      email: string
      phone: string | null
      company: { name?: string } | null
      position: string | null
      status: string
      segments: { name: string } | null
      origin: string | null
      created_at: string
      notes: string | null
    }) => ({
      Name: lead.name,
      Email: lead.email,
      Phone: lead.phone || '',
      Company: lead.company?.name || '',
      Position: lead.position || '',
      Status: lead.status,
      Segment: lead.segments?.name || 'No Segment',
      Origin: lead.origin || '',
      Created: new Date(lead.created_at).toLocaleDateString(),
      Notes: lead.notes || ''
    }))

    return { data: csvData }
  } catch (error) {
    console.error('Error exporting leads:', error)
    return { error: 'Failed to export leads' }
  }
}

export async function importLeads(leads: Partial<Lead>[], siteId: string) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error("Error getting authenticated user:", authError)
      return { 
        success: false, 
        count: 0, 
        errors: ['Authentication error: ' + authError.message] 
      }
    }

    if (!user) {
      return { 
        success: false, 
        count: 0, 
        errors: ['User not authenticated'] 
      }
    }
    
    const errors: string[] = []
    const createdLeads: Lead[] = []
    
    // Process leads in batches to avoid overwhelming the database
    const batchSize = 50
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize)
      
      // Prepare batch data
      const batchData = batch.map((lead, index) => {
        // Validate required fields
        if (!lead.name || !lead.email) {
          errors.push(`Row ${i + index + 1}: Name and email are required`)
          return null
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(lead.email)) {
          errors.push(`Row ${i + index + 1}: Invalid email format`)
          return null
        }
        
        // Validate status
        const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost']
        if (lead.status && !validStatuses.includes(lead.status as string)) {
          errors.push(`Row ${i + index + 1}: Invalid status "${lead.status}"`)
          return null
        }
        
        return {
          name: lead.name,
          email: lead.email,
          phone: lead.phone || null,
          company: typeof lead.company === 'string' ? { name: lead.company } : lead.company || null,
          position: lead.position || null,
          segment_id: lead.segment_id || null,
          status: (lead.status as "new" | "contacted" | "qualified" | "converted" | "lost") || 'new',
          origin: lead.origin || null,
          notes: lead.notes || null,
          birthday: lead.birthday || null,
          language: lead.language || null,
          social_networks: lead.social_networks || null,
          address: lead.address || null,
          site_id: siteId,
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }).filter(Boolean)
      
      if (batchData.length > 0) {
        // Insert batch
        const { data, error } = await supabase
          .from('leads')
          .insert(batchData)
          .select()
        
        if (error) {
          // Handle unique constraint violations separately
          if (error.code === '23505' && error.message.includes('email')) {
            // Extract row information from error if possible
            errors.push(`Batch ${Math.floor(i/batchSize) + 1}: Duplicate email(s) found`)
          } else {
            errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${error.message}`)
          }
        } else if (data) {
          createdLeads.push(...data)
        }
      }
    }
    
    // Return results
    if (createdLeads.length === 0 && errors.length > 0) {
      return { success: false, count: 0, errors }
    }
    
    return { 
      success: true, 
      count: createdLeads.length, 
      errors: errors.length > 0 ? errors : undefined 
    }
    
  } catch (error) {
    console.error('Error importing leads:', error)
    return { 
      success: false, 
      count: 0, 
      errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
    }
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
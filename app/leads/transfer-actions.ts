"use server"

import { createClient } from "@/lib/supabase/server"
import type { Lead } from "./types"

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
        const rowNumber = i + index + 1
        // Require either a valid email or a valid phone number
        const email = (lead.email || '').toString().trim()
        const phone = (lead.phone || '').toString().trim()
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        
        const hasValidEmail = email && emailRegex.test(email)
        const hasPhone = phone.length > 0
        
        if (!hasValidEmail && !hasPhone) {
          errors.push(`Row ${rowNumber}: A valid email or phone number is required`)
          return null
        }
        
        // Validate status
        const validStatuses = ['new', 'contacted', 'qualified', 'cold', 'converted', 'lost', 'not_qualified']
        if (lead.status && !validStatuses.includes(lead.status as string)) {
          errors.push(`Row ${rowNumber}: Invalid status "${lead.status}"`)
          return null
        }
        
        // Generate fallback name if missing
        let name = lead.name && lead.name.toString().trim()
        if (!name) {
          name = hasValidEmail ? email.split('@')[0] : (hasPhone ? phone : 'Unknown')
        }
        
        return {
          name,
          email: hasValidEmail ? email : "",
          personal_email: lead.personal_email || null,
          phone: hasPhone ? phone : null,
          company: typeof lead.company === 'string' ? { name: lead.company } : lead.company || null,
          position: lead.position || null,
          segment_id: lead.segment_id || null,
          status: (lead.status as "new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified") || 'new',
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
          // If the batch fails, try to insert one by one so that valid rows are still imported
          console.warn(`Batch ${Math.floor(i/batchSize) + 1} failed: ${error.message}. Attempting individual inserts...`)
          
          for (let j = 0; j < batchData.length; j++) {
            const singleLeadData = batchData[j]
            const { data: singleData, error: singleError } = await supabase
              .from('leads')
              .insert(singleLeadData)
              .select()
              
            if (singleError) {
              if (singleError.code === '23505') {
                errors.push(`Row ${i + j + 1} failed: Duplicate entry (likely email)`)
              } else {
                errors.push(`Row ${i + j + 1} failed: ${singleError.message}`)
              }
            } else if (singleData) {
              createdLeads.push(...singleData)
            }
          }
        } else if (data) {
          createdLeads.push(...data)
        }
      }
    }
    
    // Return results (partial success allowed)
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


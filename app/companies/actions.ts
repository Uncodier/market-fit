import { createClient } from "@/lib/supabase/client"
import { z } from "zod"
import { Company, CreateCompanyInput, UpdateCompanyInput } from "./types"

// Base schema sin refinements
const BaseCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  legal_name: z.string().optional().nullable(),
  website: z.string().url("Invalid website URL").optional().nullable().or(z.literal("")),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  linkedin_url: z.string().url("Invalid LinkedIn URL").optional().nullable().or(z.literal("")),
  industry: z.enum([
    'technology', 'finance', 'healthcare', 'education', 'retail', 
    'manufacturing', 'services', 'hospitality', 'media', 'real_estate', 
    'logistics', 'nonprofit', 'other'
  ]).optional().nullable(),
  size: z.enum([
    '1-10', '11-50', '51-200', '201-500', '501-1000', 
    '1001-5000', '5001-10000', '10001+'
  ]).optional().nullable(),
  employees_count: z.number().min(0, "Employees count must be positive").optional().nullable(),
  annual_revenue: z.enum([
    '<1M', '1M-10M', '10M-50M', '50M-100M', '100M-500M', 
    '500M-1B', '>1B'
  ]).optional().nullable(),
  founded: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  // Legal and tax fields
  tax_id: z.string().optional().nullable(),
  tax_country: z.string().length(2, "Tax country must be a 2-letter country code").optional().nullable().or(z.literal("")),
  registration_number: z.string().optional().nullable(),
  vat_number: z.string().optional().nullable(),
  legal_structure: z.enum([
    'sole_proprietorship', 'partnership', 'llc', 'corporation', 
    'nonprofit', 'cooperative', 's_corp', 'c_corp', 'lp', 'llp',
    'sa', 'srl', 'gmbh', 'ltd', 'plc', 'bv', 'nv', 'other'
  ]).optional().nullable(),
  // Public company fields
  is_public: z.boolean().optional().nullable(),
  stock_symbol: z.string().optional().nullable(),
  parent_company_id: z.string().uuid("Invalid parent company ID").optional().nullable().or(z.literal("")),
  address: z.object({
    street: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    zipcode: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
  }).optional().nullable(),
})

// Schema para validar los datos de entrada al crear una company
const CreateCompanySchema = BaseCompanySchema.refine((data) => {
  // If is_public is true, stock_symbol should be provided
  if (data.is_public && !data.stock_symbol?.trim()) {
    return false
  }
  return true
}, {
  message: "Stock symbol is required for public companies",
  path: ["stock_symbol"]
})

// Schema para validar los datos de entrada al actualizar una company
const UpdateCompanySchema = BaseCompanySchema.extend({
  id: z.string().min(1, "Company ID is required")
}).refine((data) => {
  // If is_public is true, stock_symbol should be provided
  if (data.is_public && !data.stock_symbol?.trim()) {
    return false
  }
  return true
}, {
  message: "Stock symbol is required for public companies",
  path: ["stock_symbol"]
})

// Helper function to clean data before database operations
function cleanCompanyData(data: any) {
  const cleaned = { ...data }
  
  // Convert empty strings to null for optional fields
  if (cleaned.website === "") cleaned.website = null
  if (cleaned.email === "") cleaned.email = null
  if (cleaned.linkedin_url === "") cleaned.linkedin_url = null
  if (cleaned.tax_country === "") cleaned.tax_country = null
  if (cleaned.parent_company_id === "") cleaned.parent_company_id = null
  if (cleaned.legal_name === "") cleaned.legal_name = null
  if (cleaned.phone === "") cleaned.phone = null
  if (cleaned.founded === "") cleaned.founded = null
  if (cleaned.description === "") cleaned.description = null
  if (cleaned.tax_id === "") cleaned.tax_id = null
  if (cleaned.registration_number === "") cleaned.registration_number = null
  if (cleaned.vat_number === "") cleaned.vat_number = null
  if (cleaned.stock_symbol === "") cleaned.stock_symbol = null
  
  // Convert undefined values to null for consistency with database
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      cleaned[key] = null
    }
  })
  
  // Ensure stock_symbol is null if not public
  if (!cleaned.is_public) {
    cleaned.stock_symbol = null
  }
  
  // Handle address object
  if (cleaned.address) {
    Object.keys(cleaned.address).forEach(key => {
      if (cleaned.address[key] === "" || cleaned.address[key] === undefined) {
        cleaned.address[key] = null
      }
    })
    
    // If all address fields are null, set address to null
    const addressValues = Object.values(cleaned.address).filter(val => val !== null)
    if (addressValues.length === 0) {
      cleaned.address = null
    }
  }
  
  return cleaned
}

// Obtener todas las companies
export async function getCompanies(search?: string) {
  try {
    const supabase = createClient()
    
    let query = supabase
      .from('companies')
      .select('*')
      .order('name', { ascending: true })
    
    if (search && search.trim()) {
      query = query.or(`name.ilike.%${search.trim()}%,legal_name.ilike.%${search.trim()}%`)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error("Error fetching companies:", error)
      return { companies: [], error: error.message }
    }
    
    return { companies: data as Company[], error: null }
  } catch (error) {
    console.error("Error fetching companies:", error)
    return { companies: [], error: "Failed to fetch companies" }
  }
}

// Obtener company por ID
export async function getCompanyById(id: string) {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error("Error fetching company:", error)
      return { company: null, error: error.message }
    }
    
    return { company: data as Company, error: null }
  } catch (error) {
    console.error("Error fetching company:", error)
    return { company: null, error: "Failed to fetch company" }
  }
}

// Crear company
export async function createCompany(input: CreateCompanyInput) {
  try {
    // Validar datos de entrada
    const validatedData = CreateCompanySchema.parse(input)
    const cleanedData = cleanCompanyData(validatedData)
    
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('companies')
      .insert([cleanedData])
      .select()
      .single()
    
    if (error) {
      console.error("Error creating company:", error)
      return { company: null, error: error.message }
    }
    
    return { company: data as Company, error: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { company: null, error: error.errors[0].message }
    }
    
    console.error("Error creating company:", error)
    return { company: null, error: "Failed to create company" }
  }
}

// Actualizar company
export async function updateCompany(input: UpdateCompanyInput) {
  try {
    // Validar datos de entrada
    const validatedData = UpdateCompanySchema.parse(input)
    const { id, ...updateData } = validatedData
    const cleanedData = cleanCompanyData(updateData)
    
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('companies')
      .update(cleanedData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error("Error updating company:", error)
      return { company: null, error: error.message }
    }
    
    return { company: data as Company, error: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { company: null, error: error.errors[0].message }
    }
    
    console.error("Error updating company:", error)
    return { company: null, error: "Failed to update company" }
  }
}

// Eliminar company
export async function deleteCompany(id: string) {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error("Error deleting company:", error)
      return { error: error.message }
    }
    
    return { error: null }
  } catch (error) {
    console.error("Error deleting company:", error)
    return { error: "Failed to delete company" }
  }
}

// Buscar o crear company por nombre
export async function findOrCreateCompany(name: string) {
  try {
    if (!name || !name.trim()) {
      return { company: null, error: "Company name is required" }
    }
    
    const trimmedName = name.trim()
    
    // Primero intentar encontrar la company existente
    const { companies, error: searchError } = await getCompanies(trimmedName)
    
    if (searchError) {
      return { company: null, error: searchError }
    }
    
    // Buscar coincidencia exacta (case insensitive)
    const existingCompany = companies.find(
      company => company.name.toLowerCase() === trimmedName.toLowerCase() ||
                 company.legal_name?.toLowerCase() === trimmedName.toLowerCase()
    )
    
    if (existingCompany) {
      return { company: existingCompany, error: null }
    }
    
    // Si no existe, crear una nueva
    return await createCompany({ name: trimmedName })
  } catch (error) {
    console.error("Error finding or creating company:", error)
    return { company: null, error: "Failed to find or create company" }
  }
}

// Obtener subsidiarias de una company
export async function getSubsidiaries(parentCompanyId: string) {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('parent_company_id', parentCompanyId)
      .order('name', { ascending: true })
    
    if (error) {
      console.error("Error fetching subsidiaries:", error)
      return { subsidiaries: [], error: error.message }
    }
    
    return { subsidiaries: data as Company[], error: null }
  } catch (error) {
    console.error("Error fetching subsidiaries:", error)
    return { subsidiaries: [], error: "Failed to fetch subsidiaries" }
  }
} 
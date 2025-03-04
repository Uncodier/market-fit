import { createClient } from "@/utils/supabase/client"
import { z } from "zod"

// Definir el schema de respuesta
const LeadSchema = z.object({
  leads: z.array(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    company: z.string().nullable(),
    position: z.string().nullable(),
    segment_id: z.string().nullable(),
    status: z.enum(["new", "contacted", "qualified", "converted", "lost"]),
    notes: z.string().nullable(),
    origin: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    last_contact: z.string().nullable(),
    site_id: z.string(),
    user_id: z.string()
  })).nullable(),
  error: z.string().optional()
})

export type LeadResponse = z.infer<typeof LeadSchema>

// Schema para validar los datos de entrada al crear un lead
const CreateLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  segment_id: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).default("new"),
  notes: z.string().optional(),
  origin: z.string().optional(),
  site_id: z.string().min(1, "Site ID is required"),
})

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>

// Schema para validar los datos de entrada al actualizar un lead
const UpdateLeadSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  segment_id: z.string().optional().nullable(),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]),
  notes: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
  site_id: z.string().min(1, "Site ID is required"),
})

export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>

export async function getLeads(site_id: string): Promise<LeadResponse> {
  try {
    const supabase = createClient()
    
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
        status,
        notes,
        origin,
        created_at,
        updated_at,
        last_contact,
        site_id,
        user_id
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

export async function createLead(data: CreateLeadInput): Promise<{ error?: string, lead?: any }> {
  try {
    const supabase = createClient()
    
    // Validar los datos de entrada
    const validatedData = CreateLeadSchema.parse(data)
    
    // Verificar que el site_id sea un UUID válido
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validatedData.site_id)) {
      return { error: "ID de sitio inválido" }
    }

    // Obtener el usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error("Error getting authenticated user:", authError)
      return { error: "Error de autenticación" }
    }

    if (!user) {
      return { error: "Usuario no autenticado" }
    }

    const now = new Date().toISOString()
    
    const { data: lead, error } = await supabase
      .from("leads")
      .insert([
        {
          ...validatedData,
          user_id: user.id,
          created_at: now,
          updated_at: now,
          phone: validatedData.phone || null
        }
      ])
      .select()
      .single()

    if (error) {
      if (error.code === "22P02") {
        return { error: "ID de sitio inválido" }
      }
      if (error.code === "23503") {
        return { error: "El sitio seleccionado no existe" }
      }
      if (error.code === "42501") {
        return { error: "No tienes permisos para crear leads en este sitio" }
      }
      throw error
    }

    return { lead }
  } catch (error) {
    console.error("Error creating lead:", error)
    if (error instanceof z.ZodError) {
      return { error: "Datos de entrada inválidos" }
    }
    return { error: "Error al crear el lead" }
  }
}

export async function updateLead(data: UpdateLeadInput): Promise<{ error?: string, lead?: any }> {
  try {
    const supabase = createClient()
    
    // Validar los datos de entrada
    const validatedData = UpdateLeadSchema.parse(data)
    
    // Verificar que el site_id y el lead_id sean UUID válidos
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validatedData.site_id)) {
      return { error: "ID de sitio inválido" }
    }
    
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validatedData.id)) {
      return { error: "ID de lead inválido" }
    }

    // Obtener el usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error("Error getting authenticated user:", authError)
      return { error: "Error de autenticación" }
    }

    if (!user) {
      return { error: "Usuario no autenticado" }
    }

    const now = new Date().toISOString()
    
    const { data: lead, error } = await supabase
      .from("leads")
      .update({
        ...validatedData,
        updated_at: now
      })
      .eq('id', validatedData.id)
      .eq('site_id', validatedData.site_id) // Aseguramos que el lead pertenezca al sitio
      .select()
      .single()

    if (error) {
      if (error.code === "22P02") {
        return { error: "ID inválido" }
      }
      if (error.code === "23503") {
        return { error: "El lead o el sitio seleccionado no existe" }
      }
      if (error.code === "42501") {
        return { error: "No tienes permisos para actualizar este lead" }
      }
      throw error
    }

    return { lead }
  } catch (error) {
    console.error("Error updating lead:", error)
    if (error instanceof z.ZodError) {
      return { error: "Datos de entrada inválidos" }
    }
    return { error: "Error al actualizar el lead" }
  }
} 
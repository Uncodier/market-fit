import { createClient } from "@/utils/supabase/client"
import { z } from "zod"

// Definir el schema de respuesta
const SegmentSchema = z.object({
  segments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    audience: z.string().nullable(),
    language: z.string().nullable(),
    size: z.string().nullable(),
    engagement: z.number().nullable(),
    created_at: z.string(),
    url: z.string().nullable(),
    analysis: z.record(z.string(), z.array(z.string())).nullable(),
    topics: z.object({
      blog: z.array(z.string()),
      newsletter: z.array(z.string())
    }).nullable(),
    icp: z.object({
      role: z.string().optional(),
      company_size: z.string().optional(),
      industry: z.string().optional(),
      age_range: z.string().optional(),
      pain_points: z.array(z.string()).optional(),
      goals: z.array(z.string()).optional(),
      budget: z.string().optional(),
      decision_maker: z.boolean().optional(),
      location: z.string().optional(),
      experience: z.string().optional()
    }).nullable(),
    is_active: z.boolean(),
    estimated_value: z.number().nullable()
  })).nullable(),
  error: z.string().optional()
})

export type SegmentResponse = z.infer<typeof SegmentSchema>

// Schema para validar los datos de entrada al crear un segmento
const CreateSegmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  audience: z.string(),
  language: z.string().default("en"),
  site_id: z.string().min(1, "Site ID is required"),
  icp: z.object({
    role: z.string().optional(),
    company_size: z.string().optional(),
    industry: z.string().optional(),
    age_range: z.string().optional(),
    pain_points: z.array(z.string()).optional(),
    goals: z.array(z.string()).optional(),
    budget: z.string().optional(),
    decision_maker: z.boolean().optional(),
    location: z.string().optional(),
    experience: z.string().optional()
  }).optional(),
})

export type CreateSegmentInput = z.infer<typeof CreateSegmentSchema>

export async function getSegments(site_id: string): Promise<SegmentResponse> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from("segments")
      .select(`
        id,
        name,
        description,
        audience,
        language,
        size,
        engagement,
        created_at,
        url,
        analysis,
        topics,
        icp,
        is_active,
        estimated_value
      `)
      .eq('site_id', site_id)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Si no hay datos, retornamos un array vacío en lugar de null
    return { segments: data || [] }
  } catch (error) {
    console.error("Error loading segments:", error)
    return { error: "Error al cargar los segmentos", segments: [] }
  }
}

export async function createSegment(data: CreateSegmentInput): Promise<{ error?: string, segment?: any }> {
  try {
    const supabase = createClient()
    
    // Validar los datos de entrada
    const validatedData = CreateSegmentSchema.parse(data)
    
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

    const { data: segment, error } = await supabase
      .from("segments")
      .insert([
        {
          ...validatedData,
          user_id: user.id,
          url: null, // Inicialmente null, se actualizará después
          engagement: 0, // Comienza en modo draft
          size: 0,
          analysis: {
            facebook: [],
            google: [],
            linkedin: [],
            twitter: []
          },
          topics: {
            blog: [],
            newsletter: []
          },
          icp: validatedData.icp || {
            role: "",
            company_size: "",
            industry: "",
            age_range: "",
            pain_points: [],
            goals: [],
            budget: "",
            decision_maker: false,
            location: "",
            experience: ""
          }
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
        return { error: "No tienes permisos para crear segmentos en este sitio" }
      }
      throw error
    }

    return { segment }
  } catch (error) {
    console.error("Error creating segment:", error)
    if (error instanceof z.ZodError) {
      return { error: "Datos de entrada inválidos" }
    }
    return { error: "Error al crear el segmento" }
  }
}

export async function updateSegmentUrl({ segmentId, url }: { segmentId: string, url: string }) {
  try {
    const supabase = createClient()

    // Validar que el segmentId sea un UUID válido
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segmentId)) {
      return { error: "ID de segmento inválido" }
    }

    // Validar que la URL sea válida
    try {
      new URL(url)
    } catch (e) {
      return { error: "URL inválida" }
    }

    const { data: segment, error } = await supabase
      .from("segments")
      .update({ url })
      .eq('id', segmentId)
      .select()
      .single()

    if (error) {
      if (error.code === "42501") {
        return { error: "No tienes permisos para actualizar este segmento" }
      }
      throw error
    }

    return { success: true, segment }
  } catch (error) {
    console.error('Error updating segment URL:', error)
    return { error: 'Error al actualizar la URL del segmento' }
  }
}

interface UpdateSegmentStatusParams {
  segmentId: string
  isActive: boolean
}

export async function updateSegmentStatus({ segmentId, isActive }: UpdateSegmentStatusParams) {
  try {
    const supabase = createClient()

    // Validar que el segmentId sea un UUID válido
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segmentId)) {
      return { error: "ID de segmento inválido" }
    }

    // Verificar si estamos usando un cliente mock (para desarrollo/pruebas)
    if ((supabase as any)._isMock) {
      console.log('Usando cliente mock para updateSegmentStatus')
      return { 
        success: true, 
        segment: { 
          id: segmentId, 
          is_active: isActive,
          name: "Segment Mock",
          description: "Este es un segmento simulado para desarrollo"
        } 
      }
    }

    const { data: segment, error } = await supabase
      .from("segments")
      .update({ is_active: isActive })
      .eq('id', segmentId)
      .select()
      .single()

    if (error) {
      if (error.code === "42501") {
        return { error: "No tienes permisos para actualizar este segmento" }
      }
      throw error
    }

    return { success: true, segment }
  } catch (error) {
    console.error('Error updating segment status:', error)
    return { error: 'Error al actualizar el estado del segmento' }
  }
}

export async function getSegmentById(segmentId: string): Promise<{ error?: string, segment?: any }> {
  try {
    const supabase = createClient()

    // Validar que el segmentId sea un UUID válido
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segmentId)) {
      return { error: "ID de segmento inválido" }
    }

    const { data: segment, error } = await supabase
      .from("segments")
      .select(`
        id,
        name,
        description,
        audience,
        language,
        size,
        engagement,
        created_at,
        url,
        analysis,
        topics,
        icp,
        is_active,
        estimated_value
      `)
      .eq('id', segmentId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return { error: "Segmento no encontrado" }
      }
      throw error
    }

    return { segment }
  } catch (error) {
    console.error("Error getting segment by ID:", error)
    return { error: "Error al obtener el segmento" }
  }
} 
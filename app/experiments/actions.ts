"use server"

import { createSafeAction } from "@/lib/create-safe-action"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const CreateExperimentSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().min(1, "La descripción es requerida"),
  segments: z.array(z.string()).min(1, "Debe seleccionar al menos un segmento"),
  status: z.enum(["draft", "active", "completed"]),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  conversion: z.number().nullable().optional(),
  roi: z.number().nullable().optional(),
  preview_url: z.string().optional(),
  user_id: z.string(),
  site_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

type CreateExperimentInput = z.infer<typeof CreateExperimentSchema>

export const createExperiment = createSafeAction(CreateExperimentSchema, async (data: CreateExperimentInput) => {
  const supabase = createClient()

  try {
    // Verificar que el usuario tenga acceso al sitio
    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("id, url")
      .eq("id", data.site_id)
      .eq("user_id", data.user_id)
      .single()

    if (siteError || !site) {
      return {
        error: "No tienes acceso a este sitio"
      }
    }

    // Crear el experimento
    const { data: experiment, error: experimentError } = await supabase
      .from("experiments")
      .insert({
        name: data.name,
        description: data.description,
        status: data.status,
        start_date: data.start_date,
        end_date: data.end_date,
        conversion: data.conversion,
        roi: data.roi,
        preview_url: data.preview_url || site.url,
        site_id: data.site_id,
        user_id: data.user_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .select()
      .single()

    if (experimentError) {
      return {
        error: "Error al crear el experimento: " + experimentError.message
      }
    }

    // Crear las relaciones experimento-segmento
    const segmentRelations = data.segments.map((segmentId: string) => ({
      experiment_id: experiment.id,
      segment_id: segmentId,
      created_at: new Date().toISOString(),
    }))

    const { error: segmentError } = await supabase
      .from("experiment_segments")
      .insert(segmentRelations)

    if (segmentError) {
      // Si hay error al crear las relaciones, eliminar el experimento creado
      await supabase
        .from("experiments")
        .delete()
        .eq("id", experiment.id)

      return {
        error: "Error al asignar segmentos al experimento: " + segmentError.message
      }
    }

    return { data: experiment }
  } catch (error) {
    console.error("Error creating experiment:", error)
    return {
      error: error instanceof Error ? error.message : "Error al crear el experimento"
    }
  }
}) 
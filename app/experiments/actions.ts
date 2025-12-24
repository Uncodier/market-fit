'use server'

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { experimentFormSchema } from "./schema"
import type { ExperimentFormValues } from "./schema"

export type { ExperimentFormValues } from "./schema"

export async function createExperiment(data: ExperimentFormValues) {
  const cookieStore = cookies()
  const supabase = await createClient()

  const result = experimentFormSchema.safeParse(data)
  if (!result.success) {
    return {
      error: result.error.message
    }
  }

  try {
    // Primero insertamos el experimento
    const { data: experiment, error: experimentError } = await supabase
      .from("experiments")
      .insert({
        name: data.name,
        description: data.description,
        hypothesis: data.hypothesis,
        preview_url: data.preview_url,
        status: data.status,
        start_date: data.start_date,
        end_date: data.end_date,
        conversion: data.conversion,
        roi: data.roi,
        site_id: data.site_id,
        user_id: data.user_id,
        campaign_id: data.campaign_id
      })
      .select()
      .single()

    if (experimentError) {
      return {
        error: experimentError.message
      }
    }

    // Luego insertamos las relaciones con los segmentos
    const experimentSegments = data.segments.map(segmentId => ({
      experiment_id: experiment.id,
      segment_id: segmentId
    }))

    const { error: segmentsError } = await supabase
      .from("experiment_segments")
      .insert(experimentSegments)

    if (segmentsError) {
      // Si hay error al insertar los segmentos, eliminamos el experimento
      await supabase
        .from("experiments")
        .delete()
        .eq("id", experiment.id)
      
      return {
        error: segmentsError.message
      }
    }

    revalidatePath("/experiments")
    return { data: experiment }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Error inesperado al crear el experimento"
    }
  }
}

export async function startExperiment(id: string) {
  const cookieStore = cookies()
  const supabase = await createClient()

  const { data: experiment, error } = await supabase
    .from("experiments")
    .update({ status: "active" })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return {
      error: error.message
    }
  }

  revalidatePath("/experiments")
  return { data: experiment }
}

export async function stopExperiment(id: string) {
  const cookieStore = cookies()
  const supabase = await createClient()

  const { data: experiment, error } = await supabase
    .from("experiments")
    .update({ status: "completed" })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return {
      error: error.message
    }
  }

  revalidatePath("/experiments")
  return { data: experiment }
}

export async function setExperimentStatus(id: string, status: "draft" | "active" | "completed") {
  const cookieStore = cookies()
  const supabase = await createClient()

  const { data: experiment, error } = await supabase
    .from("experiments")
    .update({ status })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return {
      error: error.message
    }
  }

  revalidatePath("/experiments")
  return { data: experiment }
} 
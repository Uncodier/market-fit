'use server'

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { type RequirementFormValues, requirementFormSchema } from "./schema"

export type { RequirementFormValues }

// Constantes para estados (duplicadas para server actions)
const REQUIREMENT_STATUS = {
  VALIDATED: "validated",
  IN_PROGRESS: "in-progress",
  ON_REVIEW: "on-review",
  DONE: "done",
  BACKLOG: "backlog",
  CANCELED: "canceled"
} as const;

const COMPLETION_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  REJECTED: "rejected"
} as const;

type RequirementStatusType = typeof REQUIREMENT_STATUS[keyof typeof REQUIREMENT_STATUS];
type CompletionStatusType = typeof COMPLETION_STATUS[keyof typeof COMPLETION_STATUS];

export async function createRequirement(data: RequirementFormValues) {
  const cookieStore = cookies()
  const supabase = await createClient()

  const result = requirementFormSchema.safeParse(data)
  if (!result.success) {
    return {
      error: result.error.message
    }
  }

  try {
    // Primero insertamos el requerimiento
    const { data: requirement, error: requirementError } = await supabase
      .from("requirements")
      .insert({
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
        completion_status: data.completionStatus,
        source: data.source,
        site_id: data.site_id,
        user_id: data.user_id,
        created_at: data.created_at,
        updated_at: data.updated_at
      })
      .select()
      .single()

    if (requirementError) {
      return {
        error: requirementError.message
      }
    }

    // Luego insertamos las relaciones con los segmentos
    const requirementSegments = data.segments.map(segmentId => ({
      requirement_id: requirement.id,
      segment_id: segmentId
    }))

    const { error: segmentsError } = await supabase
      .from("requirement_segments")
      .insert(requirementSegments)

    if (segmentsError) {
      // Si hay error al insertar los segmentos, eliminamos el requerimiento
      await supabase
        .from("requirements")
        .delete()
        .eq("id", requirement.id)
      
      return {
        error: segmentsError.message
      }
    }

    revalidatePath("/requirements")
    return { data: requirement }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Error inesperado al crear el requerimiento"
    }
  }
}

export async function updateRequirementStatus(id: string, status: RequirementStatusType) {
  const cookieStore = cookies()
  const supabase = await createClient()

  // Validar el status recibido
  if (![REQUIREMENT_STATUS.VALIDATED, REQUIREMENT_STATUS.IN_PROGRESS, REQUIREMENT_STATUS.ON_REVIEW, REQUIREMENT_STATUS.DONE, REQUIREMENT_STATUS.BACKLOG, REQUIREMENT_STATUS.CANCELED].includes(status)) {
    return {
      error: `Estado no válido: ${status}`
    }
  }

  const { data: requirement, error } = await supabase
    .from("requirements")
    .update({ status })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return {
      error: error.message
    }
  }

  revalidatePath("/requirements")
  return { data: requirement }
}

export async function updateCompletionStatus(id: string, completionStatus: CompletionStatusType) {
  const cookieStore = cookies()
  const supabase = await createClient()

  // Validar el status de finalización recibido
  if (![COMPLETION_STATUS.PENDING, COMPLETION_STATUS.COMPLETED, COMPLETION_STATUS.REJECTED].includes(completionStatus)) {
    return {
      error: `Estado de finalización no válido: ${completionStatus}`
    }
  }

  const { data: requirement, error } = await supabase
    .from("requirements")
    .update({ completion_status: completionStatus })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return {
      error: error.message
    }
  }

  revalidatePath("/requirements")
  return { data: requirement }
}

export async function updateRequirementPriority(id: string, priority: "high" | "medium" | "low") {
  const cookieStore = cookies()
  const supabase = await createClient()

  // Validar la prioridad recibida
  if (!["high", "medium", "low"].includes(priority)) {
    return {
      error: `Prioridad no válida: ${priority}`
    }
  }

  const { data: requirement, error } = await supabase
    .from("requirements")
    .update({ priority })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return {
      error: error.message
    }
  }

  revalidatePath("/requirements")
  return { data: requirement }
} 
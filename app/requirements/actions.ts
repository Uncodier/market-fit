'use server'

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { requirementFormSchema, type RequirementFormValues } from "./schema"

export type { RequirementFormValues } from "./schema"

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
        type: data.type,
        priority: data.priority,
        status: data.status,
        completion_status: data.completionStatus,
        source: data.source,
        budget: data.budget,
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

    // Insertamos las relaciones con las campañas (si existen)
    if (data.campaigns && data.campaigns.length > 0) {
      const requirementCampaigns = data.campaigns.map(campaignId => ({
        requirement_id: requirement.id,
        campaign_id: campaignId
      }))

      const { error: campaignsError } = await supabase
        .from("campaign_requirements")
        .insert(requirementCampaigns)

      if (campaignsError) {
        console.error("Error al insertar relaciones de campañas:", campaignsError)
        // No eliminamos el requerimiento si falla la relación con campañas
        // ya que la relación con segmentos ya está creada
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

export async function updateRequirementStatus(id: string, status: RequirementStatusType, cycle?: string) {
  const cookieStore = cookies()
  const supabase = await createClient()

  // Validar el status recibido
  if (![REQUIREMENT_STATUS.VALIDATED, REQUIREMENT_STATUS.IN_PROGRESS, REQUIREMENT_STATUS.ON_REVIEW, REQUIREMENT_STATUS.DONE, REQUIREMENT_STATUS.BACKLOG, REQUIREMENT_STATUS.CANCELED].includes(status)) {
    return {
      error: `Estado no válido: ${status}`
    }
  }

  const updateData: any = { status }
  if (cycle) {
    updateData.cycle = cycle
  }

  const { data: requirement, error } = await supabase
    .from("requirements")
    .update(updateData)
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

export async function updateRequirementInstructions(id: string, instructions: string) {
  const cookieStore = cookies()
  const supabase = await createClient()

  const { data: requirement, error } = await supabase
    .from("requirements")
    .update({ instructions })
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

interface UpdateRequirementData {
  id: string
  title: string
  description: string
  type: "content" | "design" | "research" | "follow_up" | "task" | "develop" | "analytics" | "testing" | "approval" | "coordination" | "strategy" | "optimization" | "automation" | "integration" | "planning" | "payment"
  priority: "high" | "medium" | "low"
  status: RequirementStatusType
  completionStatus: CompletionStatusType
  source: string
  budget: number | null
  segments: string[]
  campaigns: string[]
  campaign_id: string
  outsourceInstructions?: string
  metadata?: any
}

export async function updateRequirement(data: UpdateRequirementData) {
  const cookieStore = cookies()
  const supabase = await createClient()

  try {
    // Primero actualizamos el requerimiento principal
      const updatePayload: any = {
        title: data.title,
        description: data.description,
        type: data.type,
        priority: data.priority,
        status: data.status,
        completion_status: data.completionStatus,
        source: data.source,
        budget: data.budget,
        instructions: data.outsourceInstructions,
        updated_at: new Date().toISOString()
      };

      if (data.metadata) {
        updatePayload.metadata = data.metadata;
      }

      const { data: requirement, error: requirementError } = await supabase
        .from("requirements")
        .update(updatePayload)
      .eq("id", data.id)
      .select()
      .single()

    if (requirementError) {
      return {
        error: requirementError.message
      }
    }

    const desiredSegmentIds = [...new Set(data.segments || [])].sort()
    const { data: currentSegments, error: currentSegmentsError } = await supabase
      .from("requirement_segments")
      .select("segment_id")
      .eq("requirement_id", data.id)
    if (currentSegmentsError) {
      return { error: `Failed to read requirement segments: ${currentSegmentsError.message}` }
    }
    const currentSegmentIds = (currentSegments || [])
      .map((relation) => relation.segment_id)
      .sort()

    if (JSON.stringify(currentSegmentIds) !== JSON.stringify(desiredSegmentIds)) {
      const { error: deleteSegmentsError } = await supabase
        .from("requirement_segments")
        .delete()
        .eq("requirement_id", data.id)
      if (deleteSegmentsError) {
        return { error: `Failed to update requirement segments: ${deleteSegmentsError.message}` }
      }
      if (desiredSegmentIds.length > 0) {
        const { error: segmentsError } = await supabase
          .from("requirement_segments")
          .insert(desiredSegmentIds.map((segmentId) => ({
            requirement_id: data.id,
            segment_id: segmentId,
          })))
        if (segmentsError) {
          return { error: `Failed to update requirement segments: ${segmentsError.message}` }
        }
      }
    }

    const desiredCampaignIds = [
      ...new Set(data.campaign_id ? [data.campaign_id] : (data.campaigns || [])),
    ].sort()
    const { data: currentCampaigns, error: currentCampaignsError } = await supabase
      .from("campaign_requirements")
      .select("campaign_id")
      .eq("requirement_id", data.id)
    if (currentCampaignsError) {
      return { error: `Failed to read requirement campaigns: ${currentCampaignsError.message}` }
    }
    const currentCampaignIds = (currentCampaigns || [])
      .map((relation) => relation.campaign_id)
      .sort()

    if (JSON.stringify(currentCampaignIds) !== JSON.stringify(desiredCampaignIds)) {
      const { error: deleteCampaignsError } = await supabase
        .from("campaign_requirements")
        .delete()
        .eq("requirement_id", data.id)
      if (deleteCampaignsError) {
        return { error: `Failed to update requirement campaigns: ${deleteCampaignsError.message}` }
      }
      if (desiredCampaignIds.length > 0) {
        const { error: campaignsError } = await supabase
          .from("campaign_requirements")
          .insert(desiredCampaignIds.map((campaignId) => ({
            requirement_id: data.id,
            campaign_id: campaignId,
          })))
        if (campaignsError) {
          return { error: `Failed to update requirement campaigns: ${campaignsError.message}` }
        }
      }
    }

    revalidatePath("/requirements")
    return { data: requirement }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Error inesperado al actualizar el requerimiento"
    }
  }
}

export async function deleteRequirement(id: string) {
  const cookieStore = cookies()
  const supabase = await createClient()

  try {
    // First delete related records from requirement_segments
    const { error: segmentsError } = await supabase
      .from("requirement_segments")
      .delete()
      .eq("requirement_id", id)

    if (segmentsError) {
      return {
        error: segmentsError.message
      }
    }

    // Delete related records from campaign_requirements
    const { error: campaignsError } = await supabase
      .from("campaign_requirements")
      .delete()
      .eq("requirement_id", id)

    if (campaignsError) {
      return {
        error: campaignsError.message
      }
    }

    // Finally delete the requirement itself
    const { error: requirementError } = await supabase
      .from("requirements")
      .delete()
      .eq("id", id)

    if (requirementError) {
      return {
        error: requirementError.message
      }
    }

    revalidatePath("/requirements")
    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unexpected error deleting requirement"
    }
  }
} 
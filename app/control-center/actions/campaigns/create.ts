"use server"

import { createClient } from "@/lib/supabase/server"
import { transformCampaignData } from "../utils/transformers"
import { type CampaignFormValues } from "../../schema"

// Create a new campaign
export async function createCampaign(values: CampaignFormValues) {
  try {
    const supabase = await createClient()

    // Prepare campaign data
    const campaignInput = {
      title: values.title,
      description: values.description,
      priority: values.priority,
      status: "active",
      due_date: values.dueDate,
      type: values.type,
      site_id: values.site_id,
      user_id: values.user_id,
      assignees: 0,
      issues: 0,
      revenue: values.revenue || { actual: 0, projected: 0, estimated: 0, currency: "USD" },
      budget: values.budget || { allocated: 0, remaining: 0, currency: "USD" }
    }

    // Insert campaign
    const { data: campaignData, error: campaignError } = await supabase
      .from("campaigns")
      .insert(campaignInput)
      .select()
      .single()

    if (campaignError) {
      throw new Error(`Error creating campaign: ${campaignError.message}`)
    }

    // Link segments if provided
    if (values.segments && values.segments.length > 0) {
      const segmentRelations = values.segments.map((segmentId: string) => ({
        campaign_id: campaignData.id,
        segment_id: segmentId
      }))

      const { error: segmentError } = await supabase
        .from("campaign_segments")
        .insert(segmentRelations)

      if (segmentError) {
        console.error("Error linking segments:", segmentError)
      }
    }

    // Link requirements if provided
    if (values.requirements && values.requirements.length > 0) {
      const requirementRelations = values.requirements.map((requirementId: string) => ({
        campaign_id: campaignData.id,
        requirement_id: requirementId
      }))

      const { error: requirementError } = await supabase
        .from("campaign_requirements")
        .insert(requirementRelations)

      if (requirementError) {
        console.error("Error linking requirements:", requirementError)
      }
    }

    return { data: transformCampaignData(campaignData), error: null }
  } catch (error) {
    console.error("Error in createCampaign:", error)
    return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
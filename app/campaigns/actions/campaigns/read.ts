"use server"

import { createClient } from "@/lib/supabase/server"
import { transformCampaignData, transformSubtaskData } from "../utils/transformers"
import { Campaign } from "@/app/types"

// Get all campaigns
export async function getCampaigns(siteId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false })

    if (error) {
      throw new Error(`Error fetching campaigns: ${error.message}`)
    }

    // Transform data to our Campaign type
    const campaigns = data.map(transformCampaignData) as Campaign[]

    // For each campaign, fetch related subtasks
    for (const campaign of campaigns) {
      const { data: subtasksData, error: subtasksError } = await supabase
        .from("campaign_subtasks")
        .select("*")
        .eq("campaign_id", campaign.id)

      if (!subtasksError && subtasksData) {
        campaign.subtasks = subtasksData.map(transformSubtaskData)
      }

      // Fetch segment relations
      const { data: segmentRelations, error: segmentError } = await supabase
        .from("campaign_segments")
        .select("segment_id")
        .eq("campaign_id", campaign.id)

      if (!segmentError && segmentRelations) {
        campaign.segments = segmentRelations.map((relation: any) => relation.segment_id)
      }

      // Fetch requirement relations
      const { data: requirementRelations, error: requirementError } = await supabase
        .from("campaign_requirements")
        .select("requirement_id")
        .eq("campaign_id", campaign.id)

      if (!requirementError && requirementRelations) {
        campaign.requirements = requirementRelations.map((relation: any) => relation.requirement_id)
      }
    }

    return { data: campaigns, error: null }
  } catch (error) {
    console.error("Error in getCampaigns:", error)
    return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
}

// Get campaign by ID
export async function getCampaignById(id: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      throw new Error(`Error fetching campaign: ${error.message}`)
    }

    // Transform data to our Campaign type
    const campaign = transformCampaignData(data)

    // Fetch subtasks
    const { data: subtasksData, error: subtasksError } = await supabase
      .from("campaign_subtasks")
      .select("*")
      .eq("campaign_id", id)

    if (!subtasksError && subtasksData) {
      campaign.subtasks = subtasksData.map(transformSubtaskData)
    }

    // Fetch segment relations
    const { data: segmentRelations, error: segmentError } = await supabase
      .from("campaign_segments")
      .select("segment_id")
      .eq("campaign_id", id)

    if (!segmentError && segmentRelations) {
      campaign.segments = segmentRelations.map((relation: any) => relation.segment_id)
    }

    // Fetch requirement relations
    const { data: requirementRelations, error: requirementError } = await supabase
      .from("campaign_requirements")
      .select("requirement_id")
      .eq("campaign_id", id)

    if (!requirementError && requirementRelations) {
      campaign.requirements = requirementRelations.map((relation: any) => relation.requirement_id)
    }

    return { data: campaign, error: null }
  } catch (error) {
    console.error("Error in getCampaignById:", error)
    return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
} 
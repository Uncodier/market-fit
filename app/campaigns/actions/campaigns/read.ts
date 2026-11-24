"use server"

import { createClient } from "@/lib/supabase/server"
import { transformCampaignData, transformSubtaskData } from "../utils/transformers"
import type { Campaign, CampaignSubtaskData, CampaignData } from "@/app/types"

// Get all campaigns
export async function getCampaigns(siteId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("campaigns")
      .select(`*, campaign_subtasks(id, campaign_id, title, status, created_at, updated_at),
        campaign_segments(segment_id), campaign_requirements(requirement_id)`)
      .eq("site_id", siteId)
      .order("created_at", { ascending: false })

    if (error) {
      throw new Error(`Error fetching campaigns: ${error.message}`)
    }

    // Read children under the same user-scoped snapshot, not three more HTTP
    // requests per campaign. An embed failure fails the list rather than being
    // reported as a successful read with silently missing relations.
    type CampaignWithRelations = CampaignData & {
      campaign_subtasks: CampaignSubtaskData[]; campaign_segments: { segment_id: string }[];
      campaign_requirements: { requirement_id: string }[]
    }
    const campaigns: Campaign[] = (data as CampaignWithRelations[]).map(row => ({
      ...transformCampaignData(row), subtasks: (row.campaign_subtasks ?? []).map(transformSubtaskData),
      segments: (row.campaign_segments ?? []).map(relation => relation.segment_id),
      requirements: (row.campaign_requirements ?? []).map(relation => relation.requirement_id),
    }))

    return { data: campaigns, error: null }
  } catch (error) {
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
    const isNetworkError =
      msg.includes("fetch failed") ||
      msg.includes("failed to fetch") ||
      msg.includes("network") ||
      msg.includes("econnrefused") ||
      msg.includes("enotfound") ||
      msg.includes("etimedout") ||
      msg.includes("econnreset")
    if (isNetworkError) {
      console.warn("Campaigns fetch failed (network):", msg)
    } else {
      console.error("Error in getCampaigns:", error)
    }
    return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" }
  }
}

// Get campaign by ID
export async function getCampaignById(id: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("campaigns")
      .select("*, metadata")
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
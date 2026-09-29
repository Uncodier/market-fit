"use server"

import { createClient } from "@/lib/supabase/server"
import { requestServerVoiceAgentResync } from "@/app/agents/server-voice-sync"
import { getCurrentUserSiteRole } from "@/lib/auth/api-site-access"
import { buildAiCampaignBrief } from "../../ai-requirement"
import { campaignFormSchema, type CampaignFormValues } from "../../schema"

// Create a new campaign

export async function findOrCreateCampaign(site_id: string, title: string) {
  try {
    if (!title || !title.trim()) return { campaign: null, error: "Title is required" }
    const trimmed = title.trim()

    const supabase = await createClient()
    const { data: existing, error: searchError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("site_id", site_id)
      .ilike("title", trimmed)
      .limit(1)
      .single()

    if (existing) return { campaign: existing, error: null }
    if (searchError && searchError.code !== "PGRST116") {
      return { campaign: null, error: searchError.message }
    }

    const { data: userAuth } = await supabase.auth.getUser()

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert([{
        site_id,
        user_id: userAuth?.user?.id || null,
        title: trimmed,
        type: "other",
        status: "active",
        priority: "medium",
        revenue: { actual: 0, projected: 0, estimated: 0, currency: "USD" },
        budget: { allocated: 0, remaining: 0, currency: "USD" }
      }])
      .select()
      .single()

    if (!error) await requestServerVoiceAgentResync(site_id)
    return { campaign, error: error?.message || null }
  } catch (error: any) {
    console.error("Error finding or creating campaign:", error)
    return { campaign: null, error: error.message || "Failed to find or create campaign" }
  }
}

export async function createCampaign(values: CampaignFormValues) {
  try {
    const parsed = campaignFormSchema.safeParse(values)
    if (!parsed.success) return { data: null, error: "Invalid campaign details" }

    const input = parsed.data
    const supabase = await createClient(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { data: null, error: "Unauthorized" }
    if (!await getCurrentUserSiteRole(supabase, input.site_id)) {
      return { data: null, error: "Forbidden" }
    }

    const segmentIds = [...new Set(input.segments || [])]
    let segments: Array<{ id: string; name: string }> = []
    if (segmentIds.length) {
      const { data, error } = await supabase
        .from("segments")
        .select("id, name")
        .eq("site_id", input.site_id)
        .in("id", segmentIds)
      if (error || !data || data.length !== segmentIds.length) {
        return { data: null, error: "Invalid target segments for this site" }
      }
      segments = data
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || "",
        priority: input.priority,
        status: "active",
        due_date: input.dueDate || null,
        type: input.type,
        site_id: input.site_id,
        user_id: user.id,
        assignees: 0,
        issues: 0,
        revenue: input.revenue || { actual: 0, projected: 0, estimated: 0, currency: "USD" },
        budget: input.budget || { allocated: 0, remaining: 0, currency: "USD" },
      })
      .select("id")
      .single()
    if (campaignError || !campaign) {
      return { data: null, error: "Could not create campaign" }
    }

    let requirementId: string | null = null
    try {
      if (segmentIds.length) {
        const { error } = await supabase.from("campaign_segments").insert(
          segmentIds.map((segmentId) => ({ campaign_id: campaign.id, segment_id: segmentId }))
        )
        if (error) throw new Error("Could not link campaign segments")
      }

      if (input.createWithAi) {
        const segmentNames = segmentIds.map((id) => segments.find((segment) => segment.id === id)!.name)
        const brief = buildAiCampaignBrief(input, segmentNames)
        const { data: requirement, error } = await supabase
          .from("requirements")
          .insert({
            title: `Campaign: ${input.title.trim()}`,
            description: brief,
            instructions: brief,
            type: "campaign",
            priority: input.priority,
            status: "in-progress",
            completion_status: "pending",
            cycle: new Date().toISOString(),
            source: "Campaign",
            budget: input.budget?.allocated ?? 0,
            site_id: input.site_id,
            user_id: user.id,
          })
          .select("id")
          .single()
        if (error || !requirement) throw new Error("Could not create AI campaign requirement")
        requirementId = requirement.id

        if (segmentIds.length) {
          const { error: segmentError } = await supabase.from("requirement_segments").insert(
            segmentIds.map((segmentId) => ({ requirement_id: requirement.id, segment_id: segmentId }))
          )
          if (segmentError) throw new Error("Could not link requirement segments")
        }

        const { error: relationError } = await supabase.from("campaign_requirements").insert({
          campaign_id: campaign.id,
          requirement_id: requirement.id,
        })
        if (relationError) throw new Error("Could not link AI campaign requirement")
      }
    } catch (error) {
      // The UI must not report success if the AI work item cannot be created.
      // Compensate for the separate RLS-backed inserts when possible.
      const cleanupErrors: unknown[] = []
      if (requirementId) {
        const relation = await supabase.from("campaign_requirements").delete().eq("requirement_id", requirementId)
        const segments = await supabase.from("requirement_segments").delete().eq("requirement_id", requirementId)
        const requirement = await supabase.from("requirements").delete().eq("id", requirementId).eq("site_id", input.site_id)
        cleanupErrors.push(relation.error, segments.error, requirement.error)
      }
      const campaignSegments = await supabase.from("campaign_segments").delete().eq("campaign_id", campaign.id)
      const campaignDelete = await supabase.from("campaigns").delete().eq("id", campaign.id).eq("site_id", input.site_id)
      cleanupErrors.push(campaignSegments.error, campaignDelete.error)
      if (cleanupErrors.some(Boolean)) {
        console.error("Campaign creation cleanup failed", cleanupErrors.filter(Boolean))
        return { data: null, error: `Campaign ${campaign.id} could not be completed or rolled back. Check it before retrying.` }
      }
      return { data: null, error: error instanceof Error ? error.message : "Could not finish creating campaign" }
    }

    await requestServerVoiceAgentResync(input.site_id)
    return { data: { id: campaign.id }, error: null }
  } catch (error) {
    console.error("Error in createCampaign:", error)
    return { data: null, error: "Could not create campaign" }
  }
}
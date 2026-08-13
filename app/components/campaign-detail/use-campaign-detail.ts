"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Campaign, CampaignStatus } from "@/app/types"
import { getCampaignById } from "@/app/campaigns/actions/campaigns/read"
import { updateCampaign } from "@/app/campaigns/actions/campaigns/update"
import { deleteCampaign } from "@/app/campaigns/actions/campaigns/delete"
import { getLeadsByCampaignId } from "@/app/leads/actions"
import { getSegments } from "@/app/segments/actions"
import { createRequirement } from "@/app/requirements/actions"
import { createClient } from "@/lib/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import { Lead } from "@/app/leads/types"
import { CampaignRequirementFormValues } from "@/app/components/create-requirement-dialog-for-campaign"

export type CampaignSegmentOption = { id: string; name: string; description: string | null }

function resolveSegments(
  segmentIds: string[] | undefined,
  siteSegments: Array<{ id: string; name: string }>
): CampaignSegmentOption[] {
  if (!segmentIds?.length) return []
  return segmentIds
    .filter((id) => !id.startsWith("s-"))
    .map((id) => {
      const match = siteSegments.find((segment) => segment.id === id)
      return {
        id,
        name: match?.name || `Segment ${id.substring(0, 8)}`,
        description: null,
      }
    })
}

async function fetchCampaignRequirements(campaignId: string) {
  const supabase = createClient()
  const { data: relationData, error: relationError } = await supabase
    .from("campaign_requirements")
    .select(`
      requirement_id,
      requirements:requirement_id (
        id, title, description, type, priority, status, completion_status, budget, created_at
      )
    `)
    .eq("campaign_id", campaignId)

  if (relationError) throw new Error(relationError.message)
  if (!relationData?.length) return []

  const requirementsData = relationData
    .map((relation: { requirements: unknown }) => relation.requirements)
    .filter(Boolean) as Array<{ id: string }>

  return Promise.all(
    requirementsData.map(async (req) => {
      const { data: segmentRelations } = await supabase
        .from("requirement_segments")
        .select("segment_id")
        .eq("requirement_id", req.id)

      if (!segmentRelations?.length) return req

      const segmentIds = segmentRelations.map((row: { segment_id: string }) => row.segment_id)
      const { data: segmentData } = await supabase.from("segments").select("name").in("id", segmentIds)
      return { ...req, segmentNames: segmentData?.map((segment: { name: string }) => segment.name) || [] }
    })
  )
}

export function useCampaignDetail(campaignId: string | undefined) {
  const router = useRouter()
  const { currentSite } = useSite()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [campaignLeads, setCampaignLeads] = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [siteSegments, setSiteSegments] = useState<Array<{ id: string; name: string }>>([])
  const [campaignSegments, setCampaignSegments] = useState<CampaignSegmentOption[]>([])
  const [campaignRequirements, setCampaignRequirements] = useState<any[]>([])
  const [loadingRequirements, setLoadingRequirements] = useState(false)

  const loadLeads = useCallback(async (id: string) => {
    if (!currentSite?.id) return
    setLoadingLeads(true)
    try {
      const result = await getLeadsByCampaignId(id, currentSite.id)
      if (result.error) return
      setCampaignLeads(result.leads || [])
    } finally {
      setLoadingLeads(false)
    }
  }, [currentSite?.id])

  const loadRequirements = useCallback(async (id: string) => {
    setLoadingRequirements(true)
    try {
      setCampaignRequirements(await fetchCampaignRequirements(id))
    } catch (error) {
      console.error("Error loading requirements:", error)
    } finally {
      setLoadingRequirements(false)
    }
  }, [])

  useEffect(() => {
    if (!campaignId || !currentSite?.id) return

    document.title = "Campaign Details | Market Fit"
    window.dispatchEvent(
      new CustomEvent("breadcrumb:update", {
        detail: { title: "Campaign Details", path: `/campaigns/${campaignId}`, section: "campaigns" },
      })
    )

    const load = async () => {
      setLoading(true)
      try {
        const segmentsResult = await getSegments(currentSite.id)
        const formattedSegments = (segmentsResult.segments || []).map((segment: { id: string; name?: string }) => ({
          id: segment.id,
          name: segment.name || "Unnamed Segment",
        }))
        setSiteSegments(formattedSegments)

        const response = await getCampaignById(campaignId)
        if (!response?.data) {
          toast.error("Campaign not found")
          router.push("/campaigns")
          return
        }

        setCampaign(response.data)
        setCampaignSegments(resolveSegments(response.data.segments, formattedSegments))
        document.title = `${response.data.title} | Campaigns`
        window.dispatchEvent(
          new CustomEvent("breadcrumb:update", {
            detail: { title: response.data.title, path: `/campaigns/${campaignId}`, section: "campaigns" },
          })
        )

        await Promise.all([loadLeads(response.data.id), loadRequirements(response.data.id)])
      } catch (error) {
        console.error("Error fetching campaign:", error)
        toast.error("Failed to load campaign")
        router.push("/campaigns")
      } finally {
        setLoading(false)
      }
    }

    void load()

    return () => {
      document.title = "Campaigns | Market Fit"
      window.dispatchEvent(
        new CustomEvent("breadcrumb:update", {
          detail: { title: null, path: null, section: "campaigns" },
        })
      )
    }
  }, [campaignId, currentSite?.id, loadLeads, loadRequirements, router])

  const handleUpdateCampaign = async (data: Record<string, unknown>) => {
    if (!campaign?.id || !campaignId) {
      toast.error("Campaign ID is missing")
      throw new Error("Campaign ID is missing")
    }

    const updateData: Parameters<typeof updateCampaign>[1] = {}
    if (data.title !== undefined) updateData.title = data.title as string
    if (data.description !== undefined) updateData.description = data.description as string
    if (data.priority !== undefined) updateData.priority = data.priority as Campaign["priority"]
    if (data.status !== undefined) {
      updateData.status = data.status === "draft" ? "active" : (data.status as CampaignStatus)
    }
    if (data.type !== undefined) updateData.type = data.type as string
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate as string
    if (data.budget !== undefined) updateData.budget = data.budget
    if (data.revenue !== undefined) updateData.revenue = data.revenue
    if (data.segments !== undefined) {
      updateData.segments = Array.isArray(data.segments) ? (data.segments as string[]) : []
    }

    const result = await updateCampaign(campaignId, updateData)
    if (result.error || !result.data) {
      toast.error(result.error || "Failed to update campaign")
      throw new Error(result.error || "Failed to update campaign")
    }

    setCampaign((previous) => {
      if (!previous) return null
      return {
        ...previous,
        ...result.data,
        segments: Array.isArray(result.data.segments) ? result.data.segments : previous.segments || [],
        requirements: Array.isArray(result.data.requirements) ? result.data.requirements : previous.requirements || [],
      }
    })

    if (Array.isArray(result.data.segments)) {
      setCampaignSegments(resolveSegments(result.data.segments, siteSegments))
    }
  }

  const handleStatusChange = async (status: CampaignStatus) => {
    if (!campaign?.id) return
    try {
      await handleUpdateCampaign({ status })
      toast.success(`Campaign marked as ${status}`)
    } catch {
      // Error already surfaced by handleUpdateCampaign
    }
  }

  const handleDeleteCampaign = async () => {
    if (!campaignId) return
    const result = await deleteCampaign(campaignId)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Campaign deleted successfully")
    router.push("/campaigns")
  }

  const handleCreateRequirement = async (values: CampaignRequirementFormValues) => {
    if (!values.campaign_id) return { error: "Missing campaign ID" }
    const result = await createRequirement({
      ...values,
      segments: campaignSegments.map((segment) => segment.id),
      campaigns: [values.campaign_id],
      source: "Campaign",
    } as any)

    if (result.data && !result.error && campaign?.id) {
      await loadRequirements(campaign.id)
      if (result.data.id) {
        setCampaign((previous) =>
          previous
            ? { ...previous, requirements: [...(previous.requirements || []), result.data.id] }
            : previous
        )
      }
    }
    return result
  }

  return {
    campaign,
    loading,
    campaignLeads,
    loadingLeads,
    siteSegments,
    campaignRequirements,
    loadingRequirements,
    handleUpdateCampaign,
    handleStatusChange,
    handleDeleteCampaign,
    handleCreateRequirement,
    reloadLeads: () => campaign?.id && loadLeads(campaign.id),
    reloadRequirements: () => campaign?.id && loadRequirements(campaign.id),
  }
}

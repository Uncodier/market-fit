"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { getContentById } from "../../actions"
import { getContentTypeName } from "../../utils"
import type {
  CampaignOption,
  ContentEditForm,
  EditFormSetter,
  SegmentOption,
} from "../content-item-types"

type Options = {
  contentId: string
  setEditForm: EditFormSetter
}

export function useContentData({ contentId, setEditForm }: Options) {
  const [content, setContent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [segments, setSegments] = useState<SegmentOption[]>([])

  const loadRelations = useCallback(async (
    siteId: string,
    campaignId?: string | null,
    segmentId?: string | null,
  ) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, title, description")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
      if (error) {
        console.error("Failed to load campaigns:", error.message)
      } else if (data) {
        const campaignOptions: CampaignOption[] = (
          data as Array<{
            id: string
            title: string
            description?: string | null
          }>
        ).map((campaign) => ({
          id: campaign.id,
          title: campaign.title,
          description: campaign.description ?? undefined,
        }))
        setCampaigns(campaignOptions)
        const selected = campaignOptions.find(
          (campaign) => campaign.id === campaignId,
        )
        if (selected) {
          setEditForm((previous) => ({
            ...previous,
            campaignValue: { mode: "existing", id: selected.id, label: selected.title },
          }))
        }
      }
    } catch (error) {
      console.error("Error loading campaigns:", error)
    }

    try {
      const { data, error } = await supabase
        .from("segments")
        .select("id, name")
        .eq("site_id", siteId)
      if (error) {
        console.error("Failed to load segments:", error.message)
      } else if (data) {
        const segmentOptions: SegmentOption[] = (
          data as Array<{
            id: string
            name: string
          }>
        ).map((segment) => ({
          id: segment.id,
          name: segment.name,
        }))
        setSegments(segmentOptions)
        const selected = segmentOptions.find(
          (segment) => segment.id === segmentId,
        )
        if (selected) {
          setEditForm((previous) => ({
            ...previous,
            segmentValue: { mode: "existing", id: selected.id, label: selected.name },
          }))
        }
      }
    } catch (error) {
      console.error("Error loading segments:", error)
    }
  }, [setEditForm])

  const loadContent = useCallback(async () => {
    setIsLoading(true)
    try {
      const { content: contentData, error } = await getContentById(contentId)
      if (error) {
        toast.error(error)
        return
      }
      if (!contentData) {
        toast.error("Content not found")
        return
      }

      setContent(contentData)
      const sourceText = contentData.text || contentData.content || ""
      const nextForm: ContentEditForm = {
        title: contentData.title,
        description: contentData.description || "",
        content: contentData.content || "",
        text: contentData.text || "",
        instructions: contentData.instructions || "",
        type: contentData.type,
        segment_id: contentData.segment_id || "",
        campaign_id: contentData.campaign_id || "",
        tags: contentData.tags || [],
        word_count: sourceText.trim().split(/\s+/).filter(Boolean).length,
        char_count: sourceText.length,
        performance_rating: contentData.performance_rating,
        status: contentData.status || "draft",
        segmentValue: contentData.segment_id
          ? { mode: "existing", id: contentData.segment_id, label: "Loading..." }
          : null,
        campaignValue: contentData.campaign_id
          ? { mode: "existing", id: contentData.campaign_id, label: "Loading..." }
          : null,
      }
      setEditForm(nextForm)

      if (contentData.site_id) {
        await loadRelations(
          contentData.site_id,
          contentData.campaign_id,
          contentData.segment_id,
        )
      }
    } catch (error) {
      console.error("Unexpected error loading content:", error)
      toast.error("Failed to load content")
    } finally {
      setIsLoading(false)
    }
  }, [contentId, loadRelations, setEditForm])

  useEffect(() => {
    void loadContent()
  }, [loadContent])

  useEffect(() => {
    if (!content) return
    document.title = `${content.title} | Content`
    const event = new CustomEvent("breadcrumb:update", {
      detail: {
        title: `${content.title} | ${getContentTypeName(content.type)}`,
        path: `/content/${content.id}`,
        section: "content",
        contentData: { ...content },
      },
    })
    const timer = setTimeout(() => window.dispatchEvent(event), 100)
    return () => {
      clearTimeout(timer)
      document.title = "Content | Market Fit"
    }
  }, [content])

  return {
    content,
    setContent,
    isLoading,
    campaigns,
    segments,
    loadContent,
  }
}

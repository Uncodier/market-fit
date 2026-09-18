"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { updateContent, updateContentStatus } from "../../actions"
import type { ContentEditForm } from "../content-item-types"
import { htmlToMarkdown } from "../content-item-utils"

type Options = {
  content: any
  editForm: ContentEditForm
  currentSiteId?: string
  loadContent: () => Promise<void>
  setHasUserMadeChanges: (changed: boolean) => void
}

export function useContentSave({
  content,
  editForm,
  currentSiteId,
  loadContent,
  setHasUserMadeChanges,
}: Options) {
  const [isSaving, setIsSaving] = useState(false)

  const saveContent = useCallback(async () => {
    if (!content || !currentSiteId) return
    setIsSaving(true)

    try {
      let resolvedSegmentId = editForm.segment_id
      if (editForm.segmentValue !== undefined) {
        const result = await resolveRelationId("segment", editForm.segmentValue, currentSiteId)
        if (result.error) throw new Error(result.error)
        resolvedSegmentId = result.id || ""
      }

      let resolvedCampaignId = editForm.campaign_id
      if (editForm.campaignValue !== undefined) {
        const result = await resolveRelationId("campaign", editForm.campaignValue, currentSiteId)
        if (result.error) throw new Error(result.error)
        resolvedCampaignId = result.id || ""
      }

      const result = await updateContent({
        contentId: content.id,
        title: editForm.title,
        description: editForm.description || undefined,
        type: content.type,
        segment_id: resolvedSegmentId || null,
        campaign_id: resolvedCampaignId || null,
        tags: editForm.tags.length > 0 ? editForm.tags : null,
        content: htmlToMarkdown(editForm.content) || undefined,
        text: htmlToMarkdown(editForm.content) || undefined,
        instructions: htmlToMarkdown(editForm.instructions) || undefined,
        performance_rating: editForm.performance_rating,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }

      if (content.status !== editForm.status) {
        const statusResult = await updateContentStatus({
          contentId: content.id,
          status: editForm.status as any,
        })
        if (statusResult.error) {
          toast.error(statusResult.error)
          return
        }
      }

      setHasUserMadeChanges(false)
      toast.success("Content updated successfully")
      await loadContent()
    } catch (error) {
      console.error("Error updating content:", error)
      toast.error("Failed to update content")
    } finally {
      setIsSaving(false)
    }
  }, [
    content,
    currentSiteId,
    editForm,
    loadContent,
    setHasUserMadeChanges,
  ])

  return { isSaving, saveContent }
}

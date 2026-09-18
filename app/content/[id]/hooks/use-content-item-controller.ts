"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { deleteContent } from "../../actions"
import { haveTagsChanged } from "../../utils"
import {
  EMPTY_CONTENT_EDIT_FORM,
  type ContentActiveTab,
} from "../content-item-types"
import { useContentData } from "./use-content-data"
import { useContentEditors } from "./use-content-editors"
import { useContentGeneration } from "./use-content-generation"
import { useContentPublishing } from "./use-content-publishing"
import { useContentSave } from "./use-content-save"

export function useContentItemController(contentId: string) {
  const router = useRouter()
  const [editForm, setEditForm] = useState(EMPTY_CONTENT_EDIT_FORM)
  const [activeTab, setActiveTab] = useState<ContentActiveTab>("copy")
  const [hasUserMadeChanges, setHasUserMadeChanges] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [assetsRefreshTrigger, setAssetsRefreshTrigger] = useState(0)

  const data = useContentData({ contentId, setEditForm })
  const editors = useContentEditors({
    activeTab,
    content: data.content,
    setEditForm,
    setHasUserMadeChanges,
  })
  const publishing = useContentPublishing(data.content, data.loadContent)

  const hasUnsavedChanges = useCallback(() => {
    if (!data.content || !editors.editorsReady) return false
    return (
      editForm.title !== data.content.title ||
      editForm.description !== (data.content.description || "") ||
      editForm.segment_id !== (data.content.segment_id || "") ||
      editForm.campaign_id !== (data.content.campaign_id || "") ||
      haveTagsChanged(editForm.tags, data.content.tags) ||
      editForm.performance_rating !== data.content.performance_rating ||
      editForm.status !== (data.content.status || "draft") ||
      hasUserMadeChanges
    )
  }, [data.content, editForm, editors.editorsReady, hasUserMadeChanges])

  const saving = useContentSave({
    content: data.content,
    editForm,
    currentSiteId: publishing.currentSite?.id,
    loadContent: data.loadContent,
    setHasUserMadeChanges,
  })
  const generation = useContentGeneration({
    content: data.content,
    editForm,
    setEditForm,
    activeTab,
    editor: editors.editor,
    instructionsEditor: editors.instructionsEditor,
    hasUnsavedChanges,
    saveContent: saving.saveContent,
    loadContent: data.loadContent,
    setHasUserMadeChanges,
  })

  const handleDeleteContent = async () => {
    if (!data.content?.id) return
    try {
      const result = await deleteContent(data.content.id)
      if (result.error) throw new Error(result.error)
      toast.success("Content deleted successfully")
      router.push("/content")
    } catch (error) {
      console.error("Error deleting content:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete content")
    }
  }

  return {
    ...data,
    ...editors,
    ...saving,
    ...generation,
    ...publishing,
    editForm,
    setEditForm,
    activeTab,
    setActiveTab,
    setHasUserMadeChanges,
    hasUnsavedChanges,
    uploadDialogOpen,
    setUploadDialogOpen,
    assetsRefreshTrigger,
    refreshAssets: () => setAssetsRefreshTrigger((value) => value + 1),
    handleDeleteContent,
  }
}

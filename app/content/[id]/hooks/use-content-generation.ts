"use client"

import { useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import { toast } from "sonner"
import {
  CONTENT_GENERATION_UNCONFIRMED,
  contentGenerationResultSchema,
} from "@/app/api/agents/copywriter/content-editor/contract"
import { markdownToHTML } from "../../utils"
import type {
  ContentActiveTab,
  ContentEditForm,
  EditFormSetter,
} from "../content-item-types"
import { DEFAULT_CONTENT_STYLE } from "../content-item-types"
import { mapContentStyleToApi } from "../content-item-utils"

type Options = {
  content: { id: string; site_id: string } | null
  editForm: ContentEditForm
  setEditForm: EditFormSetter
  activeTab: ContentActiveTab
  editor: Editor | null
  instructionsEditor: Editor | null
  hasUnsavedChanges: () => boolean
  saveContent: () => Promise<void>
  loadContent: () => Promise<void>
  setHasUserMadeChanges: (changed: boolean) => void
}

export function useContentGeneration({
  content,
  editForm,
  setEditForm,
  editor,
  hasUnsavedChanges,
  saveContent,
  loadContent,
  setHasUserMadeChanges,
}: Options) {
  const [isGenerating, setIsGenerating] = useState(false)
  const generationInFlight = useRef(false)
  const [contentStyle, setContentStyle] = useState(DEFAULT_CONTENT_STYLE)
  const [expertise, setExpertise] = useState("")
  const [interests, setInterests] = useState("")
  const [topicsToAvoid, setTopicsToAvoid] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")

  const generateContent = async (quickAction?: string) => {
    if (generationInFlight.current) return
    if (!content?.id || !content?.site_id) {
      toast.error("Content ID or site ID not available")
      return
    }

    generationInFlight.current = true
    setIsGenerating(true)
    let failureMessage = CONTENT_GENERATION_UNCONFIRMED
    try {
      if (hasUnsavedChanges()) {
        failureMessage = "Failed to save changes before generating content"
        await saveContent()
        setHasUserMadeChanges(false)
        failureMessage = CONTENT_GENERATION_UNCONFIRMED
      }
      const response = await fetch(
        "/api/agents/copywriter/content-editor",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(120_000),
          body: JSON.stringify({
            contentId: content.id,
            siteId: content.site_id,
            segmentId: editForm.segment_id || undefined,
            campaignId: editForm.campaign_id || undefined,
            quickAction,
            styleControls: mapContentStyleToApi(contentStyle),
            whatImGoodAt: expertise || undefined,
            topicsImInterestedIn: interests || undefined,
            topicsToAvoid: topicsToAvoid || undefined,
            aiPrompt: aiPrompt || undefined,
          }),
        },
      )

      if (!response.ok) {
        if (response.status === 401) failureMessage = "Please sign in again to generate content."
        if (response.status === 403) failureMessage = "You do not have permission to generate this content."
        throw new Error(failureMessage)
      }

      const result = contentGenerationResultSchema.safeParse(await response.json())
      if (!result.success || result.data.data.contentId !== content.id || result.data.data.siteId !== content.site_id) {
        throw new Error(CONTENT_GENERATION_UNCONFIRMED)
      }

      const generated = result.data.data.edited_content
      // This API updates copy, title and description, never editing instructions.
      await loadContent()
      const html = markdownToHTML(generated.text)
      editor?.commands.setContent(html, { emitUpdate: false })
      const text = editor?.getText() ?? generated.text
      setEditForm((previous) => ({
        ...previous,
        title: generated.title,
        description: generated.description ?? "",
        content: editor?.getHTML() ?? html,
        text,
        word_count: text.trim().split(/\s+/).filter(Boolean).length,
        char_count: text.length,
      }))
      setHasUserMadeChanges(false)
      toast.success("Content generated successfully")
    } catch {
      toast.error(failureMessage)
    } finally {
      generationInFlight.current = false
      setIsGenerating(false)
    }
  }

  return {
    isGenerating,
    contentStyle,
    setContentStyle,
    expertise,
    setExpertise,
    interests,
    setInterests,
    topicsToAvoid,
    setTopicsToAvoid,
    aiPrompt,
    setAiPrompt,
    generateContent,
  }
}

"use client"

import { useState } from "react"
import { toast } from "sonner"
import type {
  ContentActiveTab,
  ContentEditForm,
  EditFormSetter,
} from "../content-item-types"
import { DEFAULT_CONTENT_STYLE } from "../content-item-types"
import {
  FULL_API_SERVER_URL,
  mapContentStyleToApi,
} from "../content-item-utils"

type Options = {
  content: any
  editForm: ContentEditForm
  setEditForm: EditFormSetter
  activeTab: ContentActiveTab
  editor: any
  instructionsEditor: any
  hasUnsavedChanges: () => boolean
  saveContent: () => Promise<void>
  loadContent: () => Promise<void>
  setHasUserMadeChanges: (changed: boolean) => void
}

export function useContentGeneration({
  content,
  editForm,
  setEditForm,
  activeTab,
  editor,
  instructionsEditor,
  hasUnsavedChanges,
  saveContent,
  loadContent,
  setHasUserMadeChanges,
}: Options) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [contentStyle, setContentStyle] = useState(DEFAULT_CONTENT_STYLE)
  const [expertise, setExpertise] = useState("")
  const [interests, setInterests] = useState("")
  const [topicsToAvoid, setTopicsToAvoid] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")

  const generateContent = async (quickAction?: string) => {
    if (!content?.id || !content?.site_id) {
      toast.error("Content ID or site ID not available")
      return
    }

    if (hasUnsavedChanges()) {
      try {
        await saveContent()
        setHasUserMadeChanges(false)
      } catch (error) {
        console.error("Error saving before generation:", error)
        toast.error("Failed to save changes before generating content")
        return
      }
    }

    setIsGenerating(true)
    try {
      const response = await fetch(
        `${FULL_API_SERVER_URL}/api/agents/copywriter/content-editor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          mode: "cors",
          body: JSON.stringify({
            contentId: content.id,
            siteId: content.site_id,
            segmentId: editForm.segment_id || undefined,
            campaignId: editForm.campaign_id || undefined,
            userId: undefined,
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
        const details = await response.text()
        throw new Error(
          `Error generating content: ${response.status} ${response.statusText}. ${details}`,
        )
      }

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      if (data.content) {
        if ((activeTab === "copy" || activeTab === "ai") && editor) {
          editor.commands.setContent(data.content)
          setEditForm((previous) => ({
            ...previous,
            content: data.content,
            text: editor.getText(),
          }))
        } else if (activeTab === "instructions" && instructionsEditor) {
          instructionsEditor.commands.setContent(data.content)
          setEditForm((previous) => ({
            ...previous,
            instructions: data.content,
          }))
        }
        toast.success("Content generated successfully")
      } else if (data.message) {
        toast.success(data.message)
      } else {
        toast.success("Content generation request processed")
        setTimeout(() => void loadContent(), 2000)
      }
    } catch (error) {
      console.error("Error generating content:", error)
      toast.error(error instanceof Error ? error.message : "Failed to generate content")
    } finally {
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

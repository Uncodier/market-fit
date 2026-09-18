import type { Dispatch, SetStateAction } from "react"
import type { RelationSelectValue } from "@/app/components/ui/relation-select"

export type ContentActiveTab = "copy" | "instructions" | "ai"

export type ContentEditForm = {
  title: string
  description: string
  content: string
  text: string
  instructions: string
  type: string
  segmentValue: RelationSelectValue
  campaignValue: RelationSelectValue
  segment_id: string
  campaign_id: string
  tags: string[]
  word_count: number
  char_count: number
  performance_rating: number | null
  status: string
}

export type ContentStyle = {
  tone: number
  complexity: number
  creativity: number
  persuasiveness: number
  targetAudience: number
  engagement: number
  size: number
}

export type CampaignOption = {
  id: string
  title: string
  description?: string
}

export type SegmentOption = {
  id: string
  name: string
}

export type EditFormSetter = Dispatch<SetStateAction<ContentEditForm>>
export type ContentStyleSetter = Dispatch<SetStateAction<ContentStyle>>

export const EMPTY_CONTENT_EDIT_FORM: ContentEditForm = {
  title: "",
  description: "",
  content: "",
  text: "",
  instructions: "",
  type: "",
  segmentValue: null,
  campaignValue: null,
  segment_id: "",
  campaign_id: "",
  tags: [],
  word_count: 0,
  char_count: 0,
  performance_rating: null,
  status: "draft",
}

export const DEFAULT_CONTENT_STYLE: ContentStyle = {
  tone: 50,
  complexity: 50,
  creativity: 50,
  persuasiveness: 50,
  targetAudience: 50,
  engagement: 50,
  size: 50,
}

export interface Segment {
  id: string
  name: string
  description: string
}

export const REQUIREMENT_STATUS = {
  VALIDATED: "validated",
  IN_PROGRESS: "in-progress",
  ON_REVIEW: "on-review",
  DONE: "done",
  BACKLOG: "backlog",
  CANCELED: "canceled",
} as const

export const COMPLETION_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  REJECTED: "rejected",
} as const

export type RequirementStatusType = typeof REQUIREMENT_STATUS[keyof typeof REQUIREMENT_STATUS]
export type CompletionStatusType = typeof COMPLETION_STATUS[keyof typeof COMPLETION_STATUS]
export type RequirementPriority = "high" | "medium" | "low"
export type RequirementType =
  | "app"
  | "automation"
  | "presentation"
  | "document"
  | "campaign"
  | "image"
  | "video"
  | "audio"
  | "report"
  | "message"
  | "segment"
  | "task"
  | "website"

export interface Requirement {
  id: string
  title: string
  description: string
  type: RequirementType
  priority: RequirementPriority
  status: RequirementStatusType
  completionStatus: CompletionStatusType
  source: string
  campaigns?: string[]
  campaignNames?: string[]
  budget: number | null
  createdAt: string
  segments: string[]
  segmentNames?: string[]
  metadata?: {
    payment_status?: {
      status?: "pending" | "paid" | "failed"
      outsourced?: boolean
    }
  }
  campaignOutsourced?: boolean
}

export const REQUIREMENT_TYPE_LABELS: Record<RequirementType, { key: string; fallback: string }> = {
  app: { key: "requirements.type.app", fallback: "App" },
  automation: { key: "requirements.type.automation", fallback: "Automation" },
  presentation: { key: "requirements.type.presentation", fallback: "Presentation" },
  document: { key: "requirements.type.document", fallback: "Document" },
  campaign: { key: "requirements.type.campaign", fallback: "Campaign" },
  image: { key: "requirements.type.image", fallback: "Image" },
  video: { key: "requirements.type.video", fallback: "Video" },
  audio: { key: "requirements.type.audio", fallback: "Audio" },
  report: { key: "requirements.type.report", fallback: "Report" },
  message: { key: "requirements.type.message", fallback: "Message" },
  segment: { key: "requirements.type.segment", fallback: "Segment" },
  task: { key: "requirements.type.task", fallback: "Task" },
  website: { key: "requirements.type.website", fallback: "Website" },
}

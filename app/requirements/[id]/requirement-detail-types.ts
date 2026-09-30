// Constants for status (same as in the main requirements page)
export const REQUIREMENT_STATUS = {
  VALIDATED: "validated",
  IN_PROGRESS: "in-progress",
  ON_REVIEW: "on-review",
  DONE: "done",
  BACKLOG: "backlog",
  CANCELED: "canceled"
} as const;

export const COMPLETION_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  REJECTED: "rejected"
} as const;

export type RequirementStatusType = typeof REQUIREMENT_STATUS[keyof typeof REQUIREMENT_STATUS];
export type CompletionStatusType = typeof COMPLETION_STATUS[keyof typeof COMPLETION_STATUS];

// Define interface for requirement
export interface Requirement {
  id: string
  siteId: string
  title: string
  description: string
  instructions: string
  type: "app" | "automation" | "presentation" | "document" | "campaign" | "image" | "video" | "audio" | "report" | "message" | "segment" | "task" | "website"
  priority: "high" | "medium" | "low"
  status: RequirementStatusType
  completionStatus: CompletionStatusType
  source: string
  campaigns?: string[]
  campaignNames?: string[]
  campaign_id?: string
  budget: number | null
  createdAt: string
  segments: string[]
  segmentNames?: string[]
  outsourceInstructions?: string
  campaignOutsourced?: boolean
  metadata?: {
    workflow_nodes?: WorkflowNode[]
    workflow_connections?: WorkflowConnection[]
    secret_id?: string
    secret_name?: string
    payment_status?: {
      status: 'pending' | 'paid' | 'failed'
      amount_paid?: number
      amount_due?: number
      currency?: string
      payment_method?: string
      stripe_payment_intent_id?: string
      payment_date?: string
      invoice_number?: string
      outsourced?: boolean
      outsource_provider?: string
      outsource_contact?: string
    }
  }
}


export interface WorkflowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label?: string; cron?: string; triggerType?: string; actionType?: string
    logicalOperator?: string; customCron?: string; webhookPath?: string
    dbTable?: string; dbEvent?: string; retries?: number
    secret_id?: string; secret_name?: string
  }
}
export interface WorkflowConnection { id: string; from: string; to: string; sourceHandle?: string }

export interface RequirementDetailRow {
  id: string
  site_id: string
  title: string
  description: string | null
  instructions: string | null
  type: Requirement['type'] | null
  priority: Requirement['priority'] | null
  status: RequirementStatusType | null
  completion_status: CompletionStatusType | null
  source: string | null
  budget: number | null
  created_at: string | null
  metadata: Requirement['metadata'] | null
  requirement_segments: { segment_id: string }[] | null
  campaign_requirements: { campaign_id: string }[] | null
}

export interface RequirementCampaignRow {
  id: string
  title: string
  description: string | null
  metadata: { payment_status?: { outsourced?: boolean } } | null
}

export interface RequirementSegmentRow {
  id: string
  name: string
  description: string | null
}

export interface RequirementQueryResult<T> {
  data: T | null
  error: { message: string } | null
}

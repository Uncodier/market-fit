export interface CohortRow {
  cohort: string
  weeks: (number | null)[]
  size: number
  cohortStart: string
}

export interface CohortMetadata {
  definition: string
  observationEnd: string
  startDate: string
  endDate: string
  weekStartsOn: "Monday"
  observationPolicy: "complete-weeks-only"
  activityDefinition: string
  usageDefinition?: string
  activityAvailable: boolean
  activityUnavailableReason?: string
  excludedAnonymousSales?: number
}

export interface CohortWindow {
  startDate: string
  endDate: string
  observationEnd: string
}

export interface CohortScope extends CohortWindow {
  siteId: string
  segmentId: string
}

export interface CohortEvent {
  leadId: string
  at: string
}

export interface CohortSale {
  id: string
  lead_id: string | null
  created_at: string
  status: string
}

export interface CohortLead {
  id: string
  created_at: string
}

export interface CohortMessage {
  id: string
  created_at: string
  role: string
  lead_id: string | null
  conversations: { site_id: string; lead_id: string | null } |
    { site_id: string; lead_id: string | null }[] | null
}

export class CohortInputError extends Error {}
export class CohortLimitError extends Error {}
export class CohortQueryError extends Error {
  constructor(readonly code?: string) {
    super("Unable to read cohort records")
  }
}
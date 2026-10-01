export type TrafficBucket = { name: string; value: number }

export type TrafficSegment = {
  id: string
  name: string
  site_id: string
}

export type TrafficSession = {
  id: string
  referrer?: string | null
  landing_url?: string | null
  current_url?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  custom_data?: unknown
  device?: unknown
  browser?: unknown
  location?: unknown
  lead?: { site_id: string; segment?: TrafficSegment | null } | null
  visitor?: { segment?: TrafficSegment | null } | null
}

export type TrafficAttribution = {
  segments: TrafficBucket[]
  campaigns: TrafficBucket[]
  coverage: {
    totalSessions: number
    attributedSessions: number
    unattributedSessions: number
    segmentedSessions: number
    campaignSessions: number
  }
  model: "session_entry"
  segmentMembership: "current"
}
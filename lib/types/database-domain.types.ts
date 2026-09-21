export interface ResourceUrl {
  key: string
  url: string
}

export interface CompetitorUrl {
  url: string
  name?: string
}

export interface Location {
  name: string
  address?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

export interface SwotAnalysis {
  strengths: string
  weaknesses: string
  opportunities: string
  threats: string
}

export interface MarketingBudget {
  total: number
  available: number
}

export interface SocialMedia {
  platform: string
  url: string
  handle?: string
}

export interface MarketingChannel {
  name: string
  status: "active" | "inactive" | "planned"
  budget?: number
  notes?: string
}

export interface TrackingSettings {
  track_visitors: boolean
  track_actions: boolean
  record_screen: boolean
}

export interface TeamMember {
  email: string
  role: "view" | "create" | "delete" | "admin"
  name?: string
  position?: string
}

export interface TeamRole {
  name: string
  permissions: string[]
  description?: string
}

export interface SiteMember {
  id: string
  site_id: string
  user_id: string | null
  role: "owner" | "admin" | "marketing" | "collaborator"
  added_by: string | null
  created_at: string
  updated_at: string
  email: string
  name: string | null
  position: string | null
  status: "pending" | "active" | "rejected"
  blocked_screens?: string[]
}

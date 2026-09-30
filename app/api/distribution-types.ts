export interface DistributionLead {
  id: string
  campaign_id?: string | null
  segment_id?: string | null
}

export interface DistributionSale {
  lead_id?: string | null
  campaign_id?: string | null
  segment_id?: string | null
  amount?: number | string | null
}

export interface TrafficSession {
  landing_url?: string | null
  current_url?: string | null
  custom_data?: unknown
  referrer?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  location?: unknown
  device?: unknown
  browser?: unknown
}
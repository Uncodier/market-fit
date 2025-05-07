export interface Segment {
  id: string
  name: string
  participants: number
}

export interface Experiment {
  id: string
  name: string
  description: string
  instructions: string
  status: "active" | "completed" | "draft"
  segments: Segment[]
  start_date: string | null
  end_date: string | null
  conversion: number | null
  roi: number | null
  preview_url: string | null
  hypothesis: string | null
  validations: string | null
  campaign_id: string | null
  campaign: {
    id: string
    title: string
    description: string
  } | null
  site_id: string
} 
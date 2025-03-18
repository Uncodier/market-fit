export interface Segment {
  id: string
  name: string
  description: string | null
  audience: string | null
  language: string | null
  size: string | null
  engagement: number | null
  created_at: string
  url: string | null
  analysis: Record<string, string[]> | null
  topics: {
    blog: string[]
    newsletter: string[]
  } | null
  is_active: boolean
  estimated_value: number | null
  icp: {
    role?: string
    company_size?: string
    industry?: string
    age_range?: string
    pain_points?: string[]
    goals?: string[]
    budget?: string
    decision_maker?: boolean
    location?: string
    experience?: string
  } | null
} 
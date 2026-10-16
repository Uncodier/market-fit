export interface AllowedDomain {
  id: string
  site_id: string
  domain: string
  created_at: string
  updated_at: string
  source?: 'unknown' | 'user' | 'harness'
  requirement_id?: string | null
} 
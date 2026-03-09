export interface Task {
  id: string
  serial_id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  priority: number
  scheduled_date?: Date | string
  assignee?: string | null
  created_at: Date | string
  updated_at: Date | string
  site_id: string
  type?: string | null
  stage?: string | null
  amount?: number | null
  lead_id?: string | null
  deal_id?: string | null
  priority_number?: number
  address?: any
}

export interface CreateTaskFormValues {
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  priority?: number
  scheduled_date?: Date | string
  assignee?: string | null
  site_id?: string
  type?: string | null
  stage?: string | null
  amount?: number | null
  lead_id?: string | null
  deal_id?: string | null
} 
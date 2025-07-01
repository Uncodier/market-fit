export interface Task {
  id: string
  serial_id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: number
  scheduled_date?: Date
  assignee?: string
  created_at: Date
  updated_at: Date
  site_id: string
  type?: string
  stage?: string
  amount?: number
  lead_id?: string
  priority_number: number
  address?: any
}

export interface CreateTaskFormValues {
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: number
  scheduled_date?: Date
  assignee?: string
  site_id: string
  type?: string
  stage?: string
  amount?: number
  lead_id?: string
} 
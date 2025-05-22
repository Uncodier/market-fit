export interface Task {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  due_date?: Date
  assigned_to?: string
  created_at: Date
  updated_at: Date
  site_id: string
  type?: string
  stage?: string
  amount?: number
  lead_id?: string
}

export interface CreateTaskFormValues {
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  due_date?: Date
  assigned_to?: string
  site_id: string
  type?: string
  stage?: string
  amount?: number
  lead_id?: string
} 
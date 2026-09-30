export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  site_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskCategory {
  task_id: string;
  category_id: string;
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  content: string
  attachments: any[]
  created_at: string
  updated_at: string
  is_private: boolean
  files: Array<{
    name: string
    url: string
    size: number
    type: string
  }>
  cta?: {
    primary_action: {
      title: string
      url: string
    }
  }
  profiles?: {
    id: string
    name: string
    avatar_url?: string
  }
}

export interface Task {
  id: string
  serial_id: string
  title: string
  description: string | null
  status: 'completed' | 'in_progress' | 'pending' | 'failed' | 'canceled'
  stage?: 'awareness' | 'consideration' | 'decision' | 'purchase' | 'retention' | 'referral'
  scheduled_date: string
  lead_id?: string
  assignee?: string
  type?: string
  priority: number
  metadata?: any
  address?: any
  site_id: string
  created_at: string
  updated_at: string
  category_id?: string
  leads?: {
    id: string
    name: string
  }
  assignee_details?: {
    id: string
    name: string
  }
  comments?: TaskComment[]
}

export interface Notification {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  action_url?: string
  related_entity_type?: string
  related_entity_id?: string
  site_id: string
  user_id: string
  created_at: string
  updated_at: string
  event_type?: string
  severity?: number
  command_id?: string
}

export interface NotificationsFilters {
  type?: string[]
  is_read?: boolean
} 
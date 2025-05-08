export interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  read: boolean
  created_at: string
  updated_at: string
  site_id: string
  user_id: string
}

export interface NotificationsFilters {
  type?: string[]
  read?: boolean
} 
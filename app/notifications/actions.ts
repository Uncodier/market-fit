import { createClient } from "@/lib/supabase/client"
import { z } from "zod"
import { Notification } from "./types"

// Schema for notifications response
const NotificationsSchema = z.object({
  notifications: z.array(z.object({
    id: z.string(),
    title: z.string(),
    message: z.string(),
    type: z.string(),
    is_read: z.boolean(),
    action_url: z.string().optional(),
    related_entity_type: z.string().optional(),
    related_entity_id: z.string().optional(),
    site_id: z.string(),
    user_id: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    event_type: z.string().optional(),
    severity: z.number().optional(),
    command_id: z.string().optional()
  })).nullable(),
  error: z.string().optional()
})

export type NotificationsResponse = z.infer<typeof NotificationsSchema>

// Schema for create notification
const CreateNotificationSchema = z.object({
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  type: z.string().default("info"),
  is_read: z.boolean().default(false),
  action_url: z.string().optional(),
  related_entity_type: z.string().optional(),
  related_entity_id: z.string().optional(),
  site_id: z.string().min(1, "Site ID is required"),
  user_id: z.string().min(1, "User ID is required"),
  event_type: z.string().optional(),
  severity: z.number().optional(),
  command_id: z.string().optional()
})

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>

// Schema for update notification
const UpdateNotificationSchema = z.object({
  id: z.string().min(1, "ID is required"),
  is_read: z.boolean().optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  type: z.string().optional()
})

export type UpdateNotificationInput = z.infer<typeof UpdateNotificationSchema>

export async function getNotifications(site_id: string, user_id: string): Promise<NotificationsResponse> {
  try {
    const response = await fetch(`/api/notifications?site_id=${site_id}&user_id=${user_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Error fetching notifications')
    }

    const data = await response.json()
    return { notifications: data.notifications || [] }
  } catch (error) {
    console.error("Error loading notifications:", error)
    return { error: "Error loading notifications", notifications: [] }
  }
}

export async function createNotification(data: CreateNotificationInput): Promise<{ error?: string; notification?: Notification }> {
  try {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Error creating notification')
    }

    const result = await response.json()
    return { notification: result.notification }
  } catch (error) {
    console.error("Error in createNotification:", error)
    return { error: error instanceof Error ? error.message : "Error creating notification" }
  }
}

export async function updateNotification(data: UpdateNotificationInput): Promise<{ error?: string; success?: boolean }> {
  try {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Error updating notification')
    }

    return { success: true }
  } catch (error) {
    console.error("Error in updateNotification:", error)
    return { error: error instanceof Error ? error.message : "Error updating notification" }
  }
}

export async function markAllAsRead(site_id: string, user_id: string): Promise<{ error?: string; success?: boolean }> {
  try {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        markAllAsRead: true,
        site_id,
        user_id
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Error marking all notifications as read')
    }

    return { success: true }
  } catch (error) {
    console.error("Error in markAllAsRead:", error)
    return { error: error instanceof Error ? error.message : "Error marking all notifications as read" }
  }
}

export async function deleteNotification(id: string): Promise<{ error?: string; success?: boolean }> {
  try {
    const response = await fetch(`/api/notifications?id=${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Error deleting notification')
    }

    return { success: true }
  } catch (error) {
    console.error("Error in deleteNotification:", error)
    return { error: error instanceof Error ? error.message : "Error deleting notification" }
  }
}

export async function deleteAllNotifications(site_id: string, user_id: string): Promise<{ error?: string; success?: boolean }> {
  try {
    const response = await fetch(`/api/notifications?site_id=${site_id}&user_id=${user_id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Error deleting all notifications')
    }

    return { success: true }
  } catch (error) {
    console.error("Error in deleteAllNotifications:", error)
    return { error: error instanceof Error ? error.message : "Error deleting all notifications" }
  }
} 
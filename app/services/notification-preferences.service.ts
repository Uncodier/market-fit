import { createClient } from '@/lib/supabase/client'
import { defaultSiteNotificationCategories } from '@/lib/notifications/site-notification-policy'

export enum NotificationCategory {
  LEAD_MANAGEMENT = 'lead_management',
  TASKS_REMINDERS = 'tasks_reminders',
  ANALYSIS_INSIGHTS = 'analysis_insights',
  HUMAN_INTERVENTION = 'human_intervention',
  SYSTEM_ALERTS = 'system_alerts',
}

export interface UserSiteNotification {
  user_id: string
  site_id: string
  email_enabled: boolean
  push_enabled: boolean
  categories: Record<string, boolean>
  created_at: string
  updated_at: string
}

function asCategories(value: unknown): Record<string, boolean> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, boolean>
  }
  return {}
}

export const notificationPreferencesService = {
  async getPreferences(siteId: string): Promise<UserSiteNotification | null> {
    const supabase = createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      throw new Error('Not authenticated')
    }

    const { data, error } = await supabase
      .from('user_site_notifications')
      .select('*')
      .eq('site_id', siteId)
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching site notification preferences:', error)
      throw error
    }

    if (!data) return null

    return {
      ...data,
      categories: asCategories(data.categories),
    } as UserSiteNotification
  },

  async updatePreferences(
    siteId: string,
    preferences: Partial<Pick<UserSiteNotification, 'email_enabled' | 'push_enabled' | 'categories'>>
  ): Promise<UserSiteNotification> {
    const supabase = createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      throw new Error('Not authenticated')
    }

    const existing = await this.getPreferences(siteId)
    const payload = {
      user_id: userData.user.id,
      site_id: siteId,
      email_enabled: preferences.email_enabled ?? existing?.email_enabled ?? true,
      push_enabled: preferences.push_enabled ?? existing?.push_enabled ?? true,
      categories: {
        ...defaultSiteNotificationCategories(),
        ...(existing?.categories || {}),
        ...(preferences.categories || {}),
      },
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('user_site_notifications')
      .upsert(payload, { onConflict: 'user_id,site_id' })
      .select()
      .single()

    if (error) {
      console.error('Error updating site notification preferences:', error)
      throw error
    }

    return {
      ...data,
      categories: asCategories(data.categories),
    } as UserSiteNotification
  },
}

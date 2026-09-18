import { createClient } from '@/lib/supabase/client'
import { validateContactPhone } from '@/app/auth/phone-validation'

// Profile types
export interface EventType {
  id: string
  title: string
  slug: string
  duration: number
  buffer: number
  enabled: boolean
  description?: string
  site_id?: string // for personal events, which site they belong to
  location?: string // meeting room or link
}

export interface CalendarSettings {
  enabled: boolean
  availability: {
    [key: string]: { enabled: boolean; start: string; end: string } // key: monday, tuesday, etc.
  }
  event_types?: EventType[]
  respect_holidays?: boolean
  timezone?: string
  schedule_name?: string
}

export interface ProfileData {
  id: string
  email: string
  name?: string
  phone?: string
  avatar_url?: string
  bio?: string
  role?: 'Product Manager' | 'Designer' | 'Developer' | 'Marketing' | 'Sales' | 'CEO' | 'Other'
  language?: string
  timezone?: string
  notifications?: {
    email: boolean
    push: boolean
  }
  settings?: {
    calendar?: CalendarSettings
    [key: string]: any
  }
  created_at: string
  updated_at: string
}

export interface ProfileUpdateData {
  name?: string
  phone?: string
  avatar_url?: string
  bio?: string
  role?: 'Product Manager' | 'Designer' | 'Developer' | 'Marketing' | 'Sales' | 'CEO' | 'Other'
  language?: string
  timezone?: string
  notifications?: {
    email: boolean
    push: boolean
  }
  settings?: Record<string, any>
}

class ProfileService {
  private supabase = createClient()

  /**
   * Get the user's complete profile.
   */
  async getProfile(userId: string): Promise<ProfileData | null> {
    try {
      console.log("getProfile: Fetching from profiles table...");
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      console.log("getProfile: DB query returned", !!data, error);

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      // Get the user's phone from their account (phone column or metadata)
      console.log("getProfile: Fetching auth.getUser()...");
      const { data: userData } = await this.supabase.auth.getUser()
      console.log("getProfile: auth.getUser() returned", !!userData?.user);
      
      if (userData.user) {
        // An unverified contact phone lives in user metadata rather than the
        // verified Auth phone field or the profiles table.
        if (!data.phone) {
          if (userData.user.phone) {
            data.phone = userData.user.phone
          } else if (userData.user.user_metadata?.phone) {
            data.phone = userData.user.user_metadata.phone
          }
        }
      }

      return data
    } catch (error) {
      console.error('Error in getProfile:', error)
      return null
    }
  }

  /**
   * Create or update the user's profile.
   */
  async upsertProfile(userId: string, profileData: ProfileUpdateData): Promise<ProfileData | null> {
    try {
      const { phone, ...restProfileData } = profileData
      const {
        data: { user },
        error: authError,
      } = await this.supabase.auth.getUser()

      if (authError || !user || user.id !== userId) {
        throw new Error('Not authenticated')
      }

      let resolvedPhone =
        user.phone || user.user_metadata?.phone || null
      if (phone !== undefined) {
        const phoneResult = validateContactPhone(phone)
        if (!phoneResult.valid) throw new Error(phoneResult.error)

        const { data: updatedAuth, error: phoneError } =
          await this.supabase.auth.updateUser({
            data: { phone: phoneResult.phone },
          })
        if (phoneError) {
          throw new Error(phoneError.message || 'Unable to update phone number')
        }
        resolvedPhone =
          updatedAuth.user?.phone ||
          updatedAuth.user?.user_metadata?.phone ||
          phoneResult.phone ||
          null
      }

      const existingProfile = await this.getProfile(userId)
      const updateData = {
        id: userId,
        ...restProfileData,
        updated_at: new Date().toISOString()
      }

      if (existingProfile) {
        const { data, error } = await this.supabase
          .from('profiles')
          .update(updateData)
          .eq('id', userId)
          .select()
          .single()

        if (error) {
          console.error('Error updating profile:', error)
          throw error
        }

        return {
          ...data,
          phone:
            phone !== undefined
              ? resolvedPhone
              : existingProfile.phone || resolvedPhone,
        }
      } else {
        const userEmail = user.email

        if (!userEmail) {
          throw new Error('User email not found')
        }

        const newProfileData = {
          ...updateData,
          email: userEmail,
          created_at: new Date().toISOString()
        }

        const { data, error } = await this.supabase
          .from('profiles')
          .insert(newProfileData)
          .select()
          .single()

        if (error) {
          console.error('Error creating profile:', error)
          throw error
        }

        return { ...data, phone: resolvedPhone }
      }
    } catch (error) {
      console.error('Error in upsertProfile:', error)
      throw error
    }
  }

  /**
   * Update only the user's notification settings.
   */
  async updateNotifications(userId: string, notifications: { email: boolean; push: boolean }): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('profiles')
        .update({
          notifications,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        console.error('Error updating notifications:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in updateNotifications:', error)
      return false
    }
  }

  /**
   * Update only the user's profile settings.
   */
  async updateSettings(userId: string, settings: Record<string, any>): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('profiles')
        .update({
          settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        console.error('Error updating settings:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in updateSettings:', error)
      return false
    }
  }

  /**
   * Check whether a profile exists for the user.
   */
  async profileExists(userId: string): Promise<boolean> {
    try {
      const { count, error } = await this.supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('id', userId)

      if (error) {
        console.error('Error checking profile existence:', error)
        return false
      }

      return (count || 0) > 0
    } catch (error) {
      console.error('Error in profileExists:', error)
      return false
    }
  }

  /**
   * Get a profile by its public calendar slug.
   */
  async getProfileByCalendarSlug(slug: string): Promise<ProfileData | null> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('settings->calendar->>slug', slug)
        .eq('settings->calendar->>enabled', 'true')
        .single()

      if (error) {
        console.error('Error fetching profile by slug:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getProfileByCalendarSlug:', error)
      return null
    }
  }
}

// Export a single service instance.
export const profileService = new ProfileService()
export default profileService 
import { createClient } from '@/lib/supabase/client'

// Tipos para el perfil
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
  settings?: Record<string, any>
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
   * Obtiene el perfil completo del usuario
   */
  async getProfile(userId: string): Promise<ProfileData | null> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      // Get the user's phone from their account (phone column or metadata)
      const { data: userData } = await this.supabase.auth.getUser()
      if (userData.user) {
        if (userData.user.phone) {
          data.phone = userData.user.phone
        } else if (userData.user.user_metadata?.phone) {
          data.phone = userData.user.user_metadata.phone
        }
      }

      return data
    } catch (error) {
      console.error('Error in getProfile:', error)
      return null
    }
  }

  /**
   * Crea o actualiza el perfil del usuario
   */
  async upsertProfile(userId: string, profileData: ProfileUpdateData): Promise<ProfileData | null> {
    try {
      // Extract phone to save it in user object instead of profile
      const { phone, ...restProfileData } = profileData

      // If phone exists, update it in the user (phone column and metadata)
      if (phone !== undefined) {
        try {
          // 1. Update user metadata (client side)
          await this.supabase.auth.updateUser({
            data: { phone }
          })
          
          // 2. Update phone column in auth.users via admin API
          // Since we might not have a session (e.g. just signed up), we rely on the 
          // 15-minute grace period built into the API endpoint
          let token = ''
          const { data: sessionData } = await this.supabase.auth.getSession()
          if (sessionData.session?.access_token) {
            token = sessionData.session.access_token
          }
          
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (token) headers['Authorization'] = `Bearer ${token}`
          
          // Fire and forget to avoid blocking the profile save if the network is slow
          fetch('/api/auth/update-phone', {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId, phone })
          }).then(res => {
            if (res.ok) console.log('Phone metadata also synced to root phone via API')
          }).catch(phoneError => {
            console.warn('Error syncing phone to auth.users:', phoneError)
          })
        } catch (phoneError) {
          console.error('Error updating user metadata phone:', phoneError)
        }
      }

      // Primero verificamos si el perfil existe
      const existingProfile = await this.getProfile(userId)
      
      const updateData = {
        id: userId,
        ...restProfileData,
        updated_at: new Date().toISOString()
      }

      if (existingProfile) {
        // Update existing profile
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

        // Return profile including the phone
        return { ...data, phone: phone !== undefined ? phone : existingProfile.phone }
      } else {
        // Create new profile
        const { data: userData } = await this.supabase.auth.getUser()
        const userEmail = userData.user?.email

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

        // Return profile including the phone
        return { ...data, phone: phone !== undefined ? phone : userData.user?.phone || userData.user?.user_metadata?.phone }
      }
    } catch (error) {
      console.error('Error in upsertProfile:', error)
      throw error
    }
  }

  /**
   * Actualiza solo las notificaciones del usuario
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
   * Actualiza solo la configuración del perfil
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
   * Verifica si un perfil existe para el usuario
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
}

// Exportar una instancia única del servicio
export const profileService = new ProfileService()
export default profileService 
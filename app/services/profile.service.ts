import { createClient } from '@/lib/supabase/client'

// Tipos para el perfil
export interface ProfileData {
  id: string
  email: string
  name?: string
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
      // Primero verificamos si el perfil existe
      const existingProfile = await this.getProfile(userId)
      
      const updateData = {
        id: userId,
        ...profileData,
        updated_at: new Date().toISOString()
      }

      if (existingProfile) {
        // Actualizar perfil existente
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

        return data
      } else {
        // Crear nuevo perfil
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

        return data
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
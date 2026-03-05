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
        // En supabase, phone en user suele venir vacio si no se verificó con otp, 
        // pero lo guardamos en user_metadata.phone. 
        // No existe columna phone en 'profiles'
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
      console.log("upsertProfile started for", userId, profileData);
      // Extract phone to save it in user object instead of profile
      const { phone, ...restProfileData } = profileData

      // If phone exists, update it in the user (phone column and metadata)
      if (phone !== undefined) {
        // 1. Update phone column in auth.users via admin API
        let token = ''
        console.log("Getting session...");
        const { data: sessionData } = await this.supabase.auth.getSession()
        if (sessionData.session?.access_token) {
          token = sessionData.session.access_token
        }
        
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        
        console.log("Calling /api/auth/update-phone...");
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout
          
          const res = await fetch('/api/auth/update-phone', {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId, phone }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          console.log("/api/auth/update-phone returned status", res.status);
          
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error("Error from /api/auth/update-phone:", errorData);
          } else {
            console.log("Phone updated via API successfully.");
            // Actualizamos la sesión en segundo plano sin esperar al await
            // para que no detenga el guardado de perfiles si de casualidad 
            // esto se atora o levanta algún listener que cuelga la promesa.
            // Omitimos esto porque estaba colgando la sesión en algunos casos. 
            // supabase auth triggers session events that can hang if done here.
          }
        } catch (fetchError) {
          console.error("Network or timeout error calling /api/auth/update-phone:", fetchError);
          // Continue saving profile even if fetch fails
        }
      }

      console.log("Checking if profile exists...");
      // Primero verificamos si el perfil existe
      const existingProfile = await this.getProfile(userId)
      console.log("existingProfile is", existingProfile ? "found" : "not found");
      
      const updateData = {
        id: userId,
        // Eliminamos 'phone: phone' de aquí porque causa el error PGRST204 
        // ya que la columna no existe en la tabla profiles
        ...restProfileData,
        updated_at: new Date().toISOString()
      }

      if (existingProfile) {
        console.log("Updating existing profile in DB...");
        // Update existing profile
        const { data, error } = await this.supabase
          .from('profiles')
          .update(updateData)
          .eq('id', userId)
          .select()
          .single()

        console.log("Update query returned", !!data, error);

        if (error) {
          console.error('Error updating profile:', error)
          throw error
        }

        console.log("Returning updated profile...");
        // Return profile including the phone
        return { ...data, phone: phone || existingProfile?.phone || null }
      } else {
        console.log("Creating new profile...");
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

        console.log("Inserting new profile...");
        const { data, error } = await this.supabase
          .from('profiles')
          .insert(newProfileData)
          .select()
          .single()

        console.log("Insert query returned", !!data, error);

        if (error) {
          console.error('Error creating profile:', error)
          throw error
        }

        console.log("Returning new profile...");
        // Return profile including the phone
        return { ...data, phone: phone || userData.user?.phone || userData.user?.user_metadata?.phone || null }
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
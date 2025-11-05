'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './use-auth'
import { profileService, ProfileData, ProfileUpdateData } from '@/app/services/profile.service'
import { requestEmailChange, getEmailChangeStatus, EmailChangeStatus } from '@/lib/services/email-change.service'
import { toast } from 'sonner'

export function useProfile() {
  const { user, isAuthenticated } = useAuth()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [emailChangeStatus, setEmailChangeStatus] = useState<EmailChangeStatus>({
    pendingEmail: null,
    isPending: false,
    currentEmail: null
  })

  // Cargar perfil cuando el usuario esté disponible
  const loadProfile = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)
      const profileData = await profileService.getProfile(user.id)
      setProfile(profileData)
    } catch (error) {
      console.error('Error loading profile:', error)
      toast.error('Error loading profile')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  // Actualizar perfil
  const updateProfile = useCallback(async (data: ProfileUpdateData, silent = false): Promise<boolean> => {
    if (!user?.id) {
      if (!silent) toast.error('User not authenticated')
      return false
    }

    try {
      setIsUpdating(true)
      const updatedProfile = await profileService.upsertProfile(user.id, data)
      
      if (updatedProfile) {
        setProfile(updatedProfile)
        if (!silent) toast.success('Profile updated successfully')
        return true
      } else {
        if (!silent) toast.error('Failed to update profile')
        return false
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      if (!silent) toast.error('Error updating profile')
      return false
    } finally {
      setIsUpdating(false)
    }
  }, [user?.id])

  // Actualizar solo notificaciones
  const updateNotifications = useCallback(async (notifications: { email: boolean; push: boolean }, silent = false): Promise<boolean> => {
    if (!user?.id) {
      if (!silent) toast.error('User not authenticated')
      return false
    }

    try {
      const success = await profileService.updateNotifications(user.id, notifications)
      
      if (success && profile) {
        setProfile({ ...profile, notifications })
        if (!silent) toast.success('Notification preferences updated')
        return true
      } else {
        if (!silent) toast.error('Failed to update notifications')
        return false
      }
    } catch (error) {
      console.error('Error updating notifications:', error)
      if (!silent) toast.error('Error updating notifications')
      return false
    }
  }, [user?.id, profile])

  // Actualizar configuración del perfil
  const updateSettings = useCallback(async (settings: Record<string, any>, silent = false): Promise<boolean> => {
    if (!user?.id) {
      if (!silent) toast.error('User not authenticated')
      return false
    }

    try {
      const success = await profileService.updateSettings(user.id, settings)
      
      if (success && profile) {
        setProfile({ ...profile, settings })
        if (!silent) toast.success('Settings updated')
        return true
      } else {
        if (!silent) toast.error('Failed to update settings')
        return false
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      if (!silent) toast.error('Error updating settings')
      return false
    }
  }, [user?.id, profile])

  // Check email change status
  const checkEmailChangeStatus = useCallback(async () => {
    if (!user?.id) return

    try {
      const status = await getEmailChangeStatus()
      setEmailChangeStatus(status)
    } catch (error) {
      console.error('Error checking email change status:', error)
    }
  }, [user?.id])

  // Efecto para cargar el perfil automáticamente
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadProfile()
      checkEmailChangeStatus()
    } else {
      setProfile(null)
      setIsLoading(false)
      setEmailChangeStatus({
        pendingEmail: null,
        isPending: false,
        currentEmail: null
      })
    }
  }, [isAuthenticated, user?.id, loadProfile, checkEmailChangeStatus])

  // Función para obtener un valor del perfil con fallback
  const getProfileValue = useCallback(<T>(key: keyof ProfileData, fallback: T): T => {
    if (!profile) return fallback
    const value = profile[key]
    return value !== undefined && value !== null ? (value as T) : fallback
  }, [profile])

  // Función para verificar si el perfil está completo
  const isProfileComplete = useCallback((): boolean => {
    if (!profile) return false
    
    return !!(
      profile.name &&
      profile.bio &&
      profile.role &&
      profile.language &&
      profile.timezone
    )
  }, [profile])

  // Request email change
  const requestEmailChangeHandler = useCallback(async (newEmail: string, password: string, silent = false): Promise<boolean> => {
    if (!user?.id) {
      if (!silent) toast.error('User not authenticated')
      return false
    }

    try {
      setIsUpdating(true)
      await requestEmailChange(newEmail, password)
      
      // Check status after request
      const status = await getEmailChangeStatus()
      setEmailChangeStatus(status)
      
      if (!silent) {
        toast.success('Verification email sent to new address. Please check your inbox.')
      }
      return true
    } catch (error) {
      console.error('Error requesting email change:', error)
      if (!silent) {
        const errorMessage = error instanceof Error ? error.message : 'Error requesting email change'
        toast.error(errorMessage)
      }
      return false
    } finally {
      setIsUpdating(false)
    }
  }, [user?.id])

  return {
    profile,
    isLoading,
    isUpdating,
    updateProfile,
    updateNotifications,
    updateSettings,
    loadProfile,
    getProfileValue,
    isProfileComplete,
    // Email change functions
    requestEmailChange: requestEmailChangeHandler,
    checkEmailChangeStatus,
    emailChangeStatus,
    // Valores convenientes
    name: getProfileValue('name', ''),
    email: getProfileValue('email', ''),
    bio: getProfileValue('bio', ''),
    role: getProfileValue('role', 'Product Manager'),
    language: getProfileValue('language', 'es'),
    timezone: getProfileValue('timezone', 'America/Mexico_City'),
    avatarUrl: getProfileValue('avatar_url', ''),
    notifications: getProfileValue('notifications', { email: true, push: true }),
    settings: getProfileValue('settings', {})
  }
} 
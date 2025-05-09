'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useSupabaseClient } from './use-supabase-client'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = useSupabaseClient()

  // Verificar estado de autenticación inicial y suscribirse a cambios
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('[Auth Debug] Checking initial auth state...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[Auth] Error checking session:', error.message)
          setUser(null)
          return
        }
        
        console.log('[Auth Debug] Session state:', session ? 'Active' : 'No session', 
                   session?.user?.id ? `User ID: ${session.user.id.substring(0, 8)}...` : '')
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('[Auth] Error checking authentication:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()

    // Suscribirse a cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        console.log('[Auth Debug] Auth state changed:', event, 
                   session?.user?.id ? `User ID: ${session.user.id.substring(0, 8)}...` : 'No user')
        
        setUser(session?.user ?? null)
        
        const currentPath = window.location.pathname
        console.log('[Auth Debug] Current path:', currentPath)
        
        // Solo redirigir si estamos en la página de login o si no hay sesión
        if (session?.user && currentPath.startsWith('/auth')) {
          // Obtener el returnTo desde la URL
          const url = new URL(window.location.href)
          const returnTo = url.searchParams.get('returnTo') || '/dashboard'
          console.log('[Auth Debug] Redirecting to:', returnTo)
          router.push(returnTo)
        } else if (!session?.user && !currentPath.startsWith('/auth') && 
                  !currentPath.startsWith('/api')) {
          console.log('[Auth Debug] No user session, redirecting to /auth')
          router.push('/auth')
        }
      }
    )

    return () => {
      console.log('[Auth Debug] Unsubscribing from auth changes')
      subscription.unsubscribe()
    }
  }, [router, supabase])

  // Función para iniciar sesión con email/password
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    console.log('[Auth Debug] Attempting to sign in with email')
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      console.error('[Auth Debug] Sign in error:', error.message)
      throw error
    }
    console.log('[Auth Debug] Sign in successful')
  }, [supabase])

  // Función para iniciar sesión con OAuth
  const signInWithOAuth = useCallback(async (provider: 'google' | 'github') => {
    console.log('[Auth Debug] Attempting to sign in with OAuth provider:', provider)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
      }
    })
    
    if (error) {
      console.error('[Auth Debug] OAuth sign in error:', error.message)
      throw error
    }
  }, [supabase])

  // Función para registrar usuario con email/password
  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    console.log('[Auth Debug] Attempting to sign up with email')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
      }
    })
    
    if (error) {
      console.error('[Auth Debug] Sign up error:', error.message)
      throw error
    }
    console.log('[Auth Debug] Sign up successful, confirmation email may have been sent')
  }, [supabase])

  // Función para cerrar sesión
  const signOut = useCallback(async () => {
    console.log('[Auth Debug] Attempting to sign out')
    try {
      // Primero intentamos cerrar sesión en Supabase
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Limpiar cualquier estado local relacionado con la autenticación
      setUser(null)
      
      // Limpiar cookies del navegador relacionadas con Supabase
      const cookiesToClear = [
        'sb-access-token',
        'sb-refresh-token',
        'supabase-auth-token',
        'sb-provider-token',
        'sb-auth-token'
      ]
      
      cookiesToClear.forEach(name => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/;`
      })
      
      console.log('[Auth Debug] Sign out successful, redirecting to logout endpoint')
      // Luego redirigimos a la ruta de logout para limpiar cookies del servidor
      window.location.href = '/api/auth/logout'
    } catch (error) {
      console.error('[Auth Debug] Error during logout:', error)
      // Si falla, intentamos redirigir directamente
      window.location.href = '/api/auth/logout'
      throw error
    }
  }, [supabase])

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signInWithEmail,
    signInWithOAuth,
    signUpWithEmail,
    signOut
  }
} 
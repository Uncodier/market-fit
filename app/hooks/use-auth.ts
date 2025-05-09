'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, AuthChangeEvent, Session, OAuthResponse, Provider } from '@supabase/supabase-js'
import { useSupabaseClient } from './use-supabase-client'

// Definimos el tipo para las opciones de OAuth extendidas
interface ExtendedOAuthOptions {
  redirectTo?: string;
  queryParams?: Record<string, string>;
  scopes?: string;
  skipBrowserRedirect?: boolean;
}

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
        
        // Verificar redirección inicial si hay sesión activa y estamos en la página de autenticación
        if (session?.user && typeof window !== 'undefined' && window.location.pathname.startsWith('/auth')) {
          const url = new URL(window.location.href)
          const returnTo = url.searchParams.get('returnTo') || '/dashboard'
          console.log('[Auth Debug] Initial redirect to:', returnTo)
          router.push(returnTo)
        }
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
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('[Auth Debug] Auth state changed:', event, 
                   session?.user?.id ? `User ID: ${session.user.id.substring(0, 8)}...` : 'No user')
        
        // Actualizar el usuario en el estado
        setUser(session?.user ?? null)
        
        // Obtener la ruta actual
        if (typeof window === 'undefined') return;
        
        const currentPath = window.location.pathname
        console.log('[Auth Debug] Current path:', currentPath)
        
        // Manejar eventos específicos de autenticación
        if (event === 'SIGNED_IN') {
          // Si el usuario acaba de iniciar sesión, redirigir a la página adecuada
          if (currentPath.startsWith('/auth')) {
            // Obtener el returnTo desde la URL
            const url = new URL(window.location.href)
            const returnTo = url.searchParams.get('returnTo') || '/dashboard'
            console.log('[Auth Debug] User signed in, redirecting to:', returnTo)
            
            // Retrasar ligeramente la redirección para asegurar que los estados se actualicen
            setTimeout(() => {
              router.push(returnTo)
            }, 100)
          }
        } else if (event === 'SIGNED_OUT') {
          // Si el usuario cerró sesión y no está en la página de autenticación, redirigir a login
          if (!currentPath.startsWith('/auth') && !currentPath.startsWith('/api')) {
            console.log('[Auth Debug] User signed out, redirecting to auth page')
            router.push('/auth')
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // Actualizar la sesión sin redirección
          console.log('[Auth Debug] Token refreshed, updating session')
        } else if (event === 'USER_UPDATED') {
          // El perfil del usuario fue actualizado, actualizar la sesión
          console.log('[Auth Debug] User updated, refreshing session')
          const { data } = await supabase.auth.getSession()
          setUser(data.session?.user ?? null)
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
  const signInWithOAuth = useCallback(async (provider: Provider) => {
    console.log('[Auth Debug] Attempting to sign in with OAuth provider:', provider)
    
    // Configuración específica para cada proveedor
    let options: ExtendedOAuthOptions = {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
    }
    
    // Configuración específica para Google en Uncodie
    if (provider === 'google') {
      options = {
        ...options,
        queryParams: {
          // Añadir el dominio de Uncodie para el login
          hd: 'uncodie.com',
          // Solicitar el scope de perfil y email
          scope: 'profile email',
          // Añadir prompt para asegurar que se muestre el selector de cuentas
          prompt: 'select_account',
          // Identificador de cliente para Uncodie - opcional, ya está en Supabase
          access_type: 'offline'
        }
      }
    }
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options
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
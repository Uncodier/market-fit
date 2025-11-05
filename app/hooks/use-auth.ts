'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, AuthChangeEvent, Session, OAuthResponse, Provider } from '@supabase/supabase-js'
import { useSupabaseClient } from './use-supabase-client'

// Declarar tipos para MarketFit en el window object
declare global {
  interface Window {
    MarketFit?: {
      siteId?: string;
      init?: (config: any) => void;
      showWidget?: () => void;
      hideWidget?: () => void;
      widgetHide?: () => void;
      openChatWithTask?: () => void;
      setTheme?: (theme: string) => void;
      chat?: {
        identify: (userData: { name: string; email: string; phone?: string }) => Promise<void>
      }
    }
  }
}

// Definimos el tipo para las opciones de OAuth extendidas
interface ExtendedOAuthOptions {
  redirectTo?: string;
  queryParams?: Record<string, string>;
  scopes?: string;
  skipBrowserRedirect?: boolean;
}

// Función para identificar usuario en MarketFit chat
const identifyUserInChat = async (user: User | null, supabaseClient: any, retryCount = 0) => {
  if (!user) return

  const maxRetries = 10 // Máximo 10 reintentos (10 segundos)

  try {
    // Verificar si MarketFit está disponible
    if (typeof window !== 'undefined' && window.MarketFit?.chat?.identify) {
      // Obtener información adicional del perfil desde Supabase
      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('name, email')
        .eq('id', user.id)
        .single()

      if (error) {
        console.warn('[MarketFit Chat] Could not fetch profile from database:', error)
        console.warn('[MarketFit Chat] Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        console.warn('[MarketFit Chat] Using auth user data instead')
      }

      // Preparar datos del usuario para MarketFit
      const userData = {
        name: profile?.name || user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: profile?.email || user.email || '',
        // Agregar más campos si es necesario
        phone: user.user_metadata?.phone || ''
      }

      
      
      // Llamar a la función identify del chat
      await window.MarketFit.chat.identify(userData)
      
      
    } else {
      // Si MarketFit no está disponible aún, esperar un poco y reintentar
      if (retryCount < maxRetries) {
        setTimeout(() => {
          identifyUserInChat(user, supabaseClient, retryCount + 1)
        }, 1000)
      } else {
        
      }
    }
  } catch (error) {
    console.error('[MarketFit Chat] Error identifying user:', error)
    
    // Si hay un error pero no hemos superado los reintentos, intentar de nuevo
    if (retryCount < maxRetries) {
      setTimeout(() => {
        identifyUserInChat(user, supabaseClient, retryCount + 1)
      }, 2000) // Esperar más tiempo después de un error
    }
  }
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
        
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[Auth] Error checking session:', error.message)
          setUser(null)
          return
        }
        
        
        
        setUser(session?.user ?? null)
        
        // Si hay una sesión activa, identificar al usuario en MarketFit chat
        if (session?.user) {
          identifyUserInChat(session.user, supabase)
        }
        
        // Verificar redirección inicial si hay sesión activa y estamos en la página de autenticación
        // PERO no redirigir durante flujos de reset de contraseña o team invitation
        if (session?.user && typeof window !== 'undefined' && window.location.pathname.startsWith('/auth')) {
          const currentPath = window.location.pathname
          
          // Excepciones: no redirigir durante flujos de reset de contraseña o team invitation
          const passwordResetPages = [
            '/auth/reset-password',
            '/auth/set-password',
            '/auth/confirm',
            '/auth/team-invitation'
          ]
          
          const isPasswordResetFlow = passwordResetPages.some(page => currentPath === page)
          
          if (!isPasswordResetFlow) {
            const url = new URL(window.location.href)
            const returnTo = url.searchParams.get('returnTo') || '/projects'
            
            console.log('[useAuth] checkAuth: Found session, redirecting to:', returnTo, 'from path:', currentPath)
            router.push(returnTo)
          } else {
            console.log('[useAuth] checkAuth: Found session but ignoring redirect - user is in password reset flow:', currentPath)
          }
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
        
        
        // Actualizar el usuario en el estado
        setUser(session?.user ?? null)
        
        // Obtener la ruta actual
        if (typeof window === 'undefined') return;
        
        const currentPath = window.location.pathname
        
        // Manejar eventos específicos de autenticación
        if (event === 'SIGNED_IN') {
          // Identificar usuario en MarketFit chat
          identifyUserInChat(session?.user || null, supabase)
          
          // Excepciones: no redirigir durante flujos de reset de contraseña o team invitation
          const passwordResetPages = [
            '/auth/reset-password',
            '/auth/set-password',
            '/auth/confirm',
            '/auth/team-invitation'
          ]
          
          const isPasswordResetFlow = passwordResetPages.some(page => currentPath === page)
          
          // Si el usuario acaba de iniciar sesión, redirigir a la página adecuada
          // PERO no redirigir si está en un flujo de reset de contraseña
          if (currentPath.startsWith('/auth') && !isPasswordResetFlow) {
            // Obtener el returnTo desde la URL
            const url = new URL(window.location.href)
            const returnTo = url.searchParams.get('returnTo') || '/projects'
            
            console.log('[useAuth] SIGNED_IN event detected, redirecting to:', returnTo, 'from path:', currentPath)
            
            // Redirigir inmediatamente
            router.push(returnTo)
          } else if (isPasswordResetFlow) {
            console.log('[useAuth] SIGNED_IN event detected but ignoring redirect - user is in password reset flow:', currentPath)
          }
        } else if (event === 'SIGNED_OUT') {
          // Solo redirigir a auth si no estamos ya en páginas de auth o api
          // Y evitar redirecciones cuando estamos en confirmación
          if (!currentPath.startsWith('/auth') && !currentPath.startsWith('/api') && currentPath !== '/') {
            
            router.push('/auth')
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // Actualizar la sesión sin redirección
          
        } else if (event === 'USER_UPDATED') {
          // El perfil del usuario fue actualizado, actualizar la sesión
          
          const { data } = await supabase.auth.getSession()
          setUser(data.session?.user ?? null)
        }
      }
    )

    return () => {
      
      subscription.unsubscribe()
    }
  }, [router, supabase])

  // Función para iniciar sesión con email/password
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      console.error('[Auth Debug] Sign in error:', error.message)
      throw error
    }
    
  }, [supabase])

  // Función para iniciar sesión con OAuth
  const signInWithOAuth = useCallback(async (provider: Provider) => {
    
    
    try {
      // Clear any existing auth state to prevent PKCE conflicts
      
      await supabase.auth.signOut({ scope: 'local' })
      
      // Small delay to ensure state is cleared
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Use window.location.origin for consistency with other OAuth calls
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL
      
      // Configuración específica para cada proveedor
      let options: ExtendedOAuthOptions = {
        redirectTo: `${baseUrl}/auth/callback`
      }
      
      // Configuración específica para Google
      if (provider === 'google') {
        options = {
          ...options,
          queryParams: {
            // Solicitar el scope de perfil y email
            scope: 'profile email',
            // Añadir prompt para asegurar que se muestre el selector de cuentas
            prompt: 'select_account',
            // Acceso offline para refresh tokens
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
      
      
    } catch (error: any) {
      console.error('[Auth Debug] OAuth error:', error)
      throw error
    }
  }, [supabase])

  // Función para registrar usuario con email/password
  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    
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
    
  }, [supabase])

  // Función para cerrar sesión
  const signOut = useCallback(async () => {
    
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

export default useAuth 
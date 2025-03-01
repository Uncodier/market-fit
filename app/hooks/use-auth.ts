'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Verificar estado de autenticación inicial y suscribirse a cambios
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      
      // Solo redirigir si estamos en la página de login o si no hay sesión
      if (session?.user && window.location.pathname.startsWith('/auth')) {
        const returnTo = searchParams.get('returnTo') || '/dashboard'
        router.push(returnTo)
      } else if (!session?.user && !window.location.pathname.startsWith('/auth')) {
        router.push('/auth')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, searchParams, supabase])

  // Función para iniciar sesión con email/password
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error
  }, [supabase])

  // Función para iniciar sesión con OAuth
  const signInWithOAuth = useCallback(async (provider: 'google' | 'github') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
      }
    })
    
    if (error) throw error
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
    
    if (error) throw error
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
      console.error('Error during logout:', error)
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
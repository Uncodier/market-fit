'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { jwtDecode } from 'jwt-decode'
import Cookies from 'js-cookie'

interface Auth0User {
  sub: string
  email: string
  name?: string
  picture?: string
  exp: number
  [key: string]: any
}

export function useAuth() {
  const [user, setUser] = useState<Auth0User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Verificar estado de autenticación en montaje y cuando cambia la ruta
  useEffect(() => {
    const checkAuth = () => {
      try {
        // Intentar obtener el token de la cookie
        const token = Cookies.get('auth0_token')
        
        console.log(`[Auth] Verificando token en ruta: ${pathname}`)
        console.log(`[Auth] Token presente: ${!!token}`)
        
        if (!token) {
          // No hay token
          console.log('[Auth] No se encontró token, usuario no autenticado')
          setUser(null)
          setIsLoading(false)
          
          // Si no estamos ya en la página de login y no es una ruta de API, redirigir
          if (!pathname.startsWith('/auth/login') && !pathname.startsWith('/api/')) {
            console.log('[Auth] Redirigiendo a login por falta de token')
            router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`)
          }
          
          return
        }

        // Decodificar el token para obtener la información del usuario con manejo de errores mejorado
        let decodedToken: Auth0User;
        try {
          decodedToken = jwtDecode<Auth0User>(token)
          console.log('[Auth] Token decodificado:', decodedToken.sub)
          
          // Verificar si el objeto decodificado tiene la estructura esperada
          if (!decodedToken || !decodedToken.sub || !decodedToken.exp) {
            throw new Error('Token inválido: estructura incompleta')
          }
          
          // Verificar si el token ha expirado
          const isExpired = decodedToken.exp * 1000 < Date.now()
          
          if (isExpired) {
            console.log('[Auth] Token expirado, redirigiendo a login')
            Cookies.remove('auth0_token')
            setUser(null)
            
            // Si no estamos ya en la página de login, redirigir
            if (!pathname.startsWith('/auth/login')) {
              router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`)
            }
          } else {
            console.log('[Auth] Usuario autenticado:', decodedToken.email)
            setUser(decodedToken)
          }
        } catch (decodeError) {
          console.error('[Auth] Error decodificando token:', decodeError)
          Cookies.remove('auth0_token')
          setUser(null)
          
          if (!pathname.startsWith('/auth/login')) {
            router.push('/auth/login')
          }
        }
      } catch (error) {
        console.error('[Auth] Error verificando autenticación:', error)
        setUser(null)
        
        // Si hay un error, eliminar la cookie y redirigir a login
        Cookies.remove('auth0_token')
        if (!pathname.startsWith('/auth/login')) {
          router.push('/auth/login')
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [pathname, router])

  // Función para iniciar sesión con opción de redirección después del login
  const login = useCallback((returnTo?: string) => {
    const loginUrl = returnTo 
      ? `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`
      : '/api/auth/login'
    
    console.log(`[Auth] Iniciando sesión con returnTo: ${returnTo || '/'}`)
    router.push(loginUrl)
  }, [router])

  // Función para cerrar sesión
  const logout = useCallback(() => {
    console.log('[Auth] Cerrando sesión')
    
    // Siempre eliminar la cookie primero
    Cookies.remove('auth0_token')
    
    try {
      // Intentar redirigir a la ruta de logout
      router.push('/api/auth/logout')
    } catch (error) {
      console.error('[Auth] Error al redirigir a logout:', error)
      
      // Si falla, redirigir directamente a login
      router.push('/auth/login')
      router.refresh()
    }
  }, [router])

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout
  }
} 
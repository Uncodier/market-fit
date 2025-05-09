'use client'

import { createContext, useContext, ReactNode, Suspense } from 'react'
import { useAuth } from '../../hooks/use-auth'
import { User } from '@supabase/supabase-js'

// Definir el tipo para el contexto de autenticación
interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithOAuth: (provider: 'google' | 'github') => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

// Crear el contexto de autenticación
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Props para el proveedor de autenticación
interface AuthProviderProps {
  children: ReactNode
}

// Componente proveedor de autenticación
export function AuthProvider({ children }: AuthProviderProps) {
  // Solo en el cliente, usar el hook de autenticación
  const auth = useAuth()

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook personalizado para acceder al contexto de autenticación
export function useAuthContext() {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  
  return context
} 
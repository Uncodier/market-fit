'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useAuth } from '../../hooks/use-auth'

// Definir el tipo para el contexto de autenticación
interface AuthContextType {
  user: any | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (returnTo?: string) => void
  logout: () => void
}

// Crear el contexto de autenticación
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Props para el proveedor de autenticación
interface AuthProviderProps {
  children: ReactNode
}

// Componente proveedor de autenticación
export function AuthProvider({ children }: AuthProviderProps) {
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
    throw new Error('useAuthContext debe ser usado dentro de un AuthProvider')
  }
  
  return context
} 
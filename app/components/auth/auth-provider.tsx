'use client'

import type { ReactNode } from 'react'
import { useAuthState } from '../../hooks/use-auth'
import {
  AuthContext,
  useAuthContext,
} from '@/app/components/auth/auth-context'

// Props para el proveedor de autenticación
interface AuthProviderProps {
  children: ReactNode
}

// Componente proveedor de autenticación
export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuthState()

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}

export { useAuthContext }
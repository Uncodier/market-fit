"use client"

import { createContext, useContext } from "react"
import type { Provider, User } from "@supabase/supabase-js"

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithOAuth: (provider: Provider) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
)

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider")
  }
  return context
}

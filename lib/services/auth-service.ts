import { createClient } from '../supabase/client'
import { createClient as createServerClient } from '../supabase/server'
import { User, Session } from '@supabase/supabase-js'

class AuthServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthServiceError'
  }
}

// Cliente
export async function signIn(email: string, password: string): Promise<{ user: User; session: Session }> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) throw new AuthServiceError(`Error al iniciar sesión: ${error.message}`)
    if (!data.user || !data.session) throw new AuthServiceError('No se pudo iniciar sesión')
    
    return { user: data.user, session: data.session }
  } catch (error) {
    console.error('Error en signIn:', error)
    throw error instanceof AuthServiceError
      ? error
      : new AuthServiceError('Error al iniciar sesión')
  }
}

export async function signUp(email: string, password: string): Promise<{ user: User | null; session: Session | null }> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          password_set: true // Mark that password is set for normal signups
        }
      }
    })
    
    if (error) throw new AuthServiceError(`Error al registrarse: ${error.message}`)
    
    return { user: data.user, session: data.session }
  } catch (error) {
    console.error('Error en signUp:', error)
    throw error instanceof AuthServiceError
      ? error
      : new AuthServiceError('Error al registrarse')
  }
}

export async function signOut(): Promise<void> {
  try {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    
    if (error) throw new AuthServiceError(`Error al cerrar sesión: ${error.message}`)
  } catch (error) {
    console.error('Error en signOut:', error)
    throw error instanceof AuthServiceError
      ? error
      : new AuthServiceError('Error al cerrar sesión')
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    
    if (error) throw new AuthServiceError(`Error al solicitar cambio de contraseña: ${error.message}`)
  } catch (error) {
    console.error('Error en resetPassword:', error)
    throw error instanceof AuthServiceError
      ? error
      : new AuthServiceError('Error al solicitar cambio de contraseña')
  }
}

export async function updatePassword(password: string): Promise<void> {
  try {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    
    if (error) throw new AuthServiceError(`Error al actualizar contraseña: ${error.message}`)
  } catch (error) {
    console.error('Error en updatePassword:', error)
    throw error instanceof AuthServiceError
      ? error
      : new AuthServiceError('Error al actualizar contraseña')
  }
}

// Servidor
export async function getUserProfileFromServer(): Promise<User | null> {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) return null
    
    return session.user
  } catch (error) {
    console.error('Error en getUserProfileFromServer:', error)
    return null
  }
}

export async function getSessionFromServer(): Promise<Session | null> {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    return session
  } catch (error) {
    console.error('Error en getSessionFromServer:', error)
    return null
  }
} 
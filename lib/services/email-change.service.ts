import { createClient } from '../supabase/client'

class EmailChangeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailChangeError'
  }
}

export interface EmailChangeStatus {
  pendingEmail: string | null
  isPending: boolean
  currentEmail: string | null
}

/**
 * Verifies password before allowing email change
 */
async function verifyPassword(password: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user?.email) {
    throw new EmailChangeError('User email not found')
  }

  // Verify password by attempting to sign in
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password
  })

  if (error) {
    return false
  }

  return true
}

/**
 * Requests email change after password verification
 */
export async function requestEmailChange(newEmail: string, password: string): Promise<void> {
  const supabase = createClient()
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(newEmail)) {
    throw new EmailChangeError('Invalid email format')
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user?.email) {
    throw new EmailChangeError('User not authenticated')
  }

  // Check if email is the same
  if (user.email.toLowerCase() === newEmail.toLowerCase()) {
    throw new EmailChangeError('New email must be different from current email')
  }

  // Verify password
  const isPasswordValid = await verifyPassword(password)
  if (!isPasswordValid) {
    throw new EmailChangeError('Invalid password')
  }

  // Request email change
  // Supabase will validate email uniqueness on their side
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || ''

  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { 
      emailRedirectTo: `${baseUrl}/auth/confirm-email-change`
    }
  )

  if (error) {
    if (error.message.includes('already registered')) {
      throw new EmailChangeError('This email is already in use')
    }
    throw new EmailChangeError(error.message)
  }
}

/**
 * Gets the current email change status
 */
export async function getEmailChangeStatus(): Promise<EmailChangeStatus> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return {
      pendingEmail: null,
      isPending: false,
      currentEmail: null
    }
  }

  const currentEmail = user.email || null
  const pendingEmail = user.new_email || null
  const isPending = !!pendingEmail && pendingEmail !== currentEmail

  return {
    pendingEmail,
    isPending,
    currentEmail
  }
}

'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

interface AuthFormProps {
  mode?: 'login' | 'register'
  returnTo?: string | null
}

export function AuthForm({ mode = 'login', returnTo }: AuthFormProps) {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const finalReturnTo = returnTo || searchParams.get('returnTo') || '/dashboard'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return (
    <Auth
      supabaseClient={supabase}
      view={mode === 'register' ? 'sign_up' : 'sign_in'}
      appearance={{ 
        theme: ThemeSupa,
        variables: {
          default: {
            colors: {
              brand: '#2563eb',
              brandAccent: '#1d4ed8'
            }
          }
        }
      }}
      theme="light"
      showLinks={true}
      providers={['google', 'github']}
      redirectTo={`${baseUrl}/auth/callback?returnTo=${finalReturnTo}`}
    />
  )
} 
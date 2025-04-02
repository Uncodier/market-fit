'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { useTheme } from '@/app/hooks/use-theme'
import { useEffect, useState } from 'react'

interface AuthFormProps {
  mode?: 'login' | 'register'
  returnTo?: string | null
}

export function AuthForm({ mode = 'login', returnTo }: AuthFormProps) {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const finalReturnTo = returnTo || searchParams.get('returnTo') || '/dashboard'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <Auth
      supabaseClient={supabase}
      view={mode === 'register' ? 'sign_up' : 'sign_in'}
      appearance={{ 
        theme: ThemeSupa,
        variables: {
          default: {
            colors: {
              brand: '#3b82f6',
              brandAccent: '#2563eb',
              brandButtonText: '#ffffff',
              defaultButtonBackground: theme === 'dark' ? '#1f2937' : '#f3f4f6',
              defaultButtonBackgroundHover: theme === 'dark' ? '#374151' : '#e5e7eb',
              inputBackground: theme === 'dark' ? '#111827' : '#ffffff',
              inputBorder: theme === 'dark' ? '#1f2937' : '#e5e7eb',
              inputBorderHover: theme === 'dark' ? '#374151' : '#d1d5db',
              inputBorderFocus: '#3b82f6',
              inputText: theme === 'dark' ? '#f3f4f6' : '#111827',
              inputLabelText: theme === 'dark' ? '#9ca3af' : '#6b7280',
              inputPlaceholder: theme === 'dark' ? '#6b7280' : '#9ca3af',
              messageText: theme === 'dark' ? '#f3f4f6' : '#111827',
              messageTextDanger: '#ef4444',
              anchorTextColor: '#3b82f6',
              anchorTextHoverColor: '#2563eb',
            }
          }
        }
      }}
      theme={theme}
      showLinks={true}
      providers={['google', 'github']}
      redirectTo={`${baseUrl}/auth/callback?returnTo=${finalReturnTo}`}
    />
  )
} 
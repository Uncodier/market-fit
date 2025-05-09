'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/app/context/ThemeContext'
import { useEffect, useState } from 'react'

interface AuthFormProps {
  mode?: 'login' | 'register'
  returnTo?: string | null
  defaultAuthType?: string
}

export function AuthForm({ mode = 'login', returnTo, defaultAuthType }: AuthFormProps) {
  const supabase = createClient()
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Obtener returnTo directamente desde la URL en lugar de useSearchParams
  const [finalReturnTo, setFinalReturnTo] = useState<string>('/dashboard')
  
  useEffect(() => {
    setMounted(true)
    
    // Obtener el returnTo de la URL si no se proporcionó como prop
    if (!returnTo && typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const urlReturnTo = url.searchParams.get('returnTo')
      setFinalReturnTo(urlReturnTo || '/dashboard')
    } else {
      setFinalReturnTo(returnTo || '/dashboard')
    }
  }, [returnTo])

  if (!mounted) return null

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const authType = defaultAuthType || (mode === 'register' ? 'sign_up' : 'sign_in')

  return (
    <Auth
      supabaseClient={supabase}
      view={authType === 'signup' ? 'sign_up' : authType === 'signin' ? 'sign_in' : authType as any}
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
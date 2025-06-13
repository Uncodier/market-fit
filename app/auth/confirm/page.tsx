"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Loader, CheckCircle2, XCircle, Mail } from "@/app/components/ui/icons"
import { toast } from "sonner"

type ConfirmationState = 'loading' | 'success' | 'error' | 'redirect'

export default function ConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<ConfirmationState>('loading')
  const [message, setMessage] = useState('')
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)

  useEffect(() => {
    const handleConfirmation = async () => {
      try {
        const tokenHash = searchParams.get('token_hash')
        const type = searchParams.get('type')
        const redirectTo = searchParams.get('redirect_to')

        if (!tokenHash) {
          setState('error')
          setMessage('Missing confirmation token')
          return
        }

        const supabase = createClient()

        // Handle different types of confirmations
        if (type === 'invite') {
          // This is a team invitation
          console.log('🔗 Processing team invitation confirmation')
          
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'invite'
          })

          if (error) {
            console.error('❌ Invitation confirmation error:', error)
            setState('error')
            setMessage(error.message || 'Failed to confirm invitation')
            return
          }

          console.log('✅ Invitation confirmed successfully:', data)
          
          // Check if user needs to set password (new user or invited user without password)
          const user = data.user
          const isNewUser = !user?.user_metadata?.password_set
          
          if (isNewUser || !user?.last_sign_in_at) {
            console.log('🔐 User needs to set password, redirecting to password setup')
            setState('redirect')
            setMessage('Invitation confirmed! Setting up your account...')
            
            // Encode the original redirect URL to pass it through password setup
            const encodedRedirect = redirectTo ? encodeURIComponent(redirectTo) : ''
            const passwordSetupUrl = `/auth/set-password?redirect_to=${encodedRedirect}`
            
            setTimeout(() => {
              router.push(passwordSetupUrl)
            }, 1500)
          } else if (redirectTo) {
            console.log('🔄 Redirecting to:', redirectTo)
            setState('redirect')
            setMessage('Invitation confirmed! Redirecting...')
            
            // Decode the redirect URL
            const decodedRedirect = decodeURIComponent(redirectTo)
            
            // Wait a moment to show success message, then redirect
            setTimeout(() => {
              window.location.href = decodedRedirect
            }, 1500)
          } else {
            setState('success')
            setMessage('Invitation confirmed successfully!')
            setRedirectUrl('/dashboard')
          }
        } else {
          // Handle other confirmation types (signup, recovery, etc.)
          console.log('🔗 Processing email confirmation, type:', type)
          
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type === 'recovery' ? 'recovery' : 'email'
          })

          if (error) {
            console.error('❌ Email confirmation error:', error)
            setState('error')
            setMessage(error.message || 'Failed to confirm email')
            return
          }

          console.log('✅ Email confirmed successfully:', data)
          
          if (redirectTo) {
            const decodedRedirect = decodeURIComponent(redirectTo)
            setState('redirect')
            setMessage('Email confirmed! Redirecting...')
            setTimeout(() => {
              window.location.href = decodedRedirect
            }, 1500)
          } else {
            setState('success')
            setMessage('Email confirmed successfully!')
            setRedirectUrl('/dashboard')
          }
        }

      } catch (error) {
        console.error('❌ Confirmation process error:', error)
        setState('error')
        setMessage('An unexpected error occurred during confirmation')
      }
    }

    handleConfirmation()
  }, [searchParams])

  const handleManualRedirect = () => {
    if (redirectUrl) {
      router.push(redirectUrl)
    }
  }

  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              Email Confirmation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center text-center">
              {state === 'loading' && (
                <>
                  <Loader className="h-12 w-12 text-blue-500 animate-spin mb-4" />
                  <p className="text-gray-600">Confirming your email...</p>
                </>
              )}

              {state === 'success' && (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-gray-600 mb-4">{message}</p>
                  {redirectUrl && (
                    <Button onClick={handleManualRedirect} className="w-full">
                      Continue to Dashboard
                    </Button>
                  )}
                </>
              )}

              {state === 'redirect' && (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-gray-600 mb-4">{message}</p>
                  <Loader className="h-6 w-6 text-blue-500 animate-spin" />
                </>
              )}

              {state === 'error' && (
                <>
                  <XCircle className="h-12 w-12 text-red-500 mb-4" />
                  <p className="text-red-600 mb-4">{message}</p>
                  <div className="space-y-2 w-full">
                    <Button onClick={handleRetry} variant="outline" className="w-full">
                      Try Again
                    </Button>
                    <Button 
                      onClick={() => router.push('/auth/login')} 
                      variant="ghost" 
                      className="w-full"
                    >
                      Go to Login
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-500">
                Having trouble? Contact support for assistance.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
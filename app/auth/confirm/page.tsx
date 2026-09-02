"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { CheckCircle2, XCircle } from "@/app/components/ui/icons"
import {
  authReturnToFromSearchParams,
  resolvePostAuthRedirect,
} from "@/lib/auth/post-auth-redirect"

type ConfirmationState = 'needs_click' | 'loading' | 'success' | 'error' | 'redirect' | 'otp_channel_block'

function ConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<ConfirmationState>('needs_click')
  const [message, setMessage] = useState('')
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash')
    const redirectTo = searchParams.get('redirect_to') || ''
    const isOtpChannel =
      searchParams.get('auth_channel') === 'otp' || redirectTo.includes('auth_channel=otp')

    if (isOtpChannel) {
      setState('otp_channel_block')
      return
    }

    if (!tokenHash) {
      setState('error')
      setMessage('Missing confirmation token')
    }
  }, [searchParams])

  const handleConfirmation = async () => {
    setState('loading')
    try {
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const redirectTo = searchParams.get('redirect_to')
      const invitationType = searchParams.get('invitationType')
      const postAuthPath = resolvePostAuthRedirect(authReturnToFromSearchParams(searchParams))
      const setPasswordUrl = `/auth/set-password?returnTo=${encodeURIComponent(postAuthPath)}`

      if (!tokenHash) return

      const isOtpChannel =
        searchParams.get('auth_channel') === 'otp' ||
        (redirectTo || '').includes('auth_channel=otp')
      if (isOtpChannel) {
        setState('otp_channel_block')
        return
      }

      const supabase = createClient()

        // Handle different types of confirmations
        // Check if it's any kind of team invitation (admin invite or magic link)
        const isTeamInvitation = type === 'invite' || invitationType === 'team_invitation'
        
        if (isTeamInvitation) {
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
          
          // Check if user needs to set password (invited users always need to set password)
          const user = data.user
          const hasPasswordSet = user?.user_metadata?.password_set === true
          
          // For invitations, always require password setup unless explicitly set
          if (!hasPasswordSet) {
            console.log('🔐 User needs to set password, redirecting to password setup')
            setState('redirect')
            setMessage('Invitation confirmed! Setting up your account...')
            
            setTimeout(() => {
              router.push(
                redirectTo
                  ? `/auth/set-password?redirect_to=${encodeURIComponent(redirectTo)}`
                  : setPasswordUrl
              )
            }, 1500)
          } else if (redirectTo) {
            console.log('🔄 Redirecting to:', redirectTo)
            setState('redirect')
            setMessage('Invitation confirmed! Redirecting...')
            setTimeout(() => {
              window.location.href = decodeURIComponent(redirectTo)
            }, 1500)
          } else {
            setState('success')
            setMessage('Invitation confirmed successfully!')
            setRedirectUrl(postAuthPath)
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
          
          // Ensure we have a valid session after confirmation
          if (!data.session) {
            console.warn('⚠️ No session found after email confirmation, attempting to refresh session')
            // Try to refresh the session
            const { data: refreshedSession } = await supabase.auth.getSession()
            if (!refreshedSession.session) {
              setState('error')
              setMessage('Email confirmed but failed to establish session. Please try signing in manually.')
              return
            }
            console.log('✅ Session refreshed successfully after confirmation')
          }
          
          // Process referral code if present in user metadata
          const user = data.user
          const referralCode = user?.raw_user_meta_data?.referral_code
          
          if (referralCode) {
            try {
              console.log('🎯 Processing referral code:', referralCode)
              const referralResponse = await fetch('/api/process-referral', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${data.session?.access_token}`
                },
                body: JSON.stringify({ referralCode })
              })
              
              if (referralResponse.ok) {
                console.log('✅ Referral code processed successfully')
              } else {
                console.warn('⚠️ Failed to process referral code')
              }
            } catch (error) {
              console.warn('⚠️ Error processing referral code:', error)
            }
          }
          
          // Check if user needs to set password even for regular confirmations
          const hasPasswordSet = user?.user_metadata?.password_set === true
          
          if (!hasPasswordSet) {
            console.log('🔐 User needs to set password, redirecting to password setup')
            setState('redirect')
            setMessage('Email confirmed! Setting up your account...')
            
            setTimeout(() => {
              router.push(setPasswordUrl)
            }, 1500)
          } else {
            setState('redirect')
            setMessage('Email confirmed! Redirecting...')
            setTimeout(() => {
              window.location.href = postAuthPath
            }, 2000)
          }
        }

      } catch (error) {
        console.error('❌ Confirmation process error:', error)
        setState('error')
        setMessage('An unexpected error occurred during confirmation')
      }
  }

  const handleManualRedirect = () => {
    if (redirectUrl) {
      router.push(redirectUrl)
    }
  }

  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="bg-card border-border">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-foreground">
              Email Confirmation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center text-center">
              {state === 'otp_channel_block' && (
                <>
                  <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-foreground font-medium mb-2">Checkout code required</p>
                  <p className="text-muted-foreground text-sm">
                    This link is not meant to be clicked. Please go back to the checkout page and enter the 6-digit code we sent you.
                  </p>
                </>
              )}

              {state === 'needs_click' && (
                <>
                  <CheckCircle2 className="h-12 w-12 text-primary mb-4" />
                  <p className="text-muted-foreground mb-4">Click below to securely confirm your sign in.</p>
                  <Button onClick={handleConfirmation} className="w-full">
                    Confirm Sign In
                  </Button>
                </>
              )}

              {state === 'loading' && (
                <>
                  <div className="h-12 w-12 mb-4 animate-pulse bg-primary/20 rounded-full" />
                  <p className="text-muted-foreground">Confirming your email...</p>
                </>
              )}

              {state === 'success' && (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-muted-foreground mb-4">{message}</p>
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
                  <p className="text-muted-foreground mb-4">{message}</p>
                  <div className="h-6 w-6 animate-pulse bg-primary/20 rounded" />
                </>
              )}

              {state === 'error' && (
                <>
                  <XCircle className="h-12 w-12 text-destructive mb-4" />
                  <p className="text-destructive mb-4">{message}</p>
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
              <p className="text-xs text-muted-foreground">
                Having trouble? Contact support for assistance.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center text-center py-8">
              <div className="h-12 w-12 mb-4 animate-pulse bg-primary/20 rounded-full" />
              <p className="text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  )
} 
"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { CheckCircle2, XCircle } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  authReturnToFromSearchParams,
  resolvePostAuthRedirect,
} from "@/lib/auth/post-auth-redirect"

type ConfirmationState = 'needs_click' | 'loading' | 'success' | 'error' | 'redirect' | 'otp_channel_block'

function ConfirmContent() {
  const { t } = useLocalization()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [confirmationState, setState] = useState<ConfirmationState>('needs_click')
  const [confirmationMessage, setMessage] = useState('')
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const isRecovery = searchParams.get('type') === 'recovery'
  const isOtpChannel = searchParams.get('auth_channel') === 'otp' ||
    (searchParams.get('redirect_to') || '').includes('auth_channel=otp')
  const hasToken = Boolean(searchParams.get('token_hash'))
  const state = isOtpChannel ? 'otp_channel_block' : !hasToken ? 'error' : confirmationState
  const message = !hasToken ? t('auth.flows.confirm.missingToken') : confirmationMessage ? t(confirmationMessage) : ''

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
            setMessage('auth.flows.confirm.failedInvitation')
            return
          }

          console.log('✅ Invitation confirmed successfully')
          
          // Check if user needs to set password (invited users always need to set password)
          const user = data.user
          const hasPasswordSet = user?.user_metadata?.password_set === true
          
          // For invitations, always require password setup unless explicitly set
          if (!hasPasswordSet) {
            console.log('🔐 User needs to set password, redirecting to password setup')
            setState('redirect')
            setMessage('auth.flows.confirm.invitationSetup')
            
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
            setMessage('auth.flows.confirm.invitationRedirect')
            setTimeout(() => {
              window.location.href = decodeURIComponent(redirectTo)
            }, 1500)
          } else {
            setState('success')
            setMessage('auth.flows.confirm.invitationSuccess')
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
            setMessage('auth.flows.confirm.failedEmail')
            return
          }

          console.log('✅ Email confirmed successfully')
          
          // Ensure we have a valid session after confirmation
          if (!data.session) {
            console.warn('⚠️ No session found after email confirmation, attempting to refresh session')
            // Try to refresh the session
            const { data: refreshedSession } = await supabase.auth.getSession()
            if (!refreshedSession.session) {
              setState('error')
              setMessage('auth.flows.confirm.noSession')
              return
            }
            console.log('✅ Session refreshed successfully after confirmation')
          }

          // Recovery must reset an existing password, not follow normal sign-in routing.
          if (type === 'recovery') {
            setState('redirect')
            setMessage('auth.flows.confirm.recoveryRedirect')
            router.replace(setPasswordUrl)
            return
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
            setMessage('auth.flows.confirm.emailSetup')
            
            setTimeout(() => {
              router.push(setPasswordUrl)
            }, 1500)
          } else {
            setState('redirect')
            setMessage('auth.flows.confirm.emailRedirect')
            setTimeout(() => {
              window.location.href = postAuthPath
            }, 2000)
          }
        }

      } catch (error) {
        console.error('❌ Confirmation process error:', error)
        setState('error')
        setMessage('auth.flows.confirm.unexpectedError')
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
              {t(isRecovery ? 'auth.flows.reset.title' : 'auth.flows.confirm.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center text-center">
              {state === 'otp_channel_block' && (
                <>
                  <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-foreground font-medium mb-2">{t('auth.flows.confirm.checkoutCodeTitle')}</p>
                  <p className="text-muted-foreground text-sm">
                    {t('auth.flows.confirm.checkoutCodeDescription')}
                  </p>
                </>
              )}

              {state === 'needs_click' && (
                <>
                  <CheckCircle2 className="h-12 w-12 text-primary mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {t(isRecovery ? 'auth.flows.confirm.recoveryPrompt' : 'auth.flows.confirm.signInPrompt')}
                  </p>
                  <Button onClick={handleConfirmation} className="w-full">
                    {t(isRecovery ? 'auth.flows.reset.title' : 'auth.flows.confirm.signIn')}
                  </Button>
                </>
              )}

              {state === 'loading' && (
                <>
                  <div className="h-12 w-12 mb-4 animate-pulse bg-primary/20 rounded-full" />
                  <p className="text-muted-foreground">
                    {t(isRecovery ? 'auth.flows.confirm.verifyingRecovery' : 'auth.flows.confirm.verifyingEmail')}
                  </p>
                </>
              )}

              {state === 'success' && (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-muted-foreground mb-4">{message}</p>
                  {redirectUrl && (
                    <Button onClick={handleManualRedirect} className="w-full">
                      {t('auth.flows.continueDashboard')}
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
                      {t('auth.flows.tryAgain')}
                    </Button>
                    <Button 
                      onClick={() => router.push('/auth/login')} 
                      variant="ghost" 
                      className="w-full"
                    >
                      {t('auth.flows.goToLogin')}
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                {t('auth.flows.confirm.support')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  const { t } = useLocalization()
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center text-center py-8">
              <div className="h-12 w-12 mb-4 animate-pulse bg-primary/20 rounded-full" />
              <p className="text-muted-foreground">{t('common.loading')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  )
} 
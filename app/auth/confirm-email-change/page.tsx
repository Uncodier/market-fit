"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Loader, CheckCircle2, XCircle, Shield } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"

type ConfirmationState = 'loading' | 'success' | 'error'

function ConfirmEmailChangeContent() {
  const { t } = useLocalization()
  const translate = useRef(t)
  useEffect(() => { translate.current = t }, [t])
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<ConfirmationState>('loading')
  const [message, setMessage] = useState('')
  const [newEmail, setNewEmail] = useState<string | null>(null)

  useEffect(() => {
    const handleEmailChangeConfirmation = async () => {
      try {
        const tokenHash = searchParams.get('token_hash')
        const type = searchParams.get('type')

        if (!tokenHash) {
          setState('error')
          setMessage('auth.flows.confirm.missingToken')
          return
        }

        if (type !== 'email_change') {
          setState('error')
          setMessage('auth.flows.emailChange.invalidType')
          return
        }

        const supabase = createClient()

        // Verify the OTP token
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'email_change'
        })

        if (error) {
          console.error('Email change confirmation error:', error)
          setState('error')
          setMessage('auth.flows.emailChange.failed')
          return
        }

        if (!data.user) {
          setState('error')
          setMessage('auth.flows.emailChange.missingUser')
          return
        }

        const updatedEmail = data.user.email

        if (!updatedEmail) {
          setState('error')
          setMessage('auth.flows.emailChange.missingEmail')
          return
        }

        setNewEmail(updatedEmail)

        // Update email in profiles table
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ email: updatedEmail })
          .eq('id', data.user.id)

        if (profileError) {
          console.error('Error updating profile email:', profileError)
          // Don't fail the whole process if profile update fails
          // The auth email is already updated
        }

        setState('success')
        setMessage('auth.flows.emailChange.success')
        toast.success(translate.current('auth.flows.emailChange.success'))

        // Redirect to profile page after 2 seconds
        setTimeout(() => {
          router.push('/profile')
        }, 2000)

      } catch (error) {
        console.error('Email change confirmation error:', error)
        setState('error')
        setMessage('auth.flows.emailChange.unexpectedError')
      }
    }

    handleEmailChangeConfirmation()
  }, [searchParams, router])

  const handleRetry = () => {
    window.location.reload()
  }

  const handleGoToProfile = () => {
    router.push('/profile')
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {state === 'loading' && <Loader className="h-12 w-12 text-primary" />}
            {state === 'success' && <CheckCircle2 className="h-12 w-12 text-green-500" />}
            {state === 'error' && <XCircle className="h-12 w-12 text-destructive" />}
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <Shield className="h-5 w-5" />
            {state === 'loading' && t('auth.flows.emailChange.title')}
            {state === 'success' && t('auth.flows.emailChange.successTitle')}
            {state === 'error' && t('auth.flows.emailChange.failedTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === 'loading' && (
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                {t('auth.flows.emailChange.verifying')}
              </p>
            </div>
          )}

          {state === 'success' && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  {t('auth.flows.emailChange.changedTo')}
                </p>
                <p className="text-base font-medium text-green-900 dark:text-green-100 mt-2">
                  {newEmail}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('auth.flows.emailChange.redirecting')}
              </p>
              <Button onClick={handleGoToProfile} className="w-full">
                {t('auth.flows.emailChange.goToProfile')}
              </Button>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">
                  {message ? t(message) : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleRetry} variant="outline" className="flex-1">
                  {t('auth.flows.retry')}
                </Button>
                <Button onClick={handleGoToProfile} className="flex-1">
                  {t('auth.flows.emailChange.goToProfile')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ConfirmEmailChangePage() {
  const { t } = useLocalization()
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen" role="status" aria-label={t('common.loading')}>
        <Loader className="h-8 w-8 text-primary" />
      </div>
    }>
      <ConfirmEmailChangeContent />
    </Suspense>
  )
}


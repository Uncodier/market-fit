"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Loader, CheckCircle2, XCircle, Mail, Shield } from "@/app/components/ui/icons"
import { toast } from "sonner"

type ConfirmationState = 'loading' | 'success' | 'error'

function ConfirmEmailChangeContent() {
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
          setMessage('Missing confirmation token')
          return
        }

        if (type !== 'email_change') {
          setState('error')
          setMessage('Invalid confirmation type')
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
          setMessage(error.message || 'Failed to confirm email change')
          return
        }

        if (!data.user) {
          setState('error')
          setMessage('User not found after confirmation')
          return
        }

        const updatedEmail = data.user.email

        if (!updatedEmail) {
          setState('error')
          setMessage('Email not found after confirmation')
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
        setMessage('Email changed successfully!')
        toast.success('Email changed successfully')

        // Redirect to profile page after 2 seconds
        setTimeout(() => {
          router.push('/profile')
        }, 2000)

      } catch (error) {
        console.error('Email change confirmation error:', error)
        setState('error')
        setMessage('An unexpected error occurred during email change confirmation')
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
            {state === 'loading' && 'Confirming Email Change'}
            {state === 'success' && 'Email Changed Successfully'}
            {state === 'error' && 'Confirmation Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === 'loading' && (
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Verifying your email change...
              </p>
            </div>
          )}

          {state === 'success' && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Your email has been successfully changed to:
                </p>
                <p className="text-base font-medium text-green-900 dark:text-green-100 mt-2">
                  {newEmail}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Redirecting to your profile...
              </p>
              <Button onClick={handleGoToProfile} className="w-full">
                Go to Profile
              </Button>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">
                  {message}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleRetry} variant="outline" className="flex-1">
                  Retry
                </Button>
                <Button onClick={handleGoToProfile} className="flex-1">
                  Go to Profile
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
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 text-primary" />
      </div>
    }>
      <ConfirmEmailChangeContent />
    </Suspense>
  )
}


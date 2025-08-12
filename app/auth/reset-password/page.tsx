"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/app/components/ui/card"
import { Loader } from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { toast } from "sonner"

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isProcessing, setIsProcessing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const processResetToken = async () => {
      try {
        // Extract tokens from URL fragment
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')
        
        console.log('[Reset Password] URL fragments:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type
        })

        if (!accessToken || !refreshToken || type !== 'recovery') {
          throw new Error('Invalid reset password link. Please request a new password reset.')
        }

        const supabase = createClient()

        // Set the session using the tokens from the URL
        const { data: { session }, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })

        if (sessionError) {
          console.error('[Reset Password] Session error:', sessionError)
          throw new Error(`Failed to establish session: ${sessionError.message}`)
        }

        if (!session || !session.user) {
          throw new Error('Failed to establish session. Please try again.')
        }

        console.log('[Reset Password] Session established successfully for:', session.user.email)

        // Get returnTo parameter if it exists
        const returnTo = searchParams.get('returnTo') || '/dashboard'
        
        // Clear the URL fragments and redirect to set-password
        const setPasswordUrl = `/auth/set-password?redirect_to=${encodeURIComponent(returnTo)}`
        
        // Use replace to avoid having the token-containing URL in history
        window.history.replaceState({}, '', '/auth/reset-password')
        
        // Small delay to ensure session is properly set
        setTimeout(() => {
          router.push(setPasswordUrl)
        }, 100)

      } catch (error: any) {
        console.error('[Reset Password] Error:', error)
        setError(error.message || 'An unexpected error occurred')
        setIsProcessing(false)
        
        // Redirect to auth page with error after a delay
        setTimeout(() => {
          router.push(`/auth?error=${encodeURIComponent(error.message || 'Reset password failed')}`)
        }, 3000)
      }
    }

    // Only process if we're on the client side
    if (typeof window !== 'undefined') {
      processResetToken()
    }
  }, [router, searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card>
            <CardContent className="flex flex-col items-center text-center py-8">
              <div className="bg-red-100 p-3 rounded-full mb-4">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.98-.833-2.75 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Reset Password Failed</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <p className="text-sm text-gray-500">Redirecting you back to the login page...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card>
          <CardContent className="flex flex-col items-center text-center py-8">
            <LoadingSkeleton variant="fullscreen" size="lg" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Reset Link</h3>
            <p className="text-gray-600">Please wait while we verify your reset password link...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card>
            <CardContent className="flex flex-col items-center text-center py-8">
              <LoadingSkeleton variant="fullscreen" size="lg" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Loading</h3>
              <p className="text-gray-600">Please wait...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
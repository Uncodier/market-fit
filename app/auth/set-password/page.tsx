"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Loader, Eye, EyeOff, CheckCircle2, Lock } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"

function SetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  const redirectTo = searchParams.get('redirect_to')

  // Check for active session on component mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient()
        const { data: { session }, error } = await supabase.auth.getSession()
        
        console.log('[Set Password] Session check:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          error: error?.message
        })

        if (error) {
          console.error('[Set Password] Session error:', error)
          setSessionError(`Session error: ${error.message}`)
          return
        }

        if (!session || !session.user) {
          console.error('[Set Password] No active session found')
          setSessionError('No active session found. Please request a new password reset link.')
          
          // Redirect to auth page after a delay
          setTimeout(() => {
            router.push('/auth?error=' + encodeURIComponent('Session expired. Please request a new password reset.'))
          }, 3000)
          return
        }

        console.log('[Set Password] Valid session found for:', session.user.email)
      } catch (error: any) {
        console.error('[Set Password] Session check error:', error)
        setSessionError('Failed to verify session. Please try again.')
      } finally {
        setIsCheckingSession(false)
      }
    }

    checkSession()
  }, [router])

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return "Password must be at least 8 characters long"
    if (!/(?=.*[a-z])/.test(pwd)) return "Password must contain at least one lowercase letter"
    if (!/(?=.*[A-Z])/.test(pwd)) return "Password must contain at least one uppercase letter"
    if (!/(?=.*\d)/.test(pwd)) return "Password must contain at least one number"
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password || !confirmPassword) {
      toast.error("Please fill in all fields")
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()

      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password,
        data: {
          password_set: true // Mark that password has been set
        }
      })

      if (error) {
        console.error('❌ Password update error:', error)
        
        // Handle specific session errors
        if (error.message.includes('session') || error.message.includes('JWT')) {
          toast.error("Your session has expired. Please request a new password reset link.")
          setTimeout(() => {
            router.push('/auth?error=' + encodeURIComponent('Session expired. Please request a new password reset.'))
          }, 2000)
        } else {
          toast.error(error.message || "Failed to set password")
        }
        return
      }

      console.log('✅ Password set successfully')
      toast.success("Password set successfully!")

      // Redirect to the original destination or team invitation
      // Use window.location.href to ensure cookies are properly sent
      if (redirectTo) {
        const decodedRedirect = decodeURIComponent(redirectTo)
        console.log('🔄 Redirecting to:', decodedRedirect)
        
        setTimeout(() => {
          window.location.href = decodedRedirect
        }, 1000)
      } else {
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 1000)
      }

    } catch (error) {
      console.error('❌ Password setup error:', error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const passwordError = password ? validatePassword(password) : null
  const confirmError = confirmPassword && password !== confirmPassword ? "Passwords do not match" : null

  // Show loading state while checking session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card>
            <CardContent className="flex flex-col items-center text-center py-8">
              <LoadingSkeleton variant="fullscreen" size="lg" />
              <p className="text-gray-600">Verifying your session...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show error state if session is invalid
  if (sessionError) {
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">Session Error</h3>
              <p className="text-gray-600 mb-4">{sessionError}</p>
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
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <Lock className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">
              Set Your Password
            </CardTitle>
            <p className="text-gray-600 mt-2">
              Complete your account setup by creating a secure password
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className={`pr-10 ${passwordError ? 'border-red-300' : ''}`}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-red-600 text-xs mt-1">{passwordError}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm Password
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className={`pr-10 ${confirmError ? 'border-red-300' : ''}`}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {confirmError && (
                    <p className="text-red-600 text-xs mt-1">{confirmError}</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Password requirements:</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li className="flex items-center">
                    <CheckCircle2 className={`h-3 w-3 mr-2 ${password.length >= 8 ? 'text-green-500' : 'text-gray-300'}`} />
                    At least 8 characters
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className={`h-3 w-3 mr-2 ${/(?=.*[a-z])/.test(password) ? 'text-green-500' : 'text-gray-300'}`} />
                    One lowercase letter
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className={`h-3 w-3 mr-2 ${/(?=.*[A-Z])/.test(password) ? 'text-green-500' : 'text-gray-300'}`} />
                    One uppercase letter
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className={`h-3 w-3 mr-2 ${/(?=.*\d)/.test(password) ? 'text-green-500' : 'text-gray-300'}`} />
                    One number
                  </li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !!passwordError || !!confirmError || !password || !confirmPassword}
              >
                {isLoading ? (
                  <>
                    <LoadingSkeleton variant="button" size="sm" />
                    Setting Password...
                  </>
                ) : (
                  'Set Password & Continue'
                )}
              </Button>
            </form>

            <div className="text-center mt-6">
              <p className="text-xs text-gray-500">
                Your password will be encrypted and stored securely.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card>
            <CardContent className="flex flex-col items-center text-center py-8">
              <LoadingSkeleton variant="fullscreen" size="lg" />
              <p className="text-gray-600">Loading...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <SetPasswordContent />
    </Suspense>
  )
} 
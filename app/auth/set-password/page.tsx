"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Eye, EyeOff, Lock, AlertCircle } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { Alert, AlertDescription } from "@/app/components/ui/alert"
import { resolveSetPasswordRedirect } from "@/lib/auth/post-auth-redirect"
import { useLocalization } from "@/app/context/LocalizationContext"
import { PasswordRequirements, passwordUpdateErrorKey, validatePassword, type PasswordError } from "./password-requirements"

function SetPasswordContent() {
  const { t } = useLocalization()
  const translate = useRef(t)
  useEffect(() => { translate.current = t }, [t])
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [apiError, setApiError] = useState<{ code?: string; message: string } | null>(null)

  const redirectTo = resolveSetPasswordRedirect(searchParams)

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
          setSessionError('auth.flows.password.sessionFailed')
          return
        }

        if (!session || !session.user) {
          console.error('[Set Password] No active session found')
          setSessionError('auth.flows.password.noSession')
          
          // Redirect to auth page after a delay
          setTimeout(() => {
            router.push('/auth?error=' + encodeURIComponent(translate.current('auth.flows.password.sessionExpiredRedirect')))
          }, 3000)
          return
        }

        console.log('[Set Password] Valid session found for:', session.user.email)
      } catch (error: unknown) {
        console.error('[Set Password] Session check error:', error)
        setSessionError('auth.flows.password.verifySessionFailed')
      } finally {
        setIsCheckingSession(false)
      }
    }

    checkSession()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clear any previous API errors
    setApiError(null)
    
    if (!password || !confirmPassword) {
      toast.error(t('auth.flows.password.allFieldsRequired'))
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      toast.error(t(passwordError))
      return
    }

    if (password !== confirmPassword) {
      toast.error(t('auth.flows.password.mismatch'))
      return
    }

    setIsLoading(true)

    let isRedirecting = false

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
        
        // Check for session errors FIRST, before parsing
        // This ensures session expiration UX is handled correctly
        const errorMessage = error.message || ''
        const errorCode = (error as PasswordError)?.code || ''
        const isSessionError = 
          errorMessage.toLowerCase().includes('session') || 
          errorMessage.toLowerCase().includes('jwt') ||
          errorMessage.toLowerCase().includes('token') ||
          errorCode.toLowerCase().includes('session') ||
          errorCode.toLowerCase().includes('jwt') ||
          errorCode.toLowerCase().includes('token')
        
        if (isSessionError) {
          toast.error(translate.current('auth.flows.password.sessionExpired'))
          setTimeout(() => {
            window.location.href = '/auth?error=' + encodeURIComponent(translate.current('auth.flows.password.sessionExpiredRedirect'))
          }, 2000)
          setIsLoading(false)
          return
        }
        
        // Try to parse error message as JSON (in case it's a stringified JSON)
        let parsedError: { code?: string; message: string } | null = null
        try {
          if (error.message && error.message.startsWith('{')) {
            parsedError = JSON.parse(error.message)
          } else if (error.message && error.message.includes('code') && error.message.includes('message')) {
            const jsonMatch = error.message.match(/\{.*\}/)
            if (jsonMatch) {
              parsedError = JSON.parse(jsonMatch[0])
            }
          }
        } catch {
          // If parsing fails, continue with regular error handling
        }

        if (!parsedError && error && typeof error === 'object') {
          if ('code' in error && 'message' in error) {
            parsedError = {
              code: (error as PasswordError).code,
              message: (error as PasswordError).message
            }
          } else if ('details' in error && (error as PasswordError).details) {
            const details = (error as PasswordError).details!
            if (typeof details === 'object' && 'code' in details && 'message' in details) {
              parsedError = {
                code: details.code,
                message: details.message
              }
            } else if (typeof details === 'string' && details.startsWith('{')) {
              try {
                parsedError = JSON.parse(details)
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        if (parsedError && parsedError.message) {
          setApiError({
            code: parsedError.code,
            message: parsedError.message
          })
          setIsLoading(false)
          return
        }
        
        setApiError({
          message: error.message || "Failed to set password"
        })
        setIsLoading(false)
        return
      }

      console.log('✅ Password set successfully')
      
      // Send success toast right away so the user knows it worked!
      toast.success(translate.current('auth.flows.password.success'))
      setApiError(null)
      isRedirecting = true
      
      // Refresh session to ensure it's valid before redirecting
      console.log('🔄 Refreshing session after password update...')
      const { data: { session: refreshedSession } } = await supabase.auth.getSession()
      
      if (!refreshedSession || !refreshedSession.user) {
        console.error('[Set Password] No session after password update, attempting to get user...')
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          console.error('[Set Password] Failed to get user after password update')
          
          // Instead of throwing an error here, treat it as a success but request re-login.
          toast.info(translate.current('auth.flows.password.signIn'))
          
          setTimeout(() => {
            window.location.href = '/auth?message=' + encodeURIComponent(translate.current('auth.flows.password.signInRedirect'))
          }, 2000)
          return
        }
      }
      
      console.log('[Set Password] Session verified, user:', refreshedSession?.user?.email || 'verified')

      const targetUrl = redirectTo
      console.log('🔄 Redirecting to:', targetUrl)
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Use window.location.href directly to force full reload and ensure server cookies are applied
      window.location.href = targetUrl

    } catch (caughtError: unknown) {
      const error = caughtError as PasswordError | null
      console.error('❌ Password setup error:', error)
      
      const errorMessage = error?.message || ''
      const errorCode = error?.code || ''
      const isSessionError = 
        errorMessage.toLowerCase().includes('session') || 
        errorMessage.toLowerCase().includes('jwt') ||
        errorMessage.toLowerCase().includes('token') ||
        errorCode.toLowerCase().includes('session') ||
        errorCode.toLowerCase().includes('jwt') ||
        errorCode.toLowerCase().includes('token')
      
      if (isSessionError) {
        toast.error(translate.current('auth.flows.password.sessionExpired'))
        setTimeout(() => {
          window.location.href = '/auth?error=' + encodeURIComponent(translate.current('auth.flows.password.sessionExpiredRedirect'))
        }, 2000)
        setIsLoading(false)
        return
      }
      
      let parsedError: { code?: string; message: string } | null = null
      try {
        if (error?.message && typeof error.message === 'string') {
          if (error.message.startsWith('{')) {
            parsedError = JSON.parse(error.message)
          } else if (error.message.includes('code') && error.message.includes('message')) {
            const jsonMatch = error.message.match(/\{.*\}/)
            if (jsonMatch) {
              parsedError = JSON.parse(jsonMatch[0])
            }
          }
        }
        
        if (!parsedError && error && typeof error === 'object' && 'code' in error && 'message' in error) {
          parsedError = {
            code: error.code,
            message: error.message
          }
        }
      } catch {}

      if (parsedError && parsedError.message) {
        setApiError({
          code: parsedError.code,
          message: parsedError.message
        })
      } else {
        setApiError({
          message: error?.message || "An unexpected error occurred"
        })
      }
    } finally {
      // Clean up loading state if we failed, or if we are redirecting we keep it true
      if (!isRedirecting) {
        setIsLoading(false)
      }
    }
  }

  const passwordError = password ? validatePassword(password) : null
  const confirmError = confirmPassword && password !== confirmPassword ? 'auth.flows.password.mismatch' : null

  // Show loading state while checking session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center text-center py-8">
              <LoadingSkeleton variant="fullscreen" size="lg" />
              <p className="text-muted-foreground mt-4">{t('auth.flows.password.verifyingSession')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show error state if session is invalid
  if (sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center text-center py-8">
              <div className="bg-destructive/10 p-3 rounded-full mb-4">
                <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.98-.833-2.75 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">{t('auth.flows.password.sessionErrorTitle')}</h3>
              <p className="text-muted-foreground mb-4">{t(sessionError)}</p>
              <p className="text-sm text-muted-foreground">{t('auth.flows.redirectingLogin')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="bg-card border-border">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <Lock className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              {t('auth.flows.password.title')}
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              {t('auth.flows.password.description')}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {apiError && (
                <Alert variant="destructive">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <AlertDescription className="m-0">{t(passwordUpdateErrorKey(apiError))}</AlertDescription>
                  </div>
                </Alert>
              )}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="password" className="text-sm font-medium">
                    {t('auth.password')}
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        // Clear API error when user starts typing
                        if (apiError) {
                          setApiError(null)
                        }
                      }}
                      placeholder={t('auth.passwordPlaceholder')}
                      className={`pr-10 ${passwordError ? 'border-red-300' : ''}`}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={t(showPassword ? 'auth.flows.password.hide' : 'auth.flows.password.show')}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-red-600 text-xs mt-1">{t(passwordError)}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    {t('auth.flows.password.confirmLabel')}
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        // Clear API error when user starts typing
                        if (apiError) {
                          setApiError(null)
                        }
                      }}
                      placeholder={t('auth.flows.password.confirmPlaceholder')}
                      className={`pr-10 ${confirmError ? 'border-red-300' : ''}`}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={t(showConfirmPassword ? 'auth.flows.password.hideConfirm' : 'auth.flows.password.showConfirm')}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {confirmError && (
                    <p className="text-red-600 text-xs mt-1">{t(confirmError)}</p>
                  )}
                </div>
              </div>

              <PasswordRequirements password={password} />

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !!passwordError || !!confirmError || !password || !confirmPassword}
              >
                {isLoading ? (
                  <>
                    <LoadingSkeleton variant="button" size="sm" />
                    {t('auth.flows.password.setting')}
                  </>
                ) : (
                  t('auth.flows.password.submit')
                )}
              </Button>
            </form>

            <div className="text-center mt-6">
              <p className="text-xs text-gray-500">
                {t('auth.flows.password.security')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  const { t } = useLocalization()
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center text-center py-8">
              <LoadingSkeleton variant="fullscreen" size="lg" />
              <p className="text-muted-foreground mt-4">{t('common.loading')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <SetPasswordContent />
    </Suspense>
  )
} 
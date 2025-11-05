'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/app/context/ThemeContext'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/app/components/ui/form"
import { Input } from "@/app/components/ui/input"
import { InputWithIcon } from "@/app/components/ui/input-with-icon"
import { Button } from "@/app/components/ui/button"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Eye, EyeOff, Lock, Mail, User, AlertCircle, Check, Tag, Google } from "@/app/components/ui/icons"
import { Separator } from "@/app/components/ui/separator"
import { Alert, AlertDescription } from "@/app/components/ui/alert"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"

interface AuthFormProps {
  mode?: 'login' | 'register'
  returnTo?: string | null
  defaultAuthType?: string
  signupData?: {
    email?: string
    name?: string
    referralCode?: string
  }
  onAuthTypeChange?: (authType: string) => void
  initialError?: string | null
}

// Create schema with conditional validation for referral code
const authFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().optional(),
  referralCode: z.string().optional(),
})

// Schema for reset password form
const resetPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

type AuthFormValues = z.infer<typeof authFormSchema>
type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

export function AuthForm({ mode = 'login', returnTo, defaultAuthType, signupData, onAuthTypeChange, initialError }: AuthFormProps) {
  const supabase = createClient()
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'sign_in' | 'sign_up' | 'reset_password'>(
    defaultAuthType === 'signup' ? 'sign_up' : 'sign_in'
  )
  const [referralCodeStatus, setReferralCodeStatus] = useState<'unchecked' | 'valid' | 'invalid' | 'checking'>('unchecked')
  const [isWaitlistMode, setIsWaitlistMode] = useState(false)
  const [waitlistSuccess, setWaitlistSuccess] = useState(false)
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false)
  
  // Get returnTo from URL or default to projects selection
  const [finalReturnTo, setFinalReturnTo] = useState<string>('/projects')
  
  const isDark = theme === 'dark'
  
  // Set default form values with pre-filled data
  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
    defaultValues: {
      email: signupData?.email || "",
      password: "",
      name: signupData?.name || "",
      referralCode: signupData?.referralCode || "",
    }
  })

  // Form for reset password
  const resetForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
    }
  })

  useEffect(() => {
    setMounted(true)
    
    // Clear Supabase auth state if there are PKCE-related errors
    if (initialError && initialError.includes('team invitation')) {
      console.log('🧹 Clearing Supabase auth state due to team invitation error')
      supabase.auth.signOut({ scope: 'local' }).catch(console.warn)
    }
    
    // Get returnTo from URL if not provided as prop
    if (!returnTo && typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const urlReturnTo = url.searchParams.get('returnTo')
      setFinalReturnTo(urlReturnTo || '/projects')
    } else {
      setFinalReturnTo(returnTo || '/projects')
    }

    // If signup data is provided, validate referral code immediately
    if (signupData?.referralCode && authMode === 'sign_up') {
      validateReferralCode(signupData.referralCode)
    }

    // Set initial error if provided
    if (initialError) {
      setErrorMessage(initialError)
    }
  }, [returnTo, signupData, initialError, supabase.auth])

  // Handle auth type change (sign in, sign up, or reset password)
  const handleAuthModeChange = (newMode: 'sign_in' | 'sign_up' | 'reset_password') => {
    setAuthMode(newMode)
    setErrorMessage(null)
    setResetPasswordSuccess(false)
    
    // Notify parent component of the change
    if (onAuthTypeChange) {
      onAuthTypeChange(newMode === 'sign_up' ? 'signup' : newMode === 'reset_password' ? 'reset' : 'signin')
    }
  }

  const toggleAuthMode = () => {
    const newMode = authMode === 'sign_in' ? 'sign_up' : 'sign_in'
    handleAuthModeChange(newMode)
  }

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  // Validate referral code function (informational only, doesn't block signup)
  const validateReferralCode = async (code: string) => {
    if (!code.trim()) {
      setReferralCodeStatus('unchecked')
      setIsWaitlistMode(false)
      return
    }

    setReferralCodeStatus('checking')
    
    try {
      const { data, error } = await supabase.rpc('validate_referral_code', { 
        code_param: code.trim() 
      })
      
      if (error) throw error
      
      if (data) {
        setReferralCodeStatus('valid')
        setIsWaitlistMode(false)
      } else {
        setReferralCodeStatus('invalid')
        setIsWaitlistMode(false) // Don't block signup, just mark as invalid
      }
    } catch (error) {
      console.error('Error validating referral code:', error)
      setReferralCodeStatus('invalid')
      setIsWaitlistMode(false) // Don't block signup, just mark as invalid
    }
  }

  // Handle referral code input change with debounce
  useEffect(() => {
    const referralCode = form.watch('referralCode')
    const timer = setTimeout(() => {
      if (authMode === 'sign_up') {
        validateReferralCode(referralCode || '')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [form.watch('referralCode'), authMode])

  // Handle form submission
  const onSubmit = async (values: AuthFormValues) => {
    setLoading(true)
    setErrorMessage(null)
    
    try {
      if (authMode === 'sign_up') {
        // Check if email already exists with different auth method
        const emailCheckResponse = await fetch('/api/auth/check-email-exists', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: values.email })
        })
        
        const emailCheckResult = await emailCheckResponse.json()
        
        if (emailCheckResult.exists && emailCheckResult.provider !== 'email') {
          throw new Error(`An account already exists with this email using ${emailCheckResult.provider}. Please sign in with ${emailCheckResult.provider} instead.`)
        }

        // Create new user with email and password
        // Only include referral code in metadata if it's valid
        const userMetadata: { name?: string; referral_code?: string } = {
          name: values.name || ''
        }
        if (values.referralCode && referralCodeStatus === 'valid') {
          userMetadata.referral_code = values.referralCode
        }

        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm?returnTo=${encodeURIComponent(finalReturnTo)}`,
            data: userMetadata
          }
        })

        if (error) {
          throw error
        }

        if (data.user?.email_confirmed_at) {
          // User was automatically confirmed
          // Process referral code if provided and valid
          if (values.referralCode && referralCodeStatus === 'valid') {
            try {
              const referralResponse = await fetch('/api/process-referral', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ referralCode: values.referralCode })
              })
              
              if (!referralResponse.ok) {
                console.warn('Failed to process referral code after signup')
              }
            } catch (error) {
              console.warn('Error processing referral code:', error)
            }
          }
          window.location.href = finalReturnTo
        } else {
          // User needs to confirm email
          // Process referral code if provided and valid (will be processed after email confirmation)
          console.log('User created successfully, confirmation email sent to:', values.email)
          setErrorMessage(`✅ Account created successfully! We've sent a confirmation email to ${values.email}. Please check your email and click the confirmation link to complete your setup. After confirming, you can sign in with your credentials.`)
        }
      } else {
        // Sign in existing user
        console.log('Attempting to sign in user:', values.email)
        const { data, error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password
        })

        if (error) {
          throw error
        }

        if (data.user && data.session) {
          console.log('Sign in successful, user authenticated:', data.user.email)
          console.log('Session established, redirecting to:', finalReturnTo)
          
          // Redirect immediately without timeout
          window.location.href = finalReturnTo
        } else if (data.user && !data.session) {
          console.warn('User exists but no session created, this may indicate email not confirmed')
          setErrorMessage('Account found but not fully activated. Please check your email for a confirmation link, or contact support if you need help.')
        } else {
          setErrorMessage('Sign in failed. Please check your credentials and try again.')
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error)
      setErrorMessage(error.message || 'An error occurred during authentication. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Google sign in
  const handleGoogleSignIn = async () => {
    setLoading(true)
    setErrorMessage(null)
    
    try {
      // Clear any existing auth state to prevent PKCE conflicts
      console.log('🧹 Clearing auth state before Google OAuth to prevent PKCE conflicts')
      await supabase.auth.signOut({ scope: 'local' })
      
      // Small delay to ensure state is cleared
      await new Promise(resolve => setTimeout(resolve, 100))

      // Pre-authenticate with Google before redirect
      const response = await fetch('/api/auth/google-pre-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: authMode,
          referralCode: authMode === 'sign_up' ? form.getValues('referralCode') : undefined,
          returnTo: finalReturnTo
        })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to initiate Google authentication')
      }

      console.log('🔄 Starting Google OAuth flow with clean state')
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(finalReturnTo)}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: false
        }
      })

      if (error) {
        console.error('🚫 Google OAuth error:', error)
        throw error
      }
      
      console.log('✅ Google OAuth initiated successfully')
    } catch (error: any) {
      console.error('Google sign in error:', error)
      
      // Handle PKCE-specific errors with user-friendly messages
      if (error.message && error.message.includes('code verifier')) {
        setErrorMessage('Authentication session expired. Please try signing in with Google again.')
      } else {
        setErrorMessage(error.message || 'Failed to sign in with Google. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Handle reset password submission
  const onResetPasswordSubmit = async (values: ResetPasswordValues) => {
    setLoading(true)
    setErrorMessage(null)
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/reset-password?returnTo=${encodeURIComponent(finalReturnTo)}`
      })
      
      if (error) {
        throw error
      }
      
      setResetPasswordSuccess(true)
      setErrorMessage("Check your email for a password reset link. The link will expire in 1 hour.")
    } catch (error: any) {
      console.error('Reset password error:', error)
      setErrorMessage(error.message || 'Failed to send reset password email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getReferralCodeIcon = () => {
    if (referralCodeStatus === 'valid') return <Check className="h-4 w-4 text-green-500" />
    if (referralCodeStatus === 'checking') return <LoadingSkeleton size="sm" />
    return null
  }

  const getSignupTitle = () => {
    return "Create Your Account"
  }

  const getSignupDescription = () => {
    return "Enter your details to get started"
  }

  const isGoogleButtonEnabled = () => {
    // Always enable Google signup button
    return true
  }

  if (!mounted) return null

  return (
    <div className="space-y-6">
      {errorMessage && (
        <Alert variant={errorMessage.includes('Check your email') || resetPasswordSuccess ? 'default' : 'destructive'}>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="m-0">{errorMessage}</AlertDescription>
          </div>
        </Alert>
      )}

      {/* Referral code status messages for signup */}
      {authMode === 'sign_up' && referralCodeStatus === 'invalid' && (
        <Alert>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="m-0">
              Invalid referral code. You can still create your account without it.
            </AlertDescription>
          </div>
        </Alert>
      )}

      {authMode === 'sign_up' && referralCodeStatus === 'valid' && (
        <Alert variant="default" className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 flex-shrink-0 text-green-600" />
            <AlertDescription className="m-0 text-green-800 dark:text-green-200">
              Valid referral code! It will be applied to your account.
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Reset Password Form */}
      {authMode === 'reset_password' ? (
        <Form {...resetForm}>
          <form onSubmit={resetForm.handleSubmit(onResetPasswordSubmit)} className="space-y-5">
            {/* Email field for reset password */}
            <FormField
              control={resetForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Email address</FormLabel>
                  <FormControl>
                    <InputWithIcon
                      leftIcon={<Mail className="h-4 w-4 text-muted-foreground" />}
                      className="h-12 text-sm bg-background border-input" 
                      placeholder="Enter your email address"
                      type="email"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-1" />
                </FormItem>
              )}
            />
            
            {/* Submit button for reset password */}
            <Button 
              type="submit" 
              className="w-full mt-6 font-medium" 
              disabled={loading || resetPasswordSuccess}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Name and Referral Code - Two columns for signup */}
            {authMode === 'sign_up' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name field */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">Name</FormLabel>
                      <FormControl>
                        <InputWithIcon
                          leftIcon={<User className="h-4 w-4 text-muted-foreground" />}
                          className="h-12 text-sm bg-background border-input" 
                          style={{ paddingLeft: '36px' }}
                          forceAbsoluteIcon={true}
                          placeholder="Your name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage className="text-xs mt-1" />
                    </FormItem>
                  )}
                />

                {/* Referral code field */}
                <FormField
                  control={form.control}
                  name="referralCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">
                        Referral Code
                        <span className="text-xs text-muted-foreground ml-1">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <InputWithIcon
                          leftIcon={<Tag className="h-4 w-4 text-muted-foreground" />}
                          rightIcon={
                            referralCodeStatus === 'valid' ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : referralCodeStatus === 'checking' ? (
                              <LoadingSkeleton size="sm" />
                            ) : null
                          }
                          className={`h-12 text-sm bg-background border-input ${
                            referralCodeStatus === 'valid' 
                              ? 'border-green-300 focus:border-green-500' 
                              : referralCodeStatus === 'invalid' 
                                ? 'border-red-300 focus:border-red-500' 
                                : ''
                          }`}
                          style={{ paddingLeft: '36px' }}
                          forceAbsoluteIcon={true}
                          placeholder="Enter code"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage className="text-xs mt-1" />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Single column referral code for better messaging when no name field */}
            {authMode === 'sign_up' && (
              <div className="space-y-2">
                {referralCodeStatus === 'unchecked' && (
                  <p className="text-xs text-muted-foreground">
                    💡 Have a referral code? Enter it above for additional benefits.
                  </p>
                )}
              </div>
            )}
            
            {/* Email field - Full width */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Email address</FormLabel>
                  <FormControl>
                    <InputWithIcon
                      leftIcon={<Mail className="h-4 w-4 text-muted-foreground" />}
                      className="h-12 text-sm bg-background border-input" 
                      placeholder="name@example.com"
                      type="email"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-1" />
                </FormItem>
              )}
            />
            
            {/* Password field */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Password</FormLabel>
                  <FormControl>
                    <InputWithIcon
                      leftIcon={<Lock className="h-4 w-4 text-muted-foreground" />}
                      rightIconButton={
                        <button 
                          type="button"
                          className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      }
                      onRightIconClick={togglePasswordVisibility}
                      className="h-12 text-sm bg-background border-input" 
                      type={showPassword ? "text" : "password"}
                      placeholder={authMode === 'sign_up' ? "Create a password" : "Enter your password"}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-1" />
                </FormItem>
              )}
            />
            
            {/* Forgot password link for sign in mode */}
            {authMode === 'sign_in' && (
              <div className="text-right">
                <button 
                  type="button"
                  onClick={() => handleAuthModeChange('reset_password')}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}
            
            {/* Submit button */}
            <Button 
              type="submit" 
              className="w-full mt-6 font-medium" 
              disabled={loading}
            >
              {loading 
                ? "Please wait..." 
                : authMode === 'sign_in' 
                  ? "Sign In" 
                  : "Create Account"
              }
            </Button>
          </form>
        </Form>
      )}
      
      {/* Divider - TEMPORARILY HIDDEN */}
      {false && authMode !== 'reset_password' && (
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground font-medium">Or continue with</span>
          </div>
        </div>
      )}
      
      {/* Google sign in button - TEMPORARILY HIDDEN */}
      {false && authMode !== 'reset_password' && (
        <Button 
          type="button" 
          variant="outline" 
          className="w-full font-medium"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <Google className="w-4 h-4 mr-2" />
          Google
        </Button>
      )}
      
      {/* Toggle between sign in, sign up, and reset password */}
      <div className="text-center mt-6 space-y-3">
          {authMode === 'reset_password' ? (
            <button 
              type="button"
              onClick={() => handleAuthModeChange('sign_in')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Remember your password? {" "}
              <span className="text-primary font-medium hover:underline">
                Sign in
              </span>
            </button>
          ) : (
            <button 
              type="button"
              onClick={toggleAuthMode}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {authMode === 'sign_in' 
                ? "Don't have an account? " 
                : "Already have an account? "}
              <span className="text-primary font-medium hover:underline">
                {authMode === 'sign_in' ? "Sign up" : "Sign in"}
              </span>
            </button>
          )}
          
          {/* Helper text for mixed authentication methods - TEMPORARILY HIDDEN */}
          {false && authMode === 'sign_in' && (
            <p className="text-xs text-muted-foreground">
              💡 If you signed up with Google, please use the Google button above
            </p>
          )}
        </div>
    </div>
  )
} 
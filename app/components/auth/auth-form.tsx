'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/app/context/ThemeContext'
import { useLocalization } from '@/app/context/LocalizationContext'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/app/components/ui/form"
import { Input } from "@/app/components/ui/input"
import { InputWithIcon } from "@/app/components/ui/input-with-icon"
import { Button } from "@/app/components/ui/button"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Eye, EyeOff, Lock, Mail, User, AlertCircle, Check, Tag, Google, Shield, WhatsApp, Phone } from "@/app/components/ui/icons"
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
    phone?: string
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
  phone: z.string().optional(),
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
  const { t } = useLocalization()
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
  
  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaVerifying, setMfaVerifying] = useState(false)
  
  // Get returnTo from URL or default to AI Agents (robots)
  const [finalReturnTo, setFinalReturnTo] = useState<string>('/robots')
  
  const isDark = theme === 'dark'
  
  // Set default form values with pre-filled data
  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
    defaultValues: {
      email: signupData?.email || "",
      password: "",
      name: signupData?.name || "",
      phone: signupData?.phone || "",
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
      setFinalReturnTo(urlReturnTo || '/robots')
    } else {
      setFinalReturnTo(returnTo || '/robots')
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
    
    // Reset MFA state when changing modes
    setMfaRequired(false)
    setMfaCode('')
    setMfaChallengeId(null)
    setMfaFactorId(null)
    
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

  // Validate referral code function
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
        setIsWaitlistMode(false)
      }
    } catch (error) {
      console.error('Error validating referral code:', error)
      setReferralCodeStatus('invalid')
      setIsWaitlistMode(false)
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

  // Handle MFA challenge
  const handleMfaChallenge = async () => {
    try {
      setLoading(true)
      setErrorMessage(null)

      // List user's MFA factors
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
      
      if (listError) {
        throw listError
      }

      // Find the first verified TOTP factor
      const verifiedFactor = factors.totp?.find((factor: any) => factor.verified === true)

      if (!verifiedFactor) {
        // No verified MFA factors, fall back to email confirmation error
        setErrorMessage('Account found but not fully activated. Please check your email for a confirmation link, or contact support if you need help.')
        setLoading(false)
        return
      }

      // Create challenge for the verified factor
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: verifiedFactor.id
      })

      if (challengeError) {
        throw challengeError
      }

      // Store challenge and factor IDs
      setMfaFactorId(verifiedFactor.id)
      setMfaChallengeId(challengeData.id)
      setMfaRequired(true)
    } catch (error: any) {
      console.error('MFA challenge error:', error)
      setErrorMessage(error.message || 'Failed to initiate MFA verification. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Handle MFA verification
  const handleMfaVerify = async () => {
    if (!mfaChallengeId || !mfaCode) {
      setErrorMessage('Please enter the verification code')
      return
    }

    // Validate code is 6 digits
    if (!/^\d{6}$/.test(mfaCode)) {
      setErrorMessage('Please enter a valid 6-digit code')
      return
    }

    try {
      setMfaVerifying(true)
      setErrorMessage(null)

      const { data, error } = await supabase.auth.mfa.verify({
        challengeId: mfaChallengeId,
        code: mfaCode
      })

      if (error) {
        throw error
      }

      // Verification successful, get session
      if (data.session) {
        console.log('MFA verification successful, redirecting to:', finalReturnTo)
        window.location.href = finalReturnTo
      } else {
        // Refresh session if needed
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session) {
          console.log('MFA verification successful, session refreshed, redirecting to:', finalReturnTo)
          window.location.href = finalReturnTo
        } else {
          setErrorMessage('Verification successful but session not found. Please try signing in again.')
          // Reset MFA state
          setMfaRequired(false)
          setMfaCode('')
          setMfaChallengeId(null)
          setMfaFactorId(null)
        }
      }
    } catch (error: any) {
      console.error('MFA verification error:', error)
      setErrorMessage(error.message || 'Invalid verification code. Please try again.')
      setMfaCode('')
    } finally {
      setMfaVerifying(false)
    }
  }

  // Handle MFA cancel
  const handleMfaCancel = () => {
    setMfaRequired(false)
    setMfaCode('')
    setMfaChallengeId(null)
    setMfaFactorId(null)
    setErrorMessage(null)
  }

  // Handle form submission
  const onSubmit = async (values: AuthFormValues) => {
    setLoading(true)
    setErrorMessage(null)
    
    try {
      if (authMode === 'sign_up') {
        if (!values.phone || values.phone.length < 8) {
          throw new Error(t('auth.invalidPhone') || 'Please enter a valid phone number')
        }
        
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

        // Prepare signup payload
        const signupPayload: any = {
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm?returnTo=${encodeURIComponent(finalReturnTo)}`,
            data: {
              name: values.name || '',
              phone: values.phone || '', // Always save it in metadata for safety
              referral_code: values.referralCode || ''
            }
          }
        }
        
        // Include the top-level phone for the auth.users table if valid
        // Supabase requires phone to be sent this way during creation
        if (values.phone && values.phone.trim() !== '') {
          signupPayload.phone = values.phone
        }

        // Create new user with email and password
        const { data, error } = await supabase.auth.signUp(signupPayload)

        if (error) {
          throw error
        }

        // If a phone was provided, use the proxy API to update auth.users 
        // to ensure it is saved in the main auth table as well as metadata
        if (data.user?.id && values.phone && values.phone.trim() !== '') {
          // Fire and forget to avoid blocking UI navigation
          fetch('/api/auth/update-phone', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: data.user.id,
              phone: values.phone
            })
          }).then(res => {
            if (res.ok) console.log('Phone successfully pushed to auth API after signup')
          }).catch(phoneError => {
            console.warn('Error syncing phone to auth.users:', phoneError)
          })
        }

        if (data.user?.email_confirmed_at) {
          // User was automatically confirmed
          // Process referral code if provided
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
          // User exists but no session - could be MFA required or email not confirmed
          console.warn('User exists but no session created, checking for MFA requirement')
          
          // Check if user has MFA enabled
          await handleMfaChallenge()
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
    if (referralCodeStatus === 'valid') return "Create Your Account"
    return "Get Started"
  }

  const getSignupDescription = () => {
    if (referralCodeStatus === 'valid') return "Set up your account with instant access"
    return "Enter your details to get started"
  }

  const isGoogleButtonEnabled = () => {
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
              {t('auth.invalidReferralCode') || 'Invalid referral code. You can still create your account without it.'}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {authMode === 'sign_up' && referralCodeStatus === 'valid' && (
        <Alert variant="default" className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 flex-shrink-0 text-green-600" />
            <AlertDescription className="m-0 text-green-800 dark:text-green-200">
              {t('auth.validReferralCode') || 'Valid referral code! You can now create your account.'}
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
                  <FormLabel className="text-sm font-medium text-foreground">{t('auth.email') || 'Email address'}</FormLabel>
                  <FormControl>
                    <InputWithIcon
                      leftIcon={<Mail className="h-4 w-4 text-muted-foreground" />}
                      className="h-12 text-sm neu-auth-input-light dark:neu-auth-input border-0 focus-visible:ring-0" 
                      placeholder={t('auth.emailPlaceholder') || 'name@example.com'}
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
              className="w-full mt-6 font-medium neu-auth-btn font-inter" 
              disabled={loading || resetPasswordSuccess}
            >
              {loading ? (t('auth.sending') || "Sending...") : (t('auth.sendResetLink') || "Send Reset Link")}
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Name field - Full width */}
            {authMode === 'sign_up' && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">{t('auth.name') || 'Name'}</FormLabel>
                    <FormControl>
                      <InputWithIcon
                        leftIcon={<User className="h-4 w-4 text-muted-foreground" />}
                        className="h-12 text-sm neu-auth-input-light dark:neu-auth-input border-0 focus-visible:ring-0" 
                        placeholder={t('auth.namePlaceholder') || 'Your name'}
                        type="text"
                        name={field.name}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage className="text-xs mt-1" />
                  </FormItem>
                )}
              />
            )}

            {/* Phone field - Full width */}
            {authMode === 'sign_up' && (
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">{t('auth.phone') || 'Phone number'}</FormLabel>
                    <FormControl>
                      <InputWithIcon
                        leftIcon={<Phone className="h-4 w-4 text-muted-foreground" />}
                        className="h-12 text-sm neu-auth-input-light dark:neu-auth-input border-0 focus-visible:ring-0" 
                        placeholder={t('auth.phonePlaceholder') || '+1 (555) 000-0000'}
                        type="tel"
                        name={field.name}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage className="text-xs mt-1" />
                  </FormItem>
                )}
              />
            )}

            {/* Referral code field - Full width */}
            {authMode === 'sign_up' && (
              <>
                <FormField
                  control={form.control}
                  name="referralCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">
                        {t('auth.referralCode') || 'Referral Code'}
                        <span className="text-xs text-muted-foreground ml-1">
                          {t('auth.optional') || '(optional)'}
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
                          className="h-12 text-sm neu-auth-input-light dark:neu-auth-input border-0 focus-visible:ring-0"
                          placeholder={t('auth.enterCode') || "Enter code"}
                          type="text"
                          name={field.name}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage className="text-xs mt-1" />
                    </FormItem>
                  )}
                />
                {referralCodeStatus === 'unchecked' && (
                  <p className="text-xs text-muted-foreground">
                    {t('auth.haveReferralCode') || '💡 Have a referral code? Enter it above for instant access.'}
                  </p>
                )}
              </>
            )}
            
            {/* Email field - Full width */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">{t('auth.email') || 'Email address'}</FormLabel>
                  <FormControl>
                    <InputWithIcon
                      leftIcon={<Mail className="h-4 w-4 text-muted-foreground" />}
                      className="h-12 text-sm neu-auth-input-light dark:neu-auth-input border-0 focus-visible:ring-0" 
                      placeholder={t('auth.emailPlaceholder') || 'name@example.com'}
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
                  <FormLabel className="text-sm font-medium text-foreground">{t('auth.password') || 'Password'}</FormLabel>
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
                      className="h-12 text-sm neu-auth-input-light dark:neu-auth-input border-0 focus-visible:ring-0" 
                      type={showPassword ? "text" : "password"}
                      placeholder={authMode === 'sign_up' ? (t('auth.createPassword') || "Create a password") : (t('auth.passwordPlaceholder') || "Enter your password")}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-xs mt-1" />
                </FormItem>
              )}
            />
            
            {/* MFA Verification UI */}
            {mfaRequired && authMode === 'sign_in' && (
              <div className="space-y-4 p-4 border dark:border-white/5 border-black/5 rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {t('auth.mfa.title') || "Enter verification code"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t('auth.mfa.desc') || "Enter the 6-digit code from your authenticator app"}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="relative">
                    <InputWithIcon
                      leftIcon={<Shield className="h-4 w-4 text-muted-foreground" />}
                      className="h-12 text-base neu-auth-input-light dark:neu-auth-input border-0 focus-visible:ring-0" 
                      placeholder="000000"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        setMfaCode(value)
                      }}
                      disabled={mfaVerifying}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={handleMfaVerify}
                      disabled={mfaVerifying || mfaCode.length !== 6}
                      className="flex-1 font-medium neu-auth-btn font-inter"
                    >
                      {mfaVerifying ? (t('auth.mfa.verifying') || "Verifying...") : (t('auth.mfa.verify') || "Verify")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleMfaCancel}
                      disabled={mfaVerifying}
                      className="font-medium"
                    >
                      {t('auth.mfa.cancel') || "Cancel"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Forgot password link for sign in mode */}
            {authMode === 'sign_in' && !mfaRequired && (
              <div className="text-center">
                <button 
                  type="button"
                  onClick={() => handleAuthModeChange('reset_password')}
                  className="text-sm text-primary hover:underline font-inter"
                >
                  {t('auth.forgotPassword') || 'Forgot password?'}
                </button>
              </div>
            )}
            
            {/* Submit button - hide when MFA is required */}
            {!mfaRequired && (
              <Button 
                type="submit" 
                className="w-full mt-6 font-medium neu-auth-btn font-inter" 
                disabled={loading}
              >
                {loading 
                  ? authMode === 'sign_in' 
                    ? (t('auth.signingIn') || "Signing in...") 
                    : (t('auth.creating') || "Creating account...")
                  : authMode === 'sign_in' 
                    ? (t('auth.signInBtn') || "Sign In") 
                    : referralCodeStatus === 'valid'
                      ? (t('auth.signUpBtn') || "Create Account")
                      : referralCodeStatus === 'unchecked'
                        ? (t('auth.getStarted') || "Get Started")
                        : (t('auth.signUpBtn') || "Create Account")
                }
              </Button>
            )}
          </form>
        </Form>
      )}
      
      {/* Divider */}
      {!waitlistSuccess && authMode !== 'reset_password' && (
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground font-medium">{t('auth.orContinue') || 'Or continue with'}</span>
          </div>
        </div>
      )}

      {/* WhatsApp CTA */}
      {!waitlistSuccess && authMode !== 'reset_password' && (
          <Button 
            type="button" 
            className="whatsapp-btn neu-auth-whatsapp-btn w-full font-medium hover:opacity-90 transition-opacity font-inter"
            onClick={() => window.open('https://wa.me/15512886610', '_blank')}
          >
          <WhatsApp className="w-4 h-4 mr-2 text-white" />
          {t('auth.whatsappBtn') || 'Use Makinari on WhatsApp'}
        </Button>
      )}
      
      {/* Google sign in button - TEMPORARILY HIDDEN */}
      {false && !waitlistSuccess && authMode !== 'reset_password' && (
        <Button 
          type="button" 
          variant="outline" 
          className={`w-full font-medium ${!isGoogleButtonEnabled() ? 'opacity-50 cursor-not-allowed' : ''} font-inter`}
          onClick={handleGoogleSignIn}
          disabled={loading || !isGoogleButtonEnabled()}
        >
          <Google className="w-4 h-4 mr-2" />
          Google
          {authMode === 'sign_up' && referralCodeStatus !== 'valid' && (
            <span className="text-xs ml-2 opacity-60">(Referral code required)</span>
          )}
        </Button>
      )}
      
      {/* Toggle between sign in, sign up, and reset password */}
      {!waitlistSuccess && (
        <div className="text-center mt-6 space-y-3">
          {authMode === 'reset_password' ? (
            <button 
              type="button"
              onClick={() => handleAuthModeChange('sign_in')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-inter"
            >
              {t('auth.rememberPassword') || 'Remember your password?'} {" "}
              <span className="text-primary font-medium hover:underline">
                Sign in
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {authMode === 'sign_in' 
                  ? (t('auth.noAccount') || "Don't have an account?") 
                  : (t('auth.hasAccount') || "Already have an account?")}
              </span>
              <button 
                type="button"
                onClick={toggleAuthMode}
                className="text-sm text-primary font-medium hover:underline transition-colors font-inter"
              >
                {authMode === 'sign_in' ? (t('auth.signUpLink') || "Sign up") : (t('auth.signInLink') || "Sign in")}
              </button>
            </div>
          )}
          
          {/* Helper text for mixed authentication methods - TEMPORARILY HIDDEN */}
          {false && authMode === 'sign_in' && (
            <p className="text-xs text-muted-foreground">
              💡 If you signed up with Google, please use the Google button above
            </p>
          )}
        </div>
      )}
    </div>
  )
} 
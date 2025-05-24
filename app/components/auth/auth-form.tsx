'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/app/context/ThemeContext'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/app/components/ui/form"
import { Input } from "@/app/components/ui/input"
import { Button } from "@/app/components/ui/button"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Eye, EyeOff, Lock, Mail, User, AlertCircle, Check, Tag } from "@/app/components/ui/icons"
import { Separator } from "@/app/components/ui/separator"
import { Alert, AlertDescription } from "@/app/components/ui/alert"

interface AuthFormProps {
  mode?: 'login' | 'register'
  returnTo?: string | null
  defaultAuthType?: string
  signupData?: {
    email?: string
    name?: string
    referralCode?: string
  }
}

// Create schema with conditional validation for referral code
const authFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().optional(),
  referralCode: z.string().optional(),
})

type AuthFormValues = z.infer<typeof authFormSchema>

export function AuthForm({ mode = 'login', returnTo, defaultAuthType, signupData }: AuthFormProps) {
  const supabase = createClient()
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'sign_in' | 'sign_up'>(
    defaultAuthType === 'signup' ? 'sign_up' : 'sign_in'
  )
  const [referralCodeStatus, setReferralCodeStatus] = useState<'unchecked' | 'valid' | 'invalid' | 'checking'>('unchecked')
  const [isWaitlistMode, setIsWaitlistMode] = useState(false)
  const [waitlistSuccess, setWaitlistSuccess] = useState(false)
  
  // Get returnTo from URL or default to dashboard
  const [finalReturnTo, setFinalReturnTo] = useState<string>('/dashboard')
  
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

  useEffect(() => {
    setMounted(true)
    
    // Get returnTo from URL if not provided as prop
    if (!returnTo && typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const urlReturnTo = url.searchParams.get('returnTo')
      setFinalReturnTo(urlReturnTo || '/dashboard')
    } else {
      setFinalReturnTo(returnTo || '/dashboard')
    }

    // If signup data is provided, validate referral code immediately
    if (signupData?.referralCode && authMode === 'sign_up') {
      validateReferralCode(signupData.referralCode)
    }
  }, [returnTo, signupData])

  // Handle auth type change (sign in or sign up)
  const toggleAuthMode = () => {
    setAuthMode(authMode === 'sign_in' ? 'sign_up' : 'sign_in')
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
        setIsWaitlistMode(true)
      }
    } catch (error) {
      console.error('Error validating referral code:', error)
      setReferralCodeStatus('invalid')
      setIsWaitlistMode(true)
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
        // If it's signup and no valid referral code, add to waitlist using the new endpoint
        if (isWaitlistMode || referralCodeStatus !== 'valid') {
          const response = await fetch('/api/waitlist-signup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: values.name || '',
              email: values.email,
              referralCode: values.referralCode || '',
              source: 'auth_form'
            })
          })
          
          const result = await response.json()
          
          if (!response.ok) {
            throw new Error(result.error || 'Failed to join waitlist')
          }
          
          setWaitlistSuccess(true)
          setErrorMessage("You've been added to our waitlist! We'll notify you when access becomes available. A task has been created to process your request.")
          return
        }

        // If valid referral code, proceed with normal signup
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${finalReturnTo}`,
            data: {
              name: values.name,
              referral_code: values.referralCode
            }
          }
        })
        
        if (authError) throw authError

        // Record referral code usage after successful signup
        if (authData.user && values.referralCode) {
          const { data: codeData } = await supabase
            .from('referral_codes')
            .select('id')
            .eq('code', values.referralCode)
            .single()

          if (codeData) {
            await supabase
              .from('referral_code_uses')
              .insert({
                referral_code_id: codeData.id,
                user_id: authData.user.id
              })
          }
        }

        // Show success message for sign up
        setErrorMessage("Check your email for the confirmation link.")
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password
        })
        
        if (error) {
          // Map Supabase error messages to more user-friendly messages
          const errorMessages: { [key: string]: string } = {
            'Invalid login credentials': 'Incorrect email or password. Please try again.',
            'Email not confirmed': 'Please check your email and confirm your account first.',
            'Invalid email': 'Please enter a valid email address.',
            'User not found': 'No account found with this email. Please sign up first.',
          }
          
          throw new Error(errorMessages[error.message] || error.message)
        }
      }
    } catch (error: any) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    // For signup mode, validate referral code first
    if (authMode === 'sign_up') {
      const referralCode = form.getValues('referralCode')
      
      if (!referralCode || !referralCode.trim()) {
        setErrorMessage('Please enter a valid referral code to continue with Google sign up.')
        return
      }

      if (referralCodeStatus !== 'valid') {
        setErrorMessage('Please enter a valid referral code before continuing with Google sign up.')
        return
      }
    }

    setLoading(true)
    setErrorMessage(null)
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?returnTo=${finalReturnTo}`
        }
      })
      
      if (error) throw error
    } catch (error: any) {
      setErrorMessage('Failed to sign in with Google. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  const getReferralCodeIcon = () => {
    switch (referralCodeStatus) {
      case 'valid':
        return <Check className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
      case 'checking':
        return <div className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
      default:
        return <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    }
  }

  const getSignupTitle = () => {
    if (isWaitlistMode) {
      return "Join Waitlist"
    }
    return referralCodeStatus === 'valid' ? "Create Account" : "Get Access"
  }

  const getSignupDescription = () => {
    if (isWaitlistMode) {
      return "Enter your information to join our waitlist"
    }
    return referralCodeStatus === 'valid' 
      ? "Complete your account creation" 
      : "Enter your referral code or join our waitlist"
  }

  // Check if Google button should be enabled for signup
  const isGoogleButtonEnabled = () => {
    if (authMode === 'sign_in') return true
    // For signup, enable only if referral code is valid
    return referralCodeStatus === 'valid'
  }

  return (
    <div className="space-y-6">
      {errorMessage && (
        <Alert variant={errorMessage.includes('Check your email') || waitlistSuccess ? 'default' : 'destructive'}>
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
              Invalid referral code. You'll be added to our waitlist instead.
            </AlertDescription>
          </div>
        </Alert>
      )}

      {authMode === 'sign_up' && referralCodeStatus === 'valid' && (
        <Alert variant="default" className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 flex-shrink-0 text-green-600" />
            <AlertDescription className="m-0 text-green-800 dark:text-green-200">
              Valid referral code! You can now create your account.
            </AlertDescription>
          </div>
        </Alert>
      )}

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
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          className="pl-10 h-11 text-sm bg-background border-input" 
                          placeholder="Your name"
                          {...field} 
                        />
                      </div>
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
                      <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          className={`pl-10 pr-10 h-11 text-sm bg-background border-input ${
                            referralCodeStatus === 'valid' 
                              ? 'border-green-300 focus:border-green-500' 
                              : referralCodeStatus === 'invalid' 
                                ? 'border-red-300 focus:border-red-500' 
                                : ''
                          }`}
                          placeholder="Enter code"
                          {...field} 
                        />
                        {referralCodeStatus === 'valid' && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                        )}
                        {referralCodeStatus === 'checking' && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
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
                  💡 Have a referral code? Enter it above for instant access. Otherwise, you'll join our waitlist.
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
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-10 h-11 text-sm bg-background border-input" 
                      placeholder="name@example.com"
                      type="email"
                      {...field} 
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-xs mt-1" />
              </FormItem>
            )}
          />
          
          {/* Password field - hide for waitlist mode */}
          {!(authMode === 'sign_up' && isWaitlistMode) && (
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        className="pl-10 pr-10 h-11 text-sm bg-background border-input" 
                        type={showPassword ? "text" : "password"}
                        placeholder={authMode === 'sign_up' ? "Create a password" : "Enter your password"}
                        {...field} 
                      />
                      <button 
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={togglePasswordVisibility}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs mt-1" />
                </FormItem>
              )}
            />
          )}
          
          {/* Submit button */}
          <Button 
            type="submit" 
            className="w-full h-11 mt-6 font-medium" 
            disabled={loading || waitlistSuccess}
          >
            {loading 
              ? "Please wait..." 
              : authMode === 'sign_in' 
                ? "Sign In" 
                : isWaitlistMode
                  ? "Join Waitlist"
                  : referralCodeStatus === 'valid'
                    ? "Create Account"
                    : referralCodeStatus === 'unchecked'
                      ? "Get Started"
                      : "Continue"
            }
          </Button>
        </form>
      </Form>
      
      {/* Divider */}
      {!waitlistSuccess && (
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground font-medium">Or continue with</span>
          </div>
        </div>
      )}
      
      {/* Google sign in button */}
      {!waitlistSuccess && (
        <Button 
          type="button" 
          variant="outline" 
          className={`w-full h-11 font-medium ${!isGoogleButtonEnabled() ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleGoogleSignIn}
          disabled={loading || !isGoogleButtonEnabled()}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2" aria-hidden="true">
            <path
              d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0353 3.12C17.9503 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z"
              fill="#EA4335"
            />
            <path
              d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
              fill="#4285F4"
            />
            <path
              d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
              fill="#FBBC05"
            />
            <path
              d="M12.0004 24C15.2404 24 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.2654 14.29L1.27539 17.385C3.25539 21.31 7.3104 24 12.0004 24Z"
              fill="#34A853"
            />
          </svg>
          Google
          {authMode === 'sign_up' && referralCodeStatus !== 'valid' && (
            <span className="text-xs ml-2 opacity-60">(Referral code required)</span>
          )}
        </Button>
      )}
      
      {/* Toggle between sign in and sign up */}
      {!waitlistSuccess && (
        <div className="text-center mt-6">
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
        </div>
      )}
    </div>
  )
} 
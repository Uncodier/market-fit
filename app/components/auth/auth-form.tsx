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
import { Eye, EyeOff, Lock, Mail, User, AlertCircle } from "@/app/components/ui/icons"
import { Separator } from "@/app/components/ui/separator"
import { Alert, AlertDescription } from "@/app/components/ui/alert"

interface AuthFormProps {
  mode?: 'login' | 'register'
  returnTo?: string | null
  defaultAuthType?: string
}

// Create schema
const authFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().optional(),
})

type AuthFormValues = z.infer<typeof authFormSchema>

export function AuthForm({ mode = 'login', returnTo, defaultAuthType }: AuthFormProps) {
  const supabase = createClient()
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'sign_in' | 'sign_up'>(
    defaultAuthType === 'signup' ? 'sign_up' : 'sign_in'
  )
  
  // Get returnTo from URL or default to dashboard
  const [finalReturnTo, setFinalReturnTo] = useState<string>('/dashboard')
  
  const isDark = theme === 'dark'
  
  // Set default form values
  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
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
  }, [returnTo])

  // Handle auth type change (sign in or sign up)
  const toggleAuthMode = () => {
    setAuthMode(authMode === 'sign_in' ? 'sign_up' : 'sign_in')
  }

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  // Handle form submission
  const onSubmit = async (values: AuthFormValues) => {
    setLoading(true)
    setErrorMessage(null)
    
    try {
      if (authMode === 'sign_up') {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${finalReturnTo}`
          }
        })
        
        if (error) throw error

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

  return (
    <div className="space-y-6">
      {errorMessage && (
        <Alert variant={errorMessage.includes('Check your email') ? 'default' : 'destructive'}>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="m-0">{errorMessage}</AlertDescription>
          </div>
        </Alert>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Name field - only shown for sign up */}
          {authMode === 'sign_up' && (
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        className="pl-12 h-12 text-base bg-background border-input" 
                        placeholder="Your name"
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />
          )}
          
          {/* Email field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-12 h-12 text-base bg-background border-input" 
                      placeholder="name@example.com"
                      {...field} 
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-xs mt-2" />
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
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-12 pr-12 h-12 text-base bg-background border-input" 
                      type={showPassword ? "text" : "password"}
                      placeholder={authMode === 'sign_up' ? "Create a password" : "Enter your password"}
                      {...field} 
                    />
                    <button 
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground safari-eye-button"
                      onClick={togglePasswordVisibility}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-xs mt-2" />
              </FormItem>
            )}
          />
          
          {/* Submit button */}
          <Button 
            type="submit" 
            className="w-full h-12 mt-2" 
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
      
      <div className="flex items-center gap-2 my-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground font-medium">OR</span>
        <Separator className="flex-1" />
      </div>
      
      {/* Google sign in button */}
      <Button 
        type="button" 
        variant="outline" 
        className="w-full h-12"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" aria-hidden="true">
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
        Continue with Google
      </Button>
      
      {/* Toggle between sign in and sign up */}
      <div className="text-center mt-4">
        <button 
          type="button"
          onClick={toggleAuthMode}
          className="text-sm text-primary hover:underline focus:outline-none"
        >
          {authMode === 'sign_in' 
            ? "Don't have an account? Sign up" 
            : "Already have an account? Sign in"
          }
        </button>
      </div>
    </div>
  )
} 
"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Loader, Eye, EyeOff, CheckCircle2, Lock } from "@/app/components/ui/icons"
import { toast } from "sonner"

function SetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const redirectTo = searchParams.get('redirect_to')

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
        toast.error(error.message || "Failed to set password")
        return
      }

      console.log('✅ Password set successfully')
      toast.success("Password set successfully!")

      // Redirect to the original destination or team invitation
      if (redirectTo) {
        const decodedRedirect = decodeURIComponent(redirectTo)
        console.log('🔄 Redirecting to:', decodedRedirect)
        
        setTimeout(() => {
          window.location.href = decodedRedirect
        }, 1000)
      } else {
        router.push('/dashboard')
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
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
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
              <Loader className="h-12 w-12 text-blue-500 animate-spin mb-4" />
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
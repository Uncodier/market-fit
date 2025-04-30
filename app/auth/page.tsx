"use client"

import { AuthForm } from "@/app/components/auth/auth-form"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import { useTheme } from "@/app/context/ThemeContext"

export default function AuthPage() {
  const searchParams = useSearchParams()
  const { theme } = useTheme()
  const mode = searchParams.get("mode") === "register" ? "register" : "login"
  const returnTo = searchParams.get("returnTo")

  return (
    <div className={`flex min-h-screen flex-col items-center justify-center ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-50'
    }`}>
      <div className={`w-full max-w-md space-y-8 rounded-xl p-8 shadow-2xl backdrop-blur-sm border ${
        theme === 'dark'
          ? 'bg-gray-900/50 border-gray-800'
          : 'bg-white/50 border-gray-200'
      }`}>
        <div className="flex flex-col items-center space-y-4">
          <Image 
            src="/images/logo.png"
            alt="Market Fit Logo"
            width={48}
            height={48}
            className="h-12 w-auto"
          />
          <h2 className={`text-center text-3xl font-bold tracking-tight ${
            theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
          }`}>
            {mode === "login" ? "Sign In" : "Create Account"}
          </h2>
          <p className={`text-center text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {mode === "login" 
              ? "Sign in to your account to continue" 
              : "Create an account to get started"}
          </p>
        </div>

        <AuthForm mode={mode} returnTo={returnTo} />
      </div>
    </div>
  )
} 
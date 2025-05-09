"use client"

import React, { useState, useEffect } from "react"
import { AuthForm } from "@/app/components/auth/auth-form"
import Image from "next/image"
import { useTheme } from "@/app/context/ThemeContext"

export default function AuthPage() {
  const { theme } = useTheme()
  const [authType, setAuthType] = useState<string>("signin")
  const [returnTo, setReturnTo] = useState<string | null>(null)
  
  // Obtener los parámetros de la URL de manera segura sin hooks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const mode = url.searchParams.get("mode")
      const returnPath = url.searchParams.get("returnTo")
      
      setAuthType(mode === "register" ? "signup" : "signin")
      setReturnTo(returnPath)
    }
  }, [])

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
            {authType === "signin" ? "Sign In" : "Create Account"}
          </h2>
          <p className={`text-center text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {authType === "signin" 
              ? "Sign in to your account to continue" 
              : "Create an account to get started"}
          </p>
        </div>

        <AuthForm defaultAuthType={authType} returnTo={returnTo} />
      </div>
    </div>
  )
} 
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

  const isDark = theme === 'dark'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background/80 to-background">
      <div className="w-full max-w-md space-y-8 rounded-xl p-8 shadow-lg backdrop-blur-sm border border-border bg-card">
        <div className="flex flex-col items-center space-y-4">
          <div className="p-3 rounded-full bg-muted/40 flex items-center justify-center">
            <Image 
              src="/images/logo.png"
              alt="Market Fit Logo"
              width={64}
              height={64}
              className="h-16 w-16 object-contain"
              priority
            />
          </div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
            {authType === "signin" ? "Sign In" : "Create Account"}
          </h2>
          <p className="text-center text-sm text-muted-foreground">
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
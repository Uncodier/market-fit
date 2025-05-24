"use client"

import React, { useState, useEffect } from "react"
import { AuthForm } from "@/app/components/auth/auth-form"
import Image from "next/image"
import { useTheme } from "@/app/context/ThemeContext"

export default function AuthPage() {
  const { theme } = useTheme()
  const [authType, setAuthType] = useState<string>("signin")
  const [returnTo, setReturnTo] = useState<string | null>(null)
  const [signupData, setSignupData] = useState<{
    email?: string
    name?: string
    referralCode?: string
  }>({})
  
  // Obtener los parámetros de la URL de manera segura sin hooks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const mode = url.searchParams.get("mode")
      const returnPath = url.searchParams.get("returnTo")
      const forceSignup = url.searchParams.get("signup") === "true"
      
      // Campos para pre-llenar en signup
      const email = url.searchParams.get("email")
      const name = url.searchParams.get("name")
      const referralCode = url.searchParams.get("referralCode") || url.searchParams.get("referral_code")
      
      // Si hay campos de signup o parámetro signup=true, cambiar automáticamente a modo signup
      const hasSignupData = email || name || referralCode || forceSignup
      
      if (hasSignupData || mode === "register") {
        setAuthType("signup")
        setSignupData({
          email: email || undefined,
          name: name || undefined,
          referralCode: referralCode || undefined
        })
      } else {
        setAuthType(mode === "register" ? "signup" : "signin")
      }
      
      setReturnTo(returnPath)
    }
  }, [])

  const isDark = theme === 'dark'

  const getTitle = () => {
    if (authType === "signin") {
      return "Welcome back"
    }
    return "Welcome aboard"
  }

  const getDescription = () => {
    if (authType === "signin") {
      return "Sign in to manage your AI sales agents"
    }
    return "Get started with AI-powered sales automation"
  }

  // Handle auth type changes from AuthForm
  const handleAuthTypeChange = (newAuthType: string) => {
    setAuthType(newAuthType)
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side - Branding and Info */}
      <div className="hidden lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-16 relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          {/* Base gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-purple-600/10 to-indigo-600/20"></div>
          
          {/* Animated gradient mesh */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/10 to-transparent animate-pulse"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent animate-pulse" style={{ animationDelay: '1s' }}></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-cyan-500/10 animate-pulse" style={{ animationDelay: '2s' }}></div>
          </div>
          
          {/* Floating orbs with enhanced gradients */}
          <div className="absolute top-16 left-16 w-80 h-80 bg-gradient-to-r from-violet-500/30 via-purple-500/20 to-indigo-500/30 rounded-full blur-3xl animate-float-slow"></div>
          <div className="absolute top-32 right-16 w-64 h-64 bg-gradient-to-r from-indigo-500/25 via-cyan-500/15 to-blue-500/25 rounded-full blur-3xl animate-float-medium" style={{ animationDelay: '1.5s' }}></div>
          <div className="absolute bottom-16 left-1/4 w-48 h-48 bg-gradient-to-r from-pink-500/20 via-rose-500/15 to-purple-500/25 rounded-full blur-3xl animate-float-fast" style={{ animationDelay: '3s' }}></div>
          <div className="absolute bottom-32 right-1/3 w-56 h-56 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-cyan-500/20 rounded-full blur-3xl animate-float-reverse" style={{ animationDelay: '2.5s' }}></div>
          
          {/* Additional floating bubbles for more movement */}
          <div className="absolute top-1/2 left-8 w-32 h-32 bg-gradient-to-r from-purple-400/20 to-violet-400/15 rounded-full blur-2xl animate-bubble-1"></div>
          <div className="absolute top-2/3 right-12 w-40 h-40 bg-gradient-to-r from-cyan-400/15 to-indigo-400/20 rounded-full blur-2xl animate-bubble-2" style={{ animationDelay: '4s' }}></div>
          <div className="absolute top-1/4 left-1/3 w-24 h-24 bg-gradient-to-r from-rose-400/15 to-pink-400/10 rounded-full blur-xl animate-bubble-3" style={{ animationDelay: '6s' }}></div>
          <div className="absolute bottom-1/2 right-1/4 w-36 h-36 bg-gradient-to-r from-teal-400/15 to-emerald-400/20 rounded-full blur-2xl animate-bubble-4" style={{ animationDelay: '8s' }}></div>
          <div className="absolute top-3/4 left-1/2 w-28 h-28 bg-gradient-to-r from-indigo-400/20 to-purple-400/15 rounded-full blur-xl animate-bubble-5" style={{ animationDelay: '2s' }}></div>
          
          {/* Micro bubbles for ambient effect */}
          <div className="absolute top-20 right-1/3 w-16 h-16 bg-gradient-to-r from-violet-300/25 to-purple-300/20 rounded-full blur-lg animate-micro-float-1"></div>
          <div className="absolute bottom-20 left-1/2 w-20 h-20 bg-gradient-to-r from-cyan-300/20 to-blue-300/15 rounded-full blur-lg animate-micro-float-2" style={{ animationDelay: '3s' }}></div>
          <div className="absolute top-1/3 right-20 w-12 h-12 bg-gradient-to-r from-emerald-300/25 to-teal-300/20 rounded-full blur-lg animate-micro-float-3" style={{ animationDelay: '5s' }}></div>
          <div className="absolute bottom-1/3 left-20 w-18 h-18 bg-gradient-to-r from-pink-300/20 to-rose-300/15 rounded-full blur-lg animate-micro-float-4" style={{ animationDelay: '7s' }}></div>

          {/* Subtle geometric light beams */}
          <div className="absolute top-1/3 left-0 w-1 h-32 bg-gradient-to-b from-transparent via-violet-400/40 to-transparent rotate-12 animate-pulse"></div>
          <div className="absolute bottom-1/3 right-0 w-1 h-24 bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent -rotate-12 animate-pulse" style={{ animationDelay: '1s' }}></div>
          
          {/* Radial gradients for depth */}
          <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-gradient-radial from-violet-400/20 to-transparent rounded-full animate-pulse"></div>
          <div className="absolute bottom-1/4 left-1/4 w-24 h-24 bg-gradient-radial from-indigo-400/15 to-transparent rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-2xl">
              <Image 
                src="/images/logo.png"
                alt="Market Fit Logo"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold text-white">Market Fit</h1>
          </div>
          
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            <span className="text-white/80">Your </span>
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">AI Powered Sales Team</span>
          </h2>
          
          <p className="text-xl text-white/80 mb-10 leading-relaxed">
            Our AI sales team evolves continuously to collaborate seamlessly with your business, adapting strategies and techniques to drive growth and take your company to new levels of success.
          </p>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-violet-500/20 to-purple-500/20 backdrop-blur-sm border border-violet-400/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-gradient-to-r group-hover:from-violet-500/30 group-hover:to-purple-500/30 transition-all duration-300 shadow-lg">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-400 to-violet-300"></div>
              </div>
              <span className="text-white/90 text-lg">AI-powered lead qualification</span>
            </div>
            <div className="flex items-center gap-4 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 backdrop-blur-sm border border-indigo-400/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-gradient-to-r group-hover:from-indigo-500/30 group-hover:to-cyan-500/30 transition-all duration-300 shadow-lg">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400"></div>
              </div>
              <span className="text-white/90 text-lg">Automated prospect outreach</span>
            </div>
            <div className="flex items-center gap-4 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 backdrop-blur-sm border border-emerald-400/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-gradient-to-r group-hover:from-emerald-500/30 group-hover:to-teal-500/30 transition-all duration-300 shadow-lg">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"></div>
              </div>
              <span className="text-white/90 text-lg">Real-time sales analytics</span>
            </div>
          </div>

          {/* Stats showcase */}
          <div className="grid grid-cols-2 gap-6 mt-12 pt-8 border-t border-white/10">
            <div className="text-center group">
              <div className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent mb-1 group-hover:from-violet-300 group-hover:to-purple-300 transition-all duration-300">300%</div>
              <div className="text-sm text-white/60">Revenue Increase</div>
            </div>
            <div className="text-center group">
              <div className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-1 group-hover:from-emerald-300 group-hover:to-teal-300 transition-all duration-300">24/7</div>
              <div className="text-sm text-white/60">Sales Coverage</div>
            </div>
          </div>
        </div>

        {/* Custom CSS for radial gradients and animations */}
        <style jsx>{`
          .bg-gradient-radial {
            background: radial-gradient(circle, var(--tw-gradient-stops));
          }
          
          @keyframes float-slow {
            0% { transform: translate(0, 0) scale(1); }
            25% { transform: translate(10px, -15px) scale(1.05); }
            50% { transform: translate(-5px, -25px) scale(0.95); }
            75% { transform: translate(-15px, -10px) scale(1.02); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes float-medium {
            0% { transform: translate(0, 0) scale(1) rotate(0deg); }
            33% { transform: translate(15px, -20px) scale(1.1) rotate(120deg); }
            66% { transform: translate(-10px, -30px) scale(0.9) rotate(240deg); }
            100% { transform: translate(0, 0) scale(1) rotate(360deg); }
          }
          
          @keyframes float-fast {
            0% { transform: translate(0, 0) scale(1); }
            20% { transform: translate(-20px, -15px) scale(1.15); }
            40% { transform: translate(10px, -30px) scale(0.85); }
            60% { transform: translate(25px, -10px) scale(1.05); }
            80% { transform: translate(-5px, -35px) scale(0.95); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes float-reverse {
            0% { transform: translate(0, 0) scale(1) rotate(0deg); }
            25% { transform: translate(-12px, 20px) scale(0.9) rotate(-90deg); }
            50% { transform: translate(8px, 35px) scale(1.1) rotate(-180deg); }
            75% { transform: translate(18px, 15px) scale(0.95) rotate(-270deg); }
            100% { transform: translate(0, 0) scale(1) rotate(-360deg); }
          }
          
          @keyframes bubble-1 {
            0% { transform: translate(0, 0) scale(1); }
            25% { transform: translate(30px, -40px) scale(1.3); }
            50% { transform: translate(-20px, -80px) scale(0.7); }
            75% { transform: translate(-40px, -20px) scale(1.1); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes bubble-2 {
            0% { transform: translate(0, 0) scale(1); }
            30% { transform: translate(-35px, -25px) scale(0.8); }
            60% { transform: translate(15px, -50px) scale(1.2); }
            90% { transform: translate(25px, -10px) scale(0.9); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes bubble-3 {
            0% { transform: translate(0, 0) scale(1) rotate(0deg); }
            20% { transform: translate(50px, -30px) scale(1.4) rotate(72deg); }
            40% { transform: translate(-10px, -60px) scale(0.6) rotate(144deg); }
            60% { transform: translate(-30px, -20px) scale(1.2) rotate(216deg); }
            80% { transform: translate(20px, -45px) scale(0.8) rotate(288deg); }
            100% { transform: translate(0, 0) scale(1) rotate(360deg); }
          }
          
          @keyframes bubble-4 {
            0% { transform: translate(0, 0) scale(1); }
            40% { transform: translate(-25px, 30px) scale(1.1); }
            80% { transform: translate(35px, -15px) scale(0.9); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes bubble-5 {
            0% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(-40px, 25px) scale(1.3); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes micro-float-1 {
            0% { transform: translate(0, 0) scale(1); }
            25% { transform: translate(15px, -25px) scale(1.5); }
            50% { transform: translate(-10px, -50px) scale(0.5); }
            75% { transform: translate(-20px, -15px) scale(1.2); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes micro-float-2 {
            0% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(25px, -35px) scale(0.7); }
            66% { transform: translate(-15px, -20px) scale(1.3); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes micro-float-3 {
            0% { transform: translate(0, 0) scale(1) rotate(0deg); }
            50% { transform: translate(30px, -40px) scale(1.8) rotate(180deg); }
            100% { transform: translate(0, 0) scale(1) rotate(360deg); }
          }
          
          @keyframes micro-float-4 {
            0% { transform: translate(0, 0) scale(1); }
            20% { transform: translate(-30px, -20px) scale(1.4); }
            40% { transform: translate(10px, -45px) scale(0.6); }
            60% { transform: translate(35px, -10px) scale(1.1); }
            80% { transform: translate(-5px, -30px) scale(0.9); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          .animate-float-slow {
            animation: float-slow 8s ease-in-out infinite;
          }
          
          .animate-float-medium {
            animation: float-medium 6s ease-in-out infinite;
          }
          
          .animate-float-fast {
            animation: float-fast 4s ease-in-out infinite;
          }
          
          .animate-float-reverse {
            animation: float-reverse 7s ease-in-out infinite;
          }
          
          .animate-bubble-1 {
            animation: bubble-1 12s ease-in-out infinite;
          }
          
          .animate-bubble-2 {
            animation: bubble-2 10s ease-in-out infinite;
          }
          
          .animate-bubble-3 {
            animation: bubble-3 15s linear infinite;
          }
          
          .animate-bubble-4 {
            animation: bubble-4 9s ease-in-out infinite;
          }
          
          .animate-bubble-5 {
            animation: bubble-5 11s ease-in-out infinite;
          }
          
          .animate-micro-float-1 {
            animation: micro-float-1 6s ease-in-out infinite;
          }
          
          .animate-micro-float-2 {
            animation: micro-float-2 8s ease-in-out infinite;
          }
          
          .animate-micro-float-3 {
            animation: micro-float-3 5s linear infinite;
          }
          
          .animate-micro-float-4 {
            animation: micro-float-4 7s ease-in-out infinite;
          }
        `}</style>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex flex-col justify-center px-6 py-12 lg:px-12 xl:px-16 bg-white dark:bg-background">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="p-3 rounded-full bg-primary/10">
              <Image 
                src="/images/logo.png"
                alt="Market Fit Logo"
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
                priority
              />
            </div>
          </div>

          <div className="text-center lg:text-left mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2">
              {getTitle()}
            </h2>
            <p className="text-muted-foreground">
              {getDescription()}
            </p>
          </div>

          <AuthForm 
            defaultAuthType={authType} 
            returnTo={returnTo} 
            signupData={signupData}
            onAuthTypeChange={handleAuthTypeChange}
          />
        </div>
      </div>
    </div>
  )
} 
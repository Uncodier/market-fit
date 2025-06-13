"use client"

import React, { useState, useEffect } from "react"
import { AuthForm } from "@/app/components/auth/auth-form"
import Image from "next/image"
import { useTheme } from "@/app/context/ThemeContext"
import { FileText, Target, Send } from "@/app/components/ui/icons"
import { useSafariDetection } from "@/app/hooks/use-safari-detection"

export default function AuthPage() {
  const { theme } = useTheme()
  const isSafari = useSafariDetection()
  const [authType, setAuthType] = useState<string>("signin")

  // Safari detection script que ejecuta inmediatamente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const script = document.createElement('script');
      script.innerHTML = `
        (function() {
          if (typeof navigator !== 'undefined') {
            const userAgent = navigator.userAgent;
            const isSafari = userAgent.match(/AppleWebKit\\/[\\d.]+/g) &&
              userAgent.match(/Version\\/[\\d.]+.*Safari/) &&
              !userAgent.match(/Chrome\\/[\\d.]+/g) &&
              !userAgent.match(/Chromium\\/[\\d.]+/g) &&
              !userAgent.match(/Edge\\/[\\d.]+/g) &&
              !userAgent.match(/Firefox\\/[\\d.]+/g);
            if (isSafari) {
              document.documentElement.classList.add('safari');
            }
          }
        })();
      `;
      script.className = 'safari-detection-script';
      document.head.appendChild(script);
    }
  }, [])
  const [returnTo, setReturnTo] = useState<string | null>(null)
  const [signupData, setSignupData] = useState<{
    email?: string
    name?: string
    referralCode?: string
  }>({})
  const [authError, setAuthError] = useState<string | null>(null)
  
  // Obtener los parámetros de la URL de manera segura sin hooks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const mode = url.searchParams.get("mode")
      const returnPath = url.searchParams.get("returnTo")
      const forceSignup = url.searchParams.get("signup") === "true"
      const error = url.searchParams.get("error")
      
      // Campos para pre-llenar en signup
      const email = url.searchParams.get("email")
      const name = url.searchParams.get("name")
      const referralCode = url.searchParams.get("referralCode") || url.searchParams.get("referral_code")
      
      // Manejar errores de autenticación
      if (error) {
        setAuthError(decodeURIComponent(error))
        // Limpiar el error de la URL
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete('error')
        window.history.replaceState({}, '', newUrl.toString())
      }
      
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
      <div className="hidden lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-16 relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 lg:overflow-y-auto lg:min-h-screen">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          {/* Base gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-purple-600/15 to-indigo-600/20"></div>
          
          {/* Main floating orbs - larger and more visible */}
          <div className="absolute top-20 left-16 w-96 h-96 bg-violet-500/40 rounded-full blur-xl animate-float-slow"></div>
          <div className="absolute bottom-32 right-20 w-80 h-80 bg-indigo-500/35 rounded-full blur-xl animate-float-medium" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-40 right-1/3 w-72 h-72 bg-pink-500/35 rounded-full blur-xl animate-float-fast" style={{ animationDelay: '4s' }}></div>
          <div className="absolute bottom-20 left-1/4 w-80 h-80 bg-emerald-500/30 rounded-full blur-xl animate-float-reverse" style={{ animationDelay: '6s' }}></div>
          
          {/* Secondary floating elements - more visible */}
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-purple-400/25 rounded-full blur-lg animate-bubble-1" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-1/3 left-1/3 w-56 h-56 bg-cyan-400/25 rounded-full blur-lg animate-bubble-2" style={{ animationDelay: '3s' }}></div>
          <div className="absolute top-2/3 right-1/2 w-48 h-48 bg-rose-400/25 rounded-full blur-lg animate-bubble-3" style={{ animationDelay: '5s' }}></div>
          <div className="absolute bottom-1/4 left-1/2 w-60 h-60 bg-teal-400/25 rounded-full blur-lg animate-bubble-4" style={{ animationDelay: '7s' }}></div>
          
          {/* Colorful accent orbs */}
          <div className="absolute top-1/3 right-2/3 w-52 h-52 bg-yellow-400/30 rounded-full blur-lg animate-bubble-1" style={{ animationDelay: '9s' }}></div>
          <div className="absolute bottom-2/5 left-1/5 w-44 h-44 bg-orange-400/25 rounded-full blur-lg animate-bubble-2" style={{ animationDelay: '11s' }}></div>
          <div className="absolute top-3/5 right-1/5 w-36 h-36 bg-blue-400/25 rounded-full blur-md animate-micro-float-1" style={{ animationDelay: '13s' }}></div>
          
          {/* Medium bubbles layer */}
          <div className="absolute top-12 left-1/2 w-48 h-48 bg-red-400/20 rounded-full blur-lg animate-float-slow" style={{ animationDelay: '17s' }}></div>
          <div className="absolute bottom-1/6 right-1/3 w-44 h-44 bg-green-400/25 rounded-full blur-lg animate-float-medium" style={{ animationDelay: '19s' }}></div>
          <div className="absolute top-1/2 left-1/6 w-40 h-40 bg-sky-400/20 rounded-full blur-md animate-bubble-3" style={{ animationDelay: '21s' }}></div>
          <div className="absolute bottom-3/5 right-2/5 w-52 h-52 bg-purple-300/25 rounded-full blur-lg animate-bubble-4" style={{ animationDelay: '23s' }}></div>
          
          {/* Small accent bubbles */}
          <div className="absolute top-2/5 left-3/4 w-32 h-32 bg-pink-300/20 rounded-full blur-md animate-micro-float-1" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-1/3 right-1/2 w-36 h-36 bg-indigo-300/25 rounded-full blur-md animate-micro-float-2" style={{ animationDelay: '3s' }}></div>
          <div className="absolute top-4/5 left-1/4 w-40 h-40 bg-cyan-300/20 rounded-full blur-md animate-bubble-1" style={{ animationDelay: '5s' }}></div>
          
          {/* Tiny accent bubbles */}
          <div className="absolute top-16 right-1/6 w-24 h-24 bg-rose-300/20 rounded-full blur-sm animate-micro-float-1" style={{ animationDelay: '11s' }}></div>
          <div className="absolute bottom-2/3 left-1/3 w-24 h-24 bg-violet-400/25 rounded-full blur-sm animate-micro-float-2" style={{ animationDelay: '13s' }}></div>
        </div>
        
        <div className="relative z-10 max-w-md py-8 lg:py-12 xl:py-16 flex flex-col gap-8 lg:gap-10 xl:gap-12">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="p-2 lg:p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-2xl">
              <Image 
                src="/images/logo.png"
                alt="Market Fit Logo"
                width={28}
                height={28}
                className="h-6 w-6 lg:h-7 lg:w-7 object-contain"
                priority
              />
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-white">Market Fit</h1>
          </div>
          
          {/* Main Content Section */}
          <div className="flex flex-col gap-6 lg:gap-8">
            <h2 className="text-3xl lg:text-4xl font-bold leading-tight">
              <span className="text-white/80">Your </span>
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">AI Powered Sales Team</span>
            </h2>
            
            <p className="text-lg lg:text-xl text-white/80 leading-relaxed">
              Experience seamless collaboration between AI agents and your team, with performance-based pricing that unleashes intelligent automation across every aspect of your sales process.
            </p>
          </div>
          
          {/* Features Section */}
          <div className="space-y-4 lg:space-y-6">
            <div className="flex items-start gap-3 lg:gap-4 group">
              <div 
                className="flex-shrink-0 rounded-xl bg-violet-500/20 backdrop-blur-sm border-2 border-violet-400/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-violet-500/30 transition-all duration-300 shadow-lg"
                style={{ 
                  width: '36px', 
                  height: '36px',
                  minWidth: '36px',
                  minHeight: '36px'
                }}
              >
                <FileText className="text-violet-300" size={16} />
              </div>
              <div>
                <h3 className="text-white text-base lg:text-lg font-semibold mb-1">Know</h3>
                <p className="text-white/80 text-sm leading-relaxed">Pre-trained AI agents with deep industry knowledge and proven sales strategies, ready to deploy immediately</p>
              </div>
            </div>
            <div className="flex items-start gap-3 lg:gap-4 group">
              <div 
                className="flex-shrink-0 rounded-xl bg-indigo-500/20 backdrop-blur-sm border-2 border-indigo-400/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500/30 transition-all duration-300 shadow-lg"
                style={{ 
                  width: '36px', 
                  height: '36px',
                  minWidth: '36px',
                  minHeight: '36px'
                }}
              >
                <Target className="text-indigo-300" size={16} />
              </div>
              <div>
                <h3 className="text-white text-base lg:text-lg font-semibold mb-1">Think</h3>
                <p className="text-white/80 text-sm leading-relaxed">Strategic analysis that transforms complex market data into actionable revenue opportunities within minutes</p>
              </div>
            </div>
            <div className="flex items-start gap-3 lg:gap-4 group">
              <div 
                className="flex-shrink-0 rounded-xl bg-emerald-500/20 backdrop-blur-sm border-2 border-emerald-400/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500/30 transition-all duration-300 shadow-lg"
                style={{ 
                  width: '36px', 
                  height: '36px',
                  minWidth: '36px',
                  minHeight: '36px'
                }}
              >
                <Send className="text-emerald-300" size={16} />
              </div>
              <div>
                <h3 className="text-white text-base lg:text-lg font-semibold mb-1">Do</h3>
                <p className="text-white/80 text-sm leading-relaxed">Execute personalized multi-channel campaigns across email, social media, and direct messaging automatically</p>
              </div>
            </div>
          </div>

          {/* Stats showcase */}
          <div className="grid grid-cols-2 gap-4 lg:gap-6 pt-6 lg:pt-8 border-t border-white/10">
            <div className="text-center group">
              <div className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent mb-1 group-hover:from-violet-300 group-hover:to-purple-300 transition-all duration-300">
                <span className="text-xs lg:text-sm text-white/60 font-normal">up to </span>300%
              </div>
              <div className="text-xs lg:text-sm text-white/60">Revenue Growth</div>
            </div>
            <div className="text-center group">
              <div className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-1 group-hover:from-emerald-300 group-hover:to-teal-300 transition-all duration-300">24/7</div>
              <div className="text-xs lg:text-sm text-white/60">AI Operations</div>
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
            25% { transform: translate(60px, -80px) scale(1.1); }
            50% { transform: translate(-40px, -120px) scale(0.9); }
            75% { transform: translate(-80px, -40px) scale(1.05); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes float-medium {
            0% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(-70px, 100px) scale(1.15); }
            66% { transform: translate(50px, -60px) scale(0.85); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes float-fast {
            0% { transform: translate(0, 0) scale(1); }
            20% { transform: translate(-60px, -50px) scale(1.2); }
            40% { transform: translate(80px, -100px) scale(0.8); }
            60% { transform: translate(100px, 30px) scale(1.1); }
            80% { transform: translate(-20px, -140px) scale(0.9); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes float-reverse {
            0% { transform: translate(0, 0) scale(1); }
            25% { transform: translate(-90px, 70px) scale(0.85); }
            50% { transform: translate(60px, 130px) scale(1.2); }
            75% { transform: translate(120px, 40px) scale(0.95); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes bubble-1 {
            0% { transform: translate(0, 0) scale(1); }
            25% { transform: translate(150px, -100px) scale(1.4); }
            50% { transform: translate(-80px, -200px) scale(0.6); }
            75% { transform: translate(-120px, -60px) scale(1.2); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes bubble-2 {
            0% { transform: translate(0, 0) scale(1); }
            30% { transform: translate(-140px, -80px) scale(0.7); }
            60% { transform: translate(90px, -150px) scale(1.3); }
            90% { transform: translate(110px, -30px) scale(0.8); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes bubble-3 {
            0% { transform: translate(0, 0) scale(1); }
            20% { transform: translate(180px, -90px) scale(1.5); }
            40% { transform: translate(-60px, -180px) scale(0.5); }
            60% { transform: translate(-100px, -50px) scale(1.3); }
            80% { transform: translate(80px, -130px) scale(0.7); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes bubble-4 {
            0% { transform: translate(0, 0) scale(1); }
            40% { transform: translate(-100px, 120px) scale(1.2); }
            80% { transform: translate(140px, -80px) scale(0.8); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes micro-float-1 {
            0% { transform: translate(0, 0) scale(1); }
            25% { transform: translate(80px, -120px) scale(1.6); }
            50% { transform: translate(-50px, -200px) scale(0.4); }
            75% { transform: translate(-90px, -70px) scale(1.3); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes micro-float-2 {
            0% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(120px, -140px) scale(0.6); }
            66% { transform: translate(-70px, -90px) scale(1.4); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          @keyframes micro-float-3 {
            0% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(160px, -180px) scale(1.8); }
            100% { transform: translate(0, 0) scale(1); }
          }
          
          .animate-float-slow {
            animation: float-slow 20s ease-in-out infinite;
          }
          
          .animate-float-medium {
            animation: float-medium 18s ease-in-out infinite;
          }
          
          .animate-float-fast {
            animation: float-fast 16s ease-in-out infinite;
          }
          
          .animate-float-reverse {
            animation: float-reverse 22s ease-in-out infinite;
          }
          
          .animate-bubble-1 {
            animation: bubble-1 25s ease-in-out infinite;
          }
          
          .animate-bubble-2 {
            animation: bubble-2 21s ease-in-out infinite;
          }
          
          .animate-bubble-3 {
            animation: bubble-3 28s ease-in-out infinite;
          }
          
          .animate-bubble-4 {
            animation: bubble-4 19s ease-in-out infinite;
          }
          
          .animate-micro-float-1 {
            animation: micro-float-1 15s ease-in-out infinite;
          }
          
          .animate-micro-float-2 {
            animation: micro-float-2 17s ease-in-out infinite;
          }
          
          .animate-micro-float-3 {
            animation: micro-float-3 14s ease-in-out infinite;
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
            initialError={authError}
          />
        </div>
      </div>
    </div>
  )
} 
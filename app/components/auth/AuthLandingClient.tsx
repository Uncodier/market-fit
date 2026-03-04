"use client"

import React, { useState, useEffect } from "react"
import { AuthForm } from "@/app/components/auth/auth-form"
import Image from "next/image"
import { useTheme } from "@/app/context/ThemeContext"
import { useSafariDetection } from "@/app/hooks/use-safari-detection"
import { WhatsApp } from "@/app/components/ui/icons"
import { GitHubIcon } from "@/app/components/ui/social-icons"
import { siteConfig } from "@/config"
import { LandingSections } from "@/app/components/auth/LandingSections"
import { useLocalization } from "@/app/context/LocalizationContext"

export function AuthLandingClient() {
  const { theme } = useTheme()
  const isSafari = useSafariDetection()
  const { t } = useLocalization()
  const [authType, setAuthType] = useState<string>("signin")
  const [mounted, setMounted] = useState(false)

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
      setMounted(true)
    }
  }, [])

  const isDark = theme === 'dark'

  const getTitle = () => {
    if (authType === "signin") {
      return t('auth.welcomeBack') || "Makinari is the Revenue Operations Platform with Agents that actually perform tasks for you"
    }
    return t('auth.welcomeAboard') || "Welcome aboard"
  }

  const getDescription = () => {
    if (authType === "signin") {
      return t('auth.signInDesc') || "Sign in to manage your AI sales agents"
    }
    return t('auth.signUpDesc') || "Get started with AI-powered sales automation"
  }

  // Handle auth type changes from AuthForm
  const handleAuthTypeChange = (newAuthType: string) => {
    setAuthType(newAuthType)
  }

  // Ya no bloqueamos el scroll
  // useEffect(() => {
  //   if (typeof window !== 'undefined') {
  //     const originalStyle = window.getComputedStyle(document.body).overflow
  //     document.body.style.overflow = 'hidden'
  //     return () => {
  //       document.body.style.overflow = originalStyle
  //     }
  //   }
  // }, [])

  return (
    <div className="min-h-screen dark:bg-black-paper bg-white-paper bg-white">
      <div className="auth-page min-h-screen grid lg:grid-cols-2">
      {/* Left side - Branding and Info */}
      <div className="flex flex-col justify-center px-6 py-16 lg:py-0 lg:px-12 xl:px-16 relative overflow-hidden dark:bg-black-paper bg-white-paper bg-[#f8f9fa] min-h-[100vh] lg:min-h-screen lg:sticky top-0 border-b lg:border-b-0 lg:border-r dark:border-white/5 border-black/5">
        {/* Animated background elements - Retro Futuristic (Mexico 68 inspired) */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Op-art concentric circles (Mexico 68 geometric lines) */}
          <div className="absolute -left-1/4 top-0 w-[150%] h-[150%] opacity-[0.06] pointer-events-none flex items-center justify-center">
            <div className="absolute w-[200%] h-[200%] dark:bg-[repeating-radial-gradient(circle_at_center,transparent,transparent_8px,white_8px,white_16px)] bg-[repeating-radial-gradient(circle_at_center,transparent,transparent_8px,black_8px,black_16px)] animate-wave-outward"></div>
          </div>
          
          {/* Contrasting parallel lines */}
          <div className="absolute -bottom-1/4 -right-1/4 w-[150%] h-[150%] opacity-[0.04] pointer-events-none">
            <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_12px,white_12px,white_24px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_12px,black_12px,black_24px)] animate-pan-diagonal"></div>
          </div>

          {/* Gradient masking to blend patterns smoothly */}
          <div className="absolute inset-0 dark:bg-[radial-gradient(circle_at_center,transparent_0%,#030303_80%)] bg-[radial-gradient(circle_at_center,transparent_0%,#f8f9fa_80%)]"></div>
          
          {/* Paper texture overlay to ensure it renders on top of the gradient mask */}
          <div className="absolute inset-0 paper-texture-overlay z-0"></div>
          
          {/* Subtle vibrant glows for the futuristic touch */}
          <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[100px] dark:mix-blend-screen mix-blend-multiply animate-pulse-slow"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-[120px] dark:mix-blend-screen mix-blend-multiply animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        </div>

        {/* Logo and Chips - Centered */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full drop-shadow-2xl">
          {/* YC-style badge: Backed by 500 Startups - schematic */}
          <div className="mt-0 lg:-mt-16 mb-6 inline-flex items-center gap-3 rounded-sm border dark:border-white/50 border-black/50 bg-transparent px-4 py-2 text-sm font-inter font-normal dark:text-white/90 text-slate-500">
            {t('auth.backedBy') || 'Backed by'}
            <Image
              src="/images/500logo.svg"
              alt="500 Startups"
              width={70}
              height={24}
              className="h-6 w-auto object-contain opacity-90 dark:invert-0 invert"
            />
          </div>
          <Image 
            src={isDark ? "/images/combination_mark_white.png" : "/images/combination_mark.png"}
            alt="Makinari Logo"
            width={320}
            height={100}
            className="w-[200px] sm:w-[240px] md:w-[280px] lg:w-[320px] h-auto object-contain transition-transform duration-700 hover:scale-105"
            priority
          />
          
          {/* Feature Chips wrapped in AI stamp + Open Source outside */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <div className="inline-flex items-center gap-3 rounded-sm border dark:border-white/40 border-black/40 dark:bg-white/5 bg-black/5 px-3 py-2">
              <span className="shrink-0 rounded border dark:border-white/30 border-black/30 dark:bg-white/10 bg-black/10 px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase dark:text-white/95 text-slate-500 font-inter">
                AI
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full dark:neu-black-chip-inward neu-white-chip-inward text-sm font-bold tracking-wide font-inter">
                  {t('auth.chip.gtm') || 'GTM'}
                </span>
                <span className="px-3 py-1 rounded-full dark:neu-black-chip-inward neu-white-chip-inward text-sm font-bold tracking-wide font-inter">
                  {t('auth.chip.crm') || 'CRM'}
                </span>
                <span className="px-3 py-1 rounded-full dark:neu-black-chip-inward neu-white-chip-inward text-sm font-bold tracking-wide font-inter">
                  {t('auth.chip.employees') || 'Employees'}
                </span>
              </div>
            </div>
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full dark:neu-black-chip-inward neu-white-chip-inward text-sm font-normal hover:opacity-90 transition-opacity font-inter"
            >
              <GitHubIcon size={16} color={isDark ? "#fff" : "#000"} />
              {t('auth.chip.openSource') || 'Open Source'}
            </a>
          </div>
        </div>

        {/* Custom CSS for animations */}
        <style jsx>{`
          @keyframes pulse-slow {
            0%, 100% { opacity: 0.8; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.05); }
          }
          .animate-pulse-slow {
            animation: pulse-slow 8s ease-in-out infinite;
          }
          @keyframes wave-outward {
            0% { transform: scale(1); }
            50% { transform: scale(1.15); }
            100% { transform: scale(1); }
          }
          .animate-wave-outward {
            animation: wave-outward 15s ease-in-out infinite;
          }
          @keyframes spin-super-slow {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .animate-spin-super-slow {
            animation: spin-super-slow 120s linear infinite;
          }
          @keyframes pan-diagonal {
            0% { background-position: 0 0; }
            100% { background-position: 48px 48px; }
          }
          .animate-pan-diagonal {
            animation: pan-diagonal 4s linear infinite;
          }
        `}</style>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex flex-col justify-center px-6 py-16 lg:py-12 lg:px-12 xl:px-16 dark:bg-black-paper bg-white-paper bg-white relative min-h-[100vh] lg:min-h-screen border-l dark:border-white/[0.02] border-black/5">
        <div className="absolute inset-0 dark:bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.04),transparent_50%)] bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.1),transparent_50%)] pointer-events-none z-0"></div>
        {mounted && (
          <div className="mx-auto w-full max-w-md relative z-10">
            <div className="flex items-center justify-center mb-8 animate-fade-in-up-1">
              <div className="p-3 rounded-full bg-primary/10">
                <Image 
                  src="/images/logo.png"
                  alt="Market Fit Logo"
                  width={48}
                  height={48}
                  className="h-12 w-12 object-contain drop-shadow-md"
                  priority
                />
              </div>
            </div>

            <div className="text-center lg:text-left mb-8 animate-fade-in-up-2">
              <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2">
                {getTitle()}
              </h2>
              <p className="text-muted-foreground">
                {getDescription()}
              </p>
            </div>

            <div className="animate-fade-in-up-3">
              <AuthForm 
                defaultAuthType={authType} 
                returnTo={returnTo} 
                signupData={signupData}
                onAuthTypeChange={handleAuthTypeChange}
                initialError={authError}
              />
            </div>
          </div>
        )}
        <style jsx global>{`
          html.safari .auth-page input[type="text"],
          html.safari .auth-page input[type="email"],
          html.safari .auth-page input[type="password"],
          html.safari .auth-page input[type="search"],
          html.safari .auth-page input[type="tel"],
          html.safari .auth-page input[type="url"],
          html.safari .auth-page input[type="number"],
          html.safari .auth-page textarea {
            padding-left: 36px !important;
          }
        `}</style>
      </div>
      </div>
      
      {/* Landing Sections go full width below the login grid */}
      <LandingSections />
    </div>
  )
} 
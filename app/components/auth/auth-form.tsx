"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase/client"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  defaultPostAuthPath,
  resolvePostAuthRedirect,
} from "@/lib/auth/post-auth-redirect"
import { validateContactPhone } from "@/app/auth/phone-validation"
import { AuthFormContent } from "./AuthFormContent"
import {
  authFormSchema,
  resetPasswordSchema,
  type AuthFormValues,
  type AuthMode,
  type ReferralCodeStatus,
  type ResetPasswordValues,
} from "./auth-form-schema"

interface AuthFormProps {
  mode?: "login" | "register"
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
  isShopContext?: boolean
}

export function AuthForm({
  returnTo,
  defaultAuthType,
  signupData,
  onAuthTypeChange,
  initialError,
  isShopContext = false,
}: AuthFormProps) {
  const supabase = createClient()
  const { t } = useLocalization()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>(
    defaultAuthType === "signup" ? "sign_up" : "sign_in"
  )
  const [referralCodeStatus, setReferralCodeStatus] =
    useState<ReferralCodeStatus>("unchecked")
  const [waitlistSuccess] = useState(false)
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null)
  const [, setMfaFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState("")
  const [mfaVerifying, setMfaVerifying] = useState(false)
  const [finalReturnTo, setFinalReturnTo] = useState(defaultPostAuthPath())

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
    defaultValues: {
      email: signupData?.email || "",
      password: "",
      name: signupData?.name || "",
      phone: signupData?.phone || "",
      referralCode: signupData?.referralCode || "",
    },
  })
  const resetForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  })

  const validateReferralCode = async (code: string) => {
    if (!code.trim()) {
      setReferralCodeStatus("unchecked")
      return
    }
    setReferralCodeStatus("checking")
    try {
      const { data, error } = await supabase.rpc("validate_referral_code", {
        code_param: code.trim(),
      })
      if (error) throw error
      setReferralCodeStatus(data ? "valid" : "invalid")
    } catch (error) {
      console.error("Error validating referral code:", error)
      setReferralCodeStatus("invalid")
    }
  }

  useEffect(() => {
    setMounted(true)
    if (initialError?.includes("team invitation")) {
      console.log("🧹 Clearing Supabase auth state due to team invitation error")
      supabase.auth.signOut({ scope: "local" }).catch(console.warn)
    }
    if (!returnTo && typeof window !== "undefined") {
      const url = new URL(window.location.href)
      setFinalReturnTo(
        resolvePostAuthRedirect(url.searchParams.get("returnTo"))
      )
    } else {
      setFinalReturnTo(resolvePostAuthRedirect(returnTo))
    }
    if (signupData?.referralCode && authMode === "sign_up") {
      void validateReferralCode(signupData.referralCode)
    }
    if (initialError) setErrorMessage(initialError)
  }, [returnTo, signupData, initialError, supabase.auth])

  const referralCode = form.watch("referralCode")
  useEffect(() => {
    const timer = setTimeout(() => {
      if (authMode === "sign_up") {
        void validateReferralCode(referralCode || "")
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [referralCode, authMode])

  const resetMfaState = () => {
    setMfaRequired(false)
    setMfaCode("")
    setMfaChallengeId(null)
    setMfaFactorId(null)
  }

  const handleAuthModeChange = (newMode: AuthMode) => {
    setAuthMode(newMode)
    setErrorMessage(null)
    setResetPasswordSuccess(false)
    resetMfaState()
    onAuthTypeChange?.(
      newMode === "sign_up"
        ? "signup"
        : newMode === "reset_password"
          ? "reset"
          : "signin"
    )
  }

  const handleMfaChallenge = async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      const { data: factors, error: listError } =
        await supabase.auth.mfa.listFactors()
      if (listError) throw listError
      const verifiedFactor = factors.totp?.find(
        (factor: any) => factor.verified === true
      )
      if (!verifiedFactor) {
        setErrorMessage(
          "Account found but not fully activated. Please check your email for a confirmation link, or contact support if you need help."
        )
        return
      }
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: verifiedFactor.id })
      if (challengeError) throw challengeError
      setMfaFactorId(verifiedFactor.id)
      setMfaChallengeId(challengeData.id)
      setMfaRequired(true)
    } catch (error: any) {
      console.error("MFA challenge error:", error)
      setErrorMessage(
        error.message || "Failed to initiate MFA verification. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  const handleMfaVerify = async () => {
    if (!mfaChallengeId || !mfaCode) {
      setErrorMessage("Please enter the verification code")
      return
    }
    if (!/^\d{6}$/.test(mfaCode)) {
      setErrorMessage("Please enter a valid 6-digit code")
      return
    }
    try {
      setMfaVerifying(true)
      setErrorMessage(null)
      const { data, error } = await supabase.auth.mfa.verify({
        challengeId: mfaChallengeId,
        code: mfaCode,
      })
      if (error) throw error
      if (data.session) {
        window.location.href = finalReturnTo
        return
      }
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session) {
        window.location.href = finalReturnTo
      } else {
        setErrorMessage(
          "Verification successful but session not found. Please try signing in again."
        )
        resetMfaState()
      }
    } catch (error: any) {
      console.error("MFA verification error:", error)
      setErrorMessage(
        error.message || "Invalid verification code. Please try again."
      )
      setMfaCode("")
    } finally {
      setMfaVerifying(false)
    }
  }

  const onSubmit = async (values: AuthFormValues) => {
    setLoading(true)
    setErrorMessage(null)
    try {
      if (authMode === "sign_up") {
        const phoneResult = validateContactPhone(values.phone || "")
        if (!phoneResult.valid) {
          throw new Error(t("auth.invalidPhone") || phoneResult.error)
        }
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm?returnTo=${encodeURIComponent(finalReturnTo)}`,
            data: {
              name: values.name || "",
              phone: phoneResult.phone,
              referral_code: values.referralCode || "",
            },
          },
        })
        if (error) throw error
        if (data.user?.email_confirmed_at) {
          if (values.referralCode && referralCodeStatus === "valid") {
            try {
              const response = await fetch("/api/process-referral", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  referralCode: values.referralCode,
                }),
              })
              if (!response.ok) {
                console.warn("Failed to process referral code after signup")
              }
            } catch (error) {
              console.warn("Error processing referral code:", error)
            }
          }
          window.location.href = finalReturnTo
        } else {
          console.log(
            "User created successfully, confirmation email sent to:",
            values.email
          )
          setErrorMessage(
            `✅ Account created successfully! We've sent a confirmation email to ${values.email}. Please check your email and click the confirmation link to complete your setup. After confirming, you can sign in with your credentials.`
          )
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        })
        if (error) throw error
        if (data.user && data.session) {
          window.location.href = finalReturnTo
        } else if (data.user) {
          await handleMfaChallenge()
        } else {
          setErrorMessage(
            "Sign in failed. Please check your credentials and try again."
          )
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error)
      setErrorMessage(
        error.message ||
          "An error occurred during authentication. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      await supabase.auth.signOut({ scope: "local" })
      await new Promise((resolve) => setTimeout(resolve, 100))
      const response = await fetch("/api/auth/google-pre-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: authMode,
          referralCode:
            authMode === "sign_up"
              ? form.getValues("referralCode")
              : undefined,
          returnTo: finalReturnTo,
        }),
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(
          result.error || "Failed to initiate Google authentication"
        )
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(finalReturnTo)}`,
          queryParams: { access_type: "offline", prompt: "consent" },
          skipBrowserRedirect: false,
        },
      })
      if (error) throw error
    } catch (error: any) {
      console.error("Google sign in error:", error)
      setErrorMessage(
        error.message?.includes("code verifier")
          ? "Authentication session expired. Please try signing in with Google again."
          : error.message ||
              "Failed to sign in with Google. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  const onResetPasswordSubmit = async (values: ResetPasswordValues) => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/reset-password?returnTo=${encodeURIComponent(finalReturnTo)}`,
      })
      if (error) {
        if (
          error.message?.includes("access_denied") ||
          (error as any).code === "access_denied"
        ) {
          throw new Error(
            "This account may be registered with a social provider (like Google or GitHub) and does not have a password, or it may not exist. Please try signing in with your social account."
          )
        }
        throw error
      }
      setResetPasswordSuccess(true)
      setErrorMessage(
        t("auth.checkEmailReset") ||
          "Check your email for a password reset link. The link will expire in 1 hour."
      )
    } catch (error: any) {
      console.error("Reset password error:", error)
      setErrorMessage(
        error.message ||
          "Failed to send reset password email. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <AuthFormContent
      authMode={authMode}
      form={form}
      resetForm={resetForm}
      referralCodeStatus={referralCodeStatus}
      isShopContext={isShopContext}
      waitlistSuccess={waitlistSuccess}
      resetPasswordSuccess={resetPasswordSuccess}
      loading={loading}
      errorMessage={errorMessage}
      showPassword={showPassword}
      mfaRequired={mfaRequired}
      mfaCode={mfaCode}
      mfaVerifying={mfaVerifying}
      t={t}
      setMfaCode={setMfaCode}
      onSubmit={onSubmit}
      onResetPasswordSubmit={onResetPasswordSubmit}
      onTogglePassword={() => setShowPassword((visible) => !visible)}
      onMfaVerify={handleMfaVerify}
      onMfaCancel={() => {
        resetMfaState()
        setErrorMessage(null)
      }}
      onModeChange={handleAuthModeChange}
      onToggleMode={() =>
        handleAuthModeChange(
          authMode === "sign_in" ? "sign_up" : "sign_in"
        )
      }
      onGoogleSignIn={handleGoogleSignIn}
    />
  )
}

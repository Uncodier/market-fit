"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Button } from "@/app/components/ui/button"
import { DestinationSelector } from "@/app/components/commerce/DestinationSelector"
import { useLocalization } from "@/app/context/LocalizationContext"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { User, ShieldCheck, Loader2, Check } from "@/app/components/ui/icons"
import { CheckoutOtpCodeForm } from "@/app/components/commerce/CheckoutOtpCodeForm"
import { shopOtpEmailRedirectTo } from "@/lib/auth/shop-otp-email-redirect"

type Mode = "choose" | "guest" | "otp_email" | "otp_code" | "signed_in"

interface CheckoutIdentityPickerProps {
  session: any
  requiresAuth: boolean
  customerName: string
  setCustomerName: (val: string) => void
  customerEmail: string
  setCustomerEmail: (val: string) => void
  ownerSiteId?: string | null
  setOwnerSiteId?: (val: string | null) => void
  lockedDestination?: boolean
}

export function CheckoutIdentityPicker({
  session,
  requiresAuth,
  customerName,
  setCustomerName,
  customerEmail,
  setCustomerEmail,
  ownerSiteId,
  setOwnerSiteId,
  lockedDestination = false
}: CheckoutIdentityPickerProps) {
  const { t, locale } = useLocalization()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>(() => {
    if (session) return "signed_in"
    if (requiresAuth) return "otp_email"
    return "guest"
  })
  const [otpEmail, setOtpEmail] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [timer, setTimer] = useState(0)

  useEffect(() => {
    if (otpEmail || !customerEmail) return
    setOtpEmail(customerEmail)
  }, [customerEmail, otpEmail])

  // Sync when session appears/disappears or digital cart forces auth
  useEffect(() => {
    if (session) {
      setMode("signed_in")
      return
    }
    setMode((current) => {
      if (current === "signed_in") {
        return requiresAuth ? "otp_email" : "guest"
      }
      if (requiresAuth && (current === "choose" || current === "guest")) {
        return "otp_email"
      }
      return current
    })
  }, [session, requiresAuth])

  useEffect(() => {
    if (timer <= 0) return
    const interval = setInterval(() => setTimer((prev) => prev - 1), 1000)
    return () => clearInterval(interval)
  }, [timer])

  const isValidEmail = (email: string) =>
    email.trim() !== "" && email.includes("@") && email.includes(".")

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!isValidEmail(otpEmail)) {
      toast.error(t("checkout.identity.invalidEmail") || "Please enter a valid email address")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: otpEmail.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: shopOtpEmailRedirectTo(),
          data: {
            auth_channel: 'otp',
            locale,
            site_id: ownerSiteId || undefined,
          }
        },
      })

      if (error) throw error

      setMode("otp_code")
      setTimer(60)
      toast.success(t("checkout.identity.emailVerification") || "We'll email you a verification code")
    } catch (err: any) {
      toast.error(err.message || "Failed to send code")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (otpCode.replace(/ /g, "").length < 6) return

    setLoading(true)
    try {
      let result = await supabase.auth.verifyOtp({
        email: otpEmail.trim(),
        token: otpCode.replace(/ /g, ""),
        type: "email",
      })

      if (result.error) {
        result = await supabase.auth.verifyOtp({
          email: otpEmail.trim(),
          token: otpCode.replace(/ /g, ""),
          type: "magiclink",
        })
      }

      if (result.error) {
        result = await supabase.auth.verifyOtp({
          email: otpEmail.trim(),
          token: otpCode.replace(/ /g, ""),
          type: "signup",
        })
      }

      if (result.error) throw result.error
      const { data } = result;

      if (data.session) {
        const email = data.session.user.email || ""
        setCustomerEmail(email)
        setCustomerName(
          data.session.user.user_metadata?.name ||
            data.session.user.user_metadata?.full_name ||
            email.split("@")[0] ||
            email
        )
        setMode("signed_in")
        toast.success(t("checkout.identity.signedIn") || "Successfully signed in")
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid verification code")
    } finally {
      setLoading(false)
    }
  }

  if (session || mode === "signed_in") {
    const email =
      session?.user?.email ||
      customerEmail ||
      otpEmail

    return (
      <div className="space-y-4 notranslate" translate="no">
        {email && (
          <div className="flex items-center gap-3 p-3 rounded-xl border bg-secondary/20">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-green-600" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{email}</div>
              <div className="text-xs text-muted-foreground">
                {t("checkout.identity.signedInAs") || "Signed in"}
              </div>
            </div>
          </div>
        )}
        {ownerSiteId !== undefined && setOwnerSiteId && (
          <DestinationSelector
            value={ownerSiteId}
            onChange={setOwnerSiteId}
            locked={lockedDestination}
          />
        )}
      </div>
    )
  }

  if (mode === "otp_code") {
    return (
      <div className="space-y-4 notranslate" translate="no">
        <CheckoutOtpCodeForm
          otpEmail={otpEmail}
          otpCode={otpCode}
          setOtpCode={setOtpCode}
          loading={loading}
          timer={timer}
          onBack={() => {
            setMode("otp_email")
            setOtpCode("")
          }}
          onResend={() => {
            void handleSendOtp()
          }}
          onVerify={() => {
            void handleVerifyOtp()
          }}
          t={t}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 notranslate" translate="no">
      {requiresAuth && mode === "otp_email" && (
        <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
          {t("checkout.identity.signInToAccess") ||
            "Please sign in to purchase digital items or subscriptions."}
        </div>
      )}

      {(mode === "guest" || mode === "otp_email" || mode === "choose") && (
        <Tabs
          value={mode === "choose" ? "guest" : mode}
          onValueChange={(v) => {
            if (v === "guest" || v === "otp_email") {
              setMode(v as Mode)
              if (v === "otp_email") setOtpCode("")
            }
          }}
          className="w-full space-y-4"
        >
          {!requiresAuth ? (
            <div className="space-y-2 mb-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                {t("checkout.identity.signInMethod") || "Sign-in method"}
              </Label>
              <TabsList className="inline-flex h-auto w-full p-1 bg-gray-100 dark:bg-zinc-800/80 rounded-xl gap-1 text-muted-foreground">
                <TabsTrigger
                  value="guest"
                  className="flex-1 rounded-lg text-xs py-2.5 gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 dark:data-[state=active]:ring-white/10"
                >
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span>{t("checkout.identity.continueAsGuest") || "Continue as guest"}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="otp_email"
                  className="flex-1 rounded-lg text-xs py-2.5 gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 dark:data-[state=active]:ring-white/10"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>{t("checkout.identity.signIn") || "Sign in"}</span>
                </TabsTrigger>
              </TabsList>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {mode === "otp_email"
                  ? (t("checkout.identity.signInHelper") ||
                      "Access your digital products, manage subscriptions, and save your details.")
                  : (t("checkout.identity.guestHelper") ||
                      "You can shop without an account. Sign in to access purchases in your buyer portal.")}
              </p>
            </div>
          ) : (
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t("checkout.identity.signIn") || "Sign in"}
              </span>
            </div>
          )}

          <TabsContent value="guest" className="space-y-4 mt-0 border-0 p-0 outline-none">
            <div>
              <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                {t("checkout.fullName") || "Full Name"}
              </Label>
              <Input
                required
                placeholder="Jane Doe"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                {t("checkout.emailAddress") || "Email Address"}
              </Label>
              <Input
                required
                type="email"
                placeholder="jane@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
          </TabsContent>

          <TabsContent value="otp_email" className="space-y-4 mt-0 border-0 p-0 outline-none">
            <div className="space-y-4">
              <div>
                <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  {t("checkout.emailAddress") || "Email Address"}
                </Label>
                <Input
                  required
                  type="email"
                  placeholder="jane@example.com"
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                  className="h-12 rounded-xl w-full"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void handleSendOtp()
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                onClick={() => {
                  void handleSendOtp()
                }}
                disabled={loading || !isValidEmail(otpEmail)}
                className="h-12 rounded-xl w-full"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("checkout.identity.sendCode") || "Send Verification Code"
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

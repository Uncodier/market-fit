"use client"

import { useLocalization } from "@/app/context/LocalizationContext"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Shield, Eye, EyeOff, MessageSquare, CheckCircle2 } from "@/app/components/ui/icons"
import { toast } from "sonner"

interface ChangeEmailModalProps {
  isOpen: boolean
  onClose: () => void
  currentEmail: string
  onRequestEmailChange: (newEmail: string, password: string) => Promise<boolean>
  isUpdating?: boolean
}

type Step = 1 | 2 | 3

export function ChangeEmailModal({
  isOpen,
  onClose,
  currentEmail,
  onRequestEmailChange,
  isUpdating = false
}: ChangeEmailModalProps) {
  const { t } = useLocalization()
  const [step, setStep] = useState<Step>(1)
  const [password, setPassword] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    // Reset state when closing
    setStep(1)
    setPassword("")
    setNewEmail("")
    setShowPassword(false)
    setError(null)
    onClose()
  }

  const handlePasswordVerification = async () => {
    if (!password.trim()) {
      setError("account.email.passwordRequired")
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      // Verify password by attempting to sign in with current email
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: password,
      })

      if (signInError) {
        setError("account.email.passwordInvalid")
        setIsVerifying(false)
        return
      }

      // Password is valid, proceed to next step
      setStep(2)
      setError(null)
    } catch (err) {
      setError("account.email.unexpected")
      console.error("Error verifying password:", err)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleEmailSubmit = async () => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!newEmail.trim()) {
      setError("account.email.emailRequired")
      return
    }

    if (!emailRegex.test(newEmail)) {
      setError("checkout.identity.invalidEmail")
      return
    }

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setError("account.email.different")
      return
    }

    setError(null)
    setStep(3)
  }

  const handleConfirm = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const success = await onRequestEmailChange(newEmail, password)
      
      if (success) {
        // Success - close modal after a brief delay to show success message
        setTimeout(() => {
          handleClose()
        }, 1500)
      } else {
        setError("account.email.requestFailed")
        setIsSubmitting(false)
      }
    } catch (err) {
      setError("account.email.unexpected")
      console.error("Error requesting email change:", err)
      setIsSubmitting(false)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as Step)
      setError(null)
    }
  }

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{t("account.email.securityVerification")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("account.email.passwordHelp")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("account.email.currentPassword")}</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  aria-label={t("account.email.currentPassword")}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(null)
                  }}
                  placeholder={t("account.email.passwordPlaceholder")}
                  className="pr-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handlePasswordVerification()
                    }
                  }}
                />
                <button
                  type="button"
                  aria-label={t(showPassword ? "account.email.hidePassword" : "account.email.showPassword")}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{t("account.email.newAddress")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("account.email.newHelp")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("account.email.currentEmail")}</label>
              <Input
                aria-label={t("account.email.currentEmail")}
                value={currentEmail}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("account.email.newEmail")}</label>
              <Input
                type="email"
                aria-label={t("account.email.newEmail")}
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value)
                  setError(null)
                }}
                placeholder={t("account.email.emailPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleEmailSubmit()
                  }
                }}
              />
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {t("account.email.confirmTitle")}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {t("account.email.review")}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("account.email.currentEmail")}</label>
                <p className="text-base mt-1">{currentEmail}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("account.email.newEmail")}</label>
                <p className="text-base mt-1">{newEmail}</p>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>{t("account.email.important")}</strong> {t("account.email.confirmationHelp", { email: newEmail })}
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("account.email.changeAddress")}
          </DialogTitle>
          <DialogDescription>
            {t("account.email.step", { step, title: t(step === 1 ? "account.email.verifyPassword" : step === 2 ? "account.email.enterNew" : "account.email.confirmChange") })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-6">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step >= s
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
                  </div>
                  <span className="text-xs mt-1 text-muted-foreground">
                    {s === 1 && t("account.email.password")}
                    {s === 2 && t("account.email.newEmail")}
                    {s === 3 && t("account.email.confirm")}
                  </span>
                </div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      step > s ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {renderStepContent()}

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{t(error)}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              onClick={step === 1 ? handleClose : handleBack}
              disabled={isVerifying || isSubmitting}
            >
              {step === 1 ? t("common.cancel") : t("pdp.back")}
            </Button>

            <div className="flex gap-2">
              {step === 1 && (
                <Button
                  onClick={handlePasswordVerification}
                  disabled={isVerifying || !password.trim()}
                >
                  {isVerifying ? t("account.email.verifying") : t("account.email.continue")}
                </Button>
              )}

              {step === 2 && (
                <Button
                  onClick={handleEmailSubmit}
                  disabled={!newEmail.trim()}
                >
                  {t("account.email.continue")}
                </Button>
              )}

              {step === 3 && (
                <Button
                  onClick={handleConfirm}
                  disabled={isSubmitting || isUpdating}
                >
                  {isSubmitting || isUpdating ? t("account.email.sending") : t("account.email.sendConfirmation")}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


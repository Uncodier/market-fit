"use client"

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
      setError("Password is required")
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
        setError("Invalid password. Please try again.")
        setIsVerifying(false)
        return
      }

      // Password is valid, proceed to next step
      setStep(2)
      setError(null)
    } catch (err) {
      setError("An error occurred. Please try again.")
      console.error("Error verifying password:", err)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleEmailSubmit = async () => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!newEmail.trim()) {
      setError("Email is required")
      return
    }

    if (!emailRegex.test(newEmail)) {
      setError("Please enter a valid email address")
      return
    }

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setError("New email must be different from current email")
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
        setError("Failed to request email change. Please try again.")
        setIsSubmitting(false)
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
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
                <p className="text-sm font-medium">Security Verification</p>
                <p className="text-xs text-muted-foreground">
                  Please confirm your password to continue
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Current Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(null)
                  }}
                  placeholder="Enter your password"
                  className="pr-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handlePasswordVerification()
                    }
                  }}
                />
                <button
                  type="button"
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
                <p className="text-sm font-medium">New Email Address</p>
                <p className="text-xs text-muted-foreground">
                  Enter your new email address
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Current Email</label>
              <Input
                value={currentEmail}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">New Email</label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value)
                  setError(null)
                }}
                placeholder="newemail@example.com"
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
                  Confirm Email Change
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Please review the email addresses below
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Current Email</label>
                <p className="text-base mt-1">{currentEmail}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">New Email</label>
                <p className="text-base mt-1">{newEmail}</p>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Important:</strong> A verification email will be sent to {newEmail}. 
                You must click the link in that email to confirm the change. 
                Your current email will remain active until you confirm the new one.
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
            Change Email Address
          </DialogTitle>
          <DialogDescription>
            Step {step} of 3: {step === 1 && "Verify Password"}
            {step === 2 && "Enter New Email"}
            {step === 3 && "Confirm Change"}
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
                    {s === 1 && "Password"}
                    {s === 2 && "New Email"}
                    {s === 3 && "Confirm"}
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
              <p className="text-sm text-destructive">{error}</p>
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
              {step === 1 ? "Cancel" : "Back"}
            </Button>

            <div className="flex gap-2">
              {step === 1 && (
                <Button
                  onClick={handlePasswordVerification}
                  disabled={isVerifying || !password.trim()}
                >
                  {isVerifying ? "Verifying..." : "Continue"}
                </Button>
              )}

              {step === 2 && (
                <Button
                  onClick={handleEmailSubmit}
                  disabled={!newEmail.trim()}
                >
                  Continue
                </Button>
              )}

              {step === 3 && (
                <Button
                  onClick={handleConfirm}
                  disabled={isSubmitting || isUpdating}
                >
                  {isSubmitting || isUpdating ? "Sending..." : "Confirm & Send Verification Email"}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


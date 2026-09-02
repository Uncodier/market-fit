"use client"

import React from "react"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Button } from "@/app/components/ui/button"
import { Loader2 } from "@/app/components/ui/icons"

type Translate = (key: string) => string

interface CheckoutOtpCodeFormProps {
  otpEmail: string
  otpCode: string
  setOtpCode: (value: string) => void
  loading: boolean
  timer: number
  onBack: () => void
  onResend: () => void
  onVerify: () => void
  t: Translate
}

export function CheckoutOtpCodeForm({
  otpEmail,
  otpCode,
  setOtpCode,
  loading,
  timer,
  onBack,
  onResend,
  onVerify,
  t,
}: CheckoutOtpCodeFormProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t("checkout.identity.verification") || "Verification"}
        </span>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-primary hover:underline"
        >
          {t("checkout.identity.useDifferentEmail") || "Use a different email"}
        </button>
      </div>
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-0">
            {t("checkout.identity.enterCode") || "Enter the 6-digit code"}
          </Label>
          <button
            type="button"
            onClick={onResend}
            disabled={loading || timer > 0}
            className="text-[10px] font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline shrink-0"
          >
            {timer > 0
              ? `${t("checkout.identity.resendIn") || "Resend in"} ${timer}s`
              : t("checkout.identity.resendCode") || "Resend code"}
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 justify-between">
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const char = otpCode[index] && otpCode[index] !== " " ? otpCode[index] : ""
              return (
                <Input
                  key={index}
                  id={`otp-input-${index}`}
                  type="text"
                  inputMode="numeric"
                  placeholder="-"
                  value={char}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "")
                    const chars = otpCode.padEnd(6, " ").split("")

                    if (val) {
                      chars[index] = val.slice(-1)
                      setOtpCode(chars.join(""))
                      if (index < 5) {
                        document.getElementById(`otp-input-${index + 1}`)?.focus()
                      }
                    } else {
                      chars[index] = " "
                      setOtpCode(chars.join(""))
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !char && index > 0) {
                      document.getElementById(`otp-input-${index - 1}`)?.focus()
                    }
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (otpCode.replace(/ /g, "").length === 6) onVerify()
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault()
                    const pasted = e.clipboardData
                      .getData("text")
                      .replace(/[^0-9]/g, "")
                      .substring(0, 6)
                    if (pasted) {
                      setOtpCode(pasted.padEnd(6, " "))
                      const focusIndex = Math.min(pasted.length - 1, 5)
                      setTimeout(() => {
                        document.getElementById(`otp-input-${focusIndex}`)?.focus()
                      }, 10)
                    }
                  }}
                  className="h-12 w-full rounded-xl text-center text-lg font-mono p-0"
                  disabled={loading}
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                />
              )
            })}
          </div>
          <Button
            type="button"
            onClick={onVerify}
            disabled={loading || otpCode.replace(/ /g, "").length < 6}
            className="h-12 rounded-xl w-full"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t("checkout.identity.verify") || "Verify"
            )}
          </Button>
        </div>
        <div className="mt-3">
          <p className="text-xs text-gray-500 truncate">
            <span>{t("checkout.identity.codeSentTo") || "Code sent to"}</span>{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {otpEmail}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

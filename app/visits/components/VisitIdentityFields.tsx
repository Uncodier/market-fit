"use client"

import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"

export function VisitIdentityFields({
  mode,
  visitorName,
  visitorEmail,
  visitorPhone,
  nameError,
  emailError,
  phoneError,
  contactHintError,
  onNameChange,
  onEmailChange,
  onPhoneChange,
}: {
  mode: "kiosk" | "buyer"
  visitorName: string
  visitorEmail: string
  visitorPhone: string
  nameError?: string | null
  emailError?: string | null
  phoneError?: string | null
  contactHintError?: string | null
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onPhoneChange: (value: string) => void
}) {
  const { t } = useLocalization()

  if (mode === "buyer") {
    return (
      <div className="rounded-xl border bg-muted/20 p-4 text-sm space-y-1">
        <p>
          <span className="text-muted-foreground">{t("visits.labels.name")}: </span>
          <span className="font-medium">{visitorName || t("visits.yourAccount")}</span>
        </p>
        {visitorEmail && (
          <p>
            <span className="text-muted-foreground">{t("visits.labels.email")}: </span>
            <span className="font-medium">{visitorEmail}</span>
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-2">
        <Label className="text-sm font-semibold">{t("visits.fields.fullName")}</Label>
        <Input
          className={cn("h-12 bg-background", nameError && "border-destructive focus-visible:ring-destructive")}
          autoComplete="name"
          value={visitorName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t("visits.placeholders.fullName")}
          aria-invalid={Boolean(nameError)}
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>
      <p className={cn("text-xs -mt-1", contactHintError ? "text-destructive" : "text-muted-foreground")}>
        {contactHintError || t("visits.identity.contactHint")}
      </p>
      <div className="grid gap-2">
        <Label className="text-sm font-semibold">{t("visits.fields.email")}</Label>
        <Input
          className={cn("h-12 bg-background", emailError && "border-destructive focus-visible:ring-destructive")}
          type="email"
          autoComplete="email"
          value={visitorEmail}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder={t("visits.placeholders.email")}
          aria-invalid={Boolean(emailError)}
        />
        {emailError && <p className="text-xs text-destructive">{emailError}</p>}
      </div>
      <div className="grid gap-2">
        <Label className="text-sm font-semibold">{t("visits.fields.phone")}</Label>
        <Input
          className={cn("h-12 bg-background", phoneError && "border-destructive focus-visible:ring-destructive")}
          type="text"
          inputMode="tel"
          autoComplete="tel"
          value={visitorPhone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder={t("visits.placeholders.phone")}
          aria-invalid={Boolean(phoneError)}
        />
        {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
      </div>
    </>
  )
}

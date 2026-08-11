"use client"

import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import { VisitIdentityFields } from "./VisitIdentityFields"
import { VisitSliderCard } from "./VisitSliderCard"

export function VisitIdentityStep({
  index,
  activeIndex,
  isActive,
  mode,
  visitorName,
  visitorEmail,
  visitorPhone,
  nameOk,
  identityOk,
  emailInvalid,
  phoneInvalid,
  nameError,
  emailError,
  phoneError,
  contactHintError,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onTouch,
  onContinue,
  onActivate,
}: {
  index: number
  activeIndex: number
  isActive: boolean
  mode: "kiosk" | "buyer"
  visitorName: string
  visitorEmail: string
  visitorPhone: string
  nameOk: boolean
  identityOk: boolean
  emailInvalid: boolean
  phoneInvalid: boolean
  nameError?: string | null
  emailError?: string | null
  phoneError?: string | null
  contactHintError?: string | null
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onTouch: () => void
  onContinue: () => void
  onActivate: () => void
}) {
  const { t } = useLocalization()

  return (
    <VisitSliderCard
      index={index}
      activeIndex={activeIndex}
      unlocked
      isActive={isActive}
      title={t("visits.steps.identity.title")}
      description={t("visits.steps.identity.description")}
      onActivate={onActivate}
      footer={
        <Button
          type="button"
          className="w-full font-semibold shadow-sm"
          disabled={!identityOk}
          onClick={() => {
            onTouch()
            if (!identityOk) {
              if (!nameOk) toast.error(t("visits.identity.nameRequired"))
              else if (emailInvalid) toast.error(t("visits.identity.emailInvalid"))
              else if (phoneInvalid) toast.error(t("visits.identity.phoneInvalid"))
              else toast.error(t("visits.identity.contactRequired"))
              return
            }
            onContinue()
          }}
        >
          {t("visits.actions.continue")}
        </Button>
      }
    >
      <VisitIdentityFields
        mode={mode}
        visitorName={visitorName}
        visitorEmail={visitorEmail}
        visitorPhone={visitorPhone}
        nameError={nameError}
        emailError={emailError}
        phoneError={phoneError}
        contactHintError={contactHintError}
        onNameChange={onNameChange}
        onEmailChange={onEmailChange}
        onPhoneChange={onPhoneChange}
      />
    </VisitSliderCard>
  )
}

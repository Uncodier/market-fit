"use client"

import { Button } from "@/app/components/ui/button"
import {
  SectionCard,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { Check, AppWindow } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

interface OnboardingCompleteCardProps {
  modeLabel?: string | null
  allDone: boolean
  onGoToDashboard: () => void
}

export function OnboardingCompleteCard({
  modeLabel,
  allDone,
  onGoToDashboard,
}: OnboardingCompleteCardProps) {
  const { t } = useLocalization()
  const title = allDone
    ? t("dashboard.onboarding.complete.allTitle")
    : t("dashboard.onboarding.complete.title")
  const subtitle = allDone
    ? t("dashboard.onboarding.complete.allSubtitle")
    : t("dashboard.onboarding.complete.subtitle", { mode: modeLabel || "" })

  return (
    <SectionCard>
      <SectionCardContent className="py-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              {subtitle}
            </p>
          </div>
          <Button onClick={onGoToDashboard}>
            <AppWindow className="h-4 w-4 mr-2" />
            {t("dashboard.onboarding.cta.goToDashboard")}
          </Button>
        </div>
      </SectionCardContent>
    </SectionCard>
  )
}

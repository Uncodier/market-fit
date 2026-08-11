"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { CheckCircle2 } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export function VisitSuccessPanel({
  isActive,
  visitorName,
  visitorEmail,
  resourceLabel,
  durationMinutes,
  backUrl,
  onRegisterAnother,
}: {
  isActive: boolean
  visitorName: string
  visitorEmail?: string
  resourceLabel: string
  durationMinutes: number
  backUrl?: string
  onRegisterAnother: () => void
}) {
  const { t } = useLocalization()
  const router = useRouter()

  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50 text-center">
        <CheckCircle2 className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-muted-foreground">{t("visits.success.almostThere")}</h2>
        <p className="text-sm text-muted-foreground">{t("visits.success.completePrevious")}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center pt-6">
      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
      </div>
      <h1 className="text-2xl font-bold">{t("visits.success.title")}</h1>
      <p className="text-muted-foreground max-w-[280px] mt-2">
        {t("visits.success.message", { name: visitorName ? `, ${visitorName}` : "" })}
      </p>
      <div className="pt-4 border-t border-border mt-6 text-left space-y-2 w-full max-w-[280px]">
        <p className="text-sm"><strong>{t("visits.labels.visitor")}:</strong> {visitorName}</p>
        {visitorEmail && <p className="text-sm"><strong>{t("visits.labels.email")}:</strong> {visitorEmail}</p>}
        <p className="text-sm"><strong>{t("visits.labels.target")}:</strong> {resourceLabel}</p>
        <p className="text-sm">
          <strong>{t("visits.steps.duration.title")}:</strong> {t("visits.minutes", { count: durationMinutes })}
        </p>
      </div>
      <div className="pt-6 w-full max-w-[280px]">
        <Button
          className="w-full font-semibold shadow-sm"
          onClick={() => {
            if (backUrl) router.push(backUrl)
            else onRegisterAnother()
          }}
        >
          {backUrl ? t("visits.actions.done") : t("visits.actions.registerAnother")}
        </Button>
      </div>
    </div>
  )
}

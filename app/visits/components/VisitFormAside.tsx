"use client"

import { Clock, PenTool } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export function VisitFormAside({
  siteName,
  siteLogo,
  durationMinutes,
  summaryLine,
  title,
  hint,
}: {
  siteName: string
  siteLogo?: string | null
  durationMinutes: number
  summaryLine?: string | null
  title?: string
  hint?: string
}) {
  const { t } = useLocalization()

  return (
    <aside className="md:col-span-1 space-y-6 flex flex-col justify-center items-center md:items-start text-center md:text-left bg-background relative z-10 md:-mr-8 md:pr-8">
      <div className="flex items-center gap-3 w-full justify-center md:justify-start">
        {siteLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={siteLogo} alt={siteName} className="h-10 w-auto max-w-[160px] object-contain" />
        ) : (
          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-lg">{siteName.charAt(0)}</span>
          </div>
        )}
        <span className="font-semibold text-xl">{siteName}</span>
      </div>
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/10">
        <PenTool className="h-7 w-7 text-primary" />
      </div>
      <div className="w-full space-y-3">
        <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">{t("visits.eyebrow")}</p>
        <h1 className="text-2xl font-semibold">{title || t("visits.title")}</h1>
        <p className="flex items-center gap-2 text-muted-foreground text-sm justify-center md:justify-start">
          <Clock className="h-4 w-4" />
          {t("visits.minutes", { count: durationMinutes })}
        </p>
        {summaryLine && <p className="text-sm font-medium">{summaryLine}</p>}
        <p className="text-muted-foreground text-sm">{hint || t("visits.sidebarHint")}</p>
      </div>
    </aside>
  )
}

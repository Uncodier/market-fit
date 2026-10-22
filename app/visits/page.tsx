"use client"

import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { VisitRegistrationForm } from "./components/VisitRegistrationForm"
import { VisitFormSkeleton } from "./components/VisitFormSkeleton"

function VisitsPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-background overflow-hidden">
      <main className="flex-1 flex items-center justify-center p-4 overflow-x-hidden md:overflow-x-visible">
        {children}
      </main>
    </div>
  )
}

function VisitsPageContent() {
  const { t } = useLocalization()
  const { currentSite, isLoading } = useSite()
  const searchParams = useSearchParams()
  const reservationId = searchParams.get("reservationId") || undefined

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("breadcrumb:update", {
        detail: { title: t("layout.sidebar.visits"), parent: null },
      })
    )
  }, [t])

  if (isLoading) {
    return (
      <VisitsPageShell>
        <VisitFormSkeleton />
      </VisitsPageShell>
    )
  }

  if (!currentSite) {
    return (
      <VisitsPageShell>
        <div className="text-sm text-muted-foreground">{t("operations.visits.selectSite")}</div>
      </VisitsPageShell>
    )
  }

  return (
    <VisitsPageShell>
      <VisitRegistrationForm
        siteId={currentSite.id}
        mode="kiosk"
        reservationId={reservationId}
      />
    </VisitsPageShell>
  )
}

export default function VisitsPage() {
  return (
    <Suspense
      fallback={
        <VisitsPageShell>
          <VisitFormSkeleton />
        </VisitsPageShell>
      }
    >
      <VisitsPageContent />
    </Suspense>
  )
}

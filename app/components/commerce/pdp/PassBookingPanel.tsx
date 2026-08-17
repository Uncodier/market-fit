"use client"

import { useState } from "react"
import { BookingExperience } from "@/app/components/commerce/booking/BookingExperience"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useLocalization } from "@/app/context/LocalizationContext"
import { CheckCircle } from "@/app/components/ui/icons"

export function PassBookingPanel({
  entitlement,
  services,
  initialServiceId,
  backUrl,
}: {
  entitlement: any
  services: any[]
  initialServiceId?: string | null
  backUrl: string
}) {
  const { t } = useLocalization()
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(() => {
    if (initialServiceId && services.some((s) => s.id === initialServiceId)) return initialServiceId
    if (services.length === 1) return services[0].id
    return null
  })

  const selectedService = services.find((s) => s.id === selectedServiceId)

  if (!services.length) {
    return (
      <div className="rounded-3xl border bg-card p-8 text-center">
        <h2 className="font-bold text-xl mb-2">{t("booking.unavailable") || "Unavailable"}</h2>
        <p className="text-muted-foreground">
          {t("booking.noRedeemableServices") ||
            "No reservable services are attached to this pass."}
        </p>
      </div>
    )
  }

  const hasNoAccess = entitlement.uses_remaining === 0 || entitlement.status === "expired" || entitlement.status === "cancelled"

  return (
    <div className="space-y-4 md:space-y-6 flex-1 min-h-0 flex flex-col">
      {hasNoAccess && (
        <div className="overflow-hidden rounded-3xl border border-destructive/20 bg-destructive/5 relative p-6 sm:p-8 flex items-center gap-6 shrink-0">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-destructive/0 via-destructive/50 to-destructive/0" />
          <div className="inline-flex items-center justify-center w-14 h-14 bg-destructive/10 rounded-full shrink-0">
            <span className="text-2xl font-bold text-destructive">!</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground tracking-tight mb-1">
              {t("pdp.noAccess") || "No access remaining"}
            </h3>
            <p className="text-sm text-muted-foreground font-medium">
              {t("pdp.renewToContinue") || "Please renew your pass to continue booking."}
            </p>
          </div>
        </div>
      )}

      {(!hasNoAccess && (entitlement.uses_remaining != null || services.length > 1)) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            {entitlement.uses_remaining != null && !hasNoAccess && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary rounded-full text-sm font-bold">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {entitlement.uses_remaining} {t("buyer.library.usesRemaining") || "uses remaining"}
              </div>
            )}
          </div>

          {services.length > 1 && (
            <Select value={selectedServiceId || ""} onValueChange={setSelectedServiceId}>
              <SelectTrigger className="w-full sm:w-[280px] bg-background font-medium h-12 rounded-xl">
                <SelectValue placeholder={t("booking.selectService") || "Choose a service"} />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {selectedService ? (
        <div className={hasNoAccess ? "opacity-50 pointer-events-none flex-1 min-h-0 flex flex-col" : "flex-1 min-h-0 flex flex-col"}>
          <BookingExperience
            mode="entitlement"
            item={selectedService}
            entitlementId={entitlement.id}
            passItem={entitlement.catalog_item || entitlement.subscription?.catalog_item}
            backUrl={backUrl}
            hideHeader
          />
        </div>
      ) : (
        <div className="rounded-3xl border bg-muted/30 p-8 text-center text-muted-foreground">
          {t("booking.selectService") || "Choose a service to book"}
        </div>
      )}
    </div>
  )
}

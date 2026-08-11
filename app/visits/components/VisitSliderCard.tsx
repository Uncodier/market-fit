"use client"

import { Card, CardContent } from "@/app/components/ui/card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Button } from "@/app/components/ui/button"
import { ChevronLeft } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { getVisitCardMotion } from "./visit-slider"

export function VisitSliderCard({
  index,
  activeIndex,
  unlocked,
  isActive,
  isSuccess,
  title,
  description,
  onActivate,
  onBack,
  showMobileBack,
  footer,
  children,
}: {
  index: number
  activeIndex: number
  unlocked: boolean
  isActive: boolean
  isSuccess?: boolean
  title: string
  description?: string
  onActivate: () => void
  onBack?: () => void
  showMobileBack?: boolean
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const { t } = useLocalization()
  const motion = getVisitCardMotion(index, activeIndex)

  return (
    <Card
      className={cn(
        "visit-slide-card bg-black/[0.005] dark:bg-white/[0.005] border dark:border-white/5 border-black/5 shadow-sm h-[590px] flex flex-col transition-all duration-500 ease-in-out w-full md:w-[590px] md:max-w-full",
        !isActive && "md:opacity-60 hover:md:opacity-100",
        !unlocked && !isSuccess && "pointer-events-none opacity-50",
        isSuccess && !isActive && "pointer-events-none opacity-50"
      )}
      style={
        {
          "--visit-transform": motion.transform,
          "--visit-opacity": String(motion.opacity),
          "--visit-z": String(motion.zIndex),
        } as React.CSSProperties
      }
    >
      {!isActive && unlocked && !isSuccess && (
        <div
          className="absolute inset-0 z-50 cursor-pointer hidden md:block"
          onClick={onActivate}
        />
      )}
      <CardContent className="p-6 flex-1 flex flex-col min-h-0 overflow-y-auto relative z-20 space-y-4">
        {showMobileBack && onBack && (
          <div className="flex items-center justify-start md:hidden">
            <Button variant="ghost" className="h-8 text-muted-foreground pl-0" onClick={onBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t("visits.back")}
            </Button>
          </div>
        )}
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {children}
      </CardContent>
      {footer ? <ActionFooter className="relative z-20">{footer}</ActionFooter> : null}
    </Card>
  )
}

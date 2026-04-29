"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Progress } from "@/app/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import {
  countOnboardingProgress,
  isOnboardingFullyComplete,
} from "@/app/lib/onboarding-completion"

interface OnboardingProgressWidgetProps {
  className?: string
  isCollapsed?: boolean
}

export function OnboardingProgressWidget({
  className,
  isCollapsed,
}: OnboardingProgressWidgetProps) {
  const { currentSite } = useSite()
  const router = useRouter()
  const { t } = useLocalization()
  const [loading, setLoading] = useState(true)
  const [complete, setComplete] = useState(true)
  const [pct, setPct] = useState(100)

  useEffect(() => {
    if (!currentSite?.id) {
      setLoading(false)
      setComplete(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("settings")
          .select("onboarding")
          .eq("site_id", currentSite.id)
          .single()
        const raw = data?.onboarding as Record<string, boolean> | undefined
        if (cancelled) return
        const done = isOnboardingFullyComplete(raw)
        setComplete(done)
        const { done: n, total } = countOnboardingProgress(raw)
        setPct(total > 0 ? Math.round((n / total) * 100) : 0)
      } catch {
        if (!cancelled) {
          setComplete(false)
          setPct(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentSite?.id])

  const openOnboarding = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push("/onboarding")
  }

  if (loading || complete) {
    return null
  }

  if (isCollapsed) {
    const radius = 10
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset =
      circumference - (pct / 100) * circumference
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors rounded-full",
                "w-[32px] h-[32px]",
                className
              )}
              onClick={openOnboarding}
            >
              <div className="relative w-[24px] h-[24px] flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90 absolute inset-0">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    className="text-black/10 dark:text-white/10"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="text-primary transition-all duration-500"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] select-none z-10">☑️</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="z-[9999]">
            <p>{t("layout.sidebar.setupProgress") || "Onboarding"}</p>
            <p className="text-xs text-muted-foreground">{pct}%</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className={cn("px-3 py-2", className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              onClick={openOnboarding}
              className="bg-muted/30 rounded-lg p-3 border dark:border-white/5 border-black/5/50 cursor-pointer hover:bg-muted/50 transition-colors group font-inter"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1.5">
                  <span className="text-xs">☑️</span>
                  {t("layout.sidebar.setupProgress") || "Onboarding"}
                </span>
                <span className="text-xs font-bold text-foreground">{pct}%</span>
              </div>
              <Progress
                value={pct}
                className="h-1.5 bg-black/10 dark:bg-white/10"
                indicatorClassName="bg-primary"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="z-[9999]">
            <p>{t("layout.sidebar.continueSetup") || "Continue setup"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

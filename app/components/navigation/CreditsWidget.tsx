"use client"

import { useSite } from "@/app/context/SiteContext"
import { cn } from "@/lib/utils"
import { Progress } from "@/app/components/ui/progress"
import { useRouter } from "next/navigation"
import { navigateOrAssign } from "@/lib/navigation/stale-router"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useLocalization } from "@/app/context/LocalizationContext"
import styles from "./credits-widget.module.css"

interface CreditsWidgetProps {
  className?: string
  isCollapsed?: boolean
}

export function CreditsWidget({ className, isCollapsed }: CreditsWidgetProps) {
  const { currentSite } = useSite()
  const router = useRouter()
  const { t } = useLocalization()
  
  // Get values from site context
  const creditsAvailable = currentSite?.billing?.credits_available ?? 0
  const withdrawableCredits = currentSite?.billing?.account_balance ?? 0
  const usableCredits = creditsAvailable + withdrawableCredits
  const plan = currentSite?.billing?.plan || 'commission'
  const addonsCount = currentSite?.billing?.addons_count || 0
  
  // Determine base limit based on plan
  let baseLimit = 1; // default/commission/free
  if (plan === 'engine') {
    baseLimit = 20;
  } else if (plan === 'foundry') {
    baseLimit = 100;
  } else if (plan === 'enterprise') {
    baseLimit = 500;
  }
  
  baseLimit += addonsCount * 5;
  
  // Keep the plan allowance as the displayed reference, but fit both balances
  // proportionally within one track when the available total exceeds it.
  const totalCredits = baseLimit
  const percentage = Math.max(0, (usableCredits / totalCredits) * 100)
  const barTotal = Math.max(totalCredits, usableCredits)
  // A negative balance offsets usable funds without creating a negative segment.
  const regularBarCredits = Math.max(0, Math.min(creditsAvailable, usableCredits))
  const withdrawableBarCredits = Math.max(0, usableCredits - regularBarCredits)
  const regularPercentage = (regularBarCredits / barTotal) * 100
  const withdrawablePercentage = (withdrawableBarCredits / barTotal) * 100
  const isOverLimit = usableCredits < 0
  const regularColor = isOverLimit ? "bg-destructive" : percentage < 20 ? "bg-amber-500" : "bg-primary"
  
  if (currentSite?.id.startsWith('demo-')) {
    return null
  }

  // Preserve low-balance visibility and always surface funds available to withdraw.
  const showWidget = isOverLimit || percentage < 50 || withdrawableCredits > 0
  if (!showWidget) {
    return null
  }

  // Format for display
  const displayTotal = Math.round(totalCredits)
  const displayAvailable = Number(usableCredits.toFixed(3))
  const displayRegular = Number(creditsAvailable.toFixed(3))
  const displayWithdrawable = Number(withdrawableCredits.toFixed(3))
  const balanceSummary = `${displayAvailable} credits available: ${displayRegular} regular, ${displayWithdrawable} withdrawable`
  const manageCreditsLabel = t('layout.sidebar.manageCredits') || 'Manage credits'
  const balanceBreakdown = (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px]">
      <span className="flex items-center gap-1 text-muted-foreground">
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", regularColor)} />
        {displayRegular} regular
      </span>
      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        {displayWithdrawable} withdrawable
      </span>
    </div>
  )

  const handleBuyCredits = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigateOrAssign(router, '/billing')
  }

  // Collapsed view - Pie Graph
  if (isCollapsed) {
    const radius = 10
    const circumference = 2 * Math.PI * radius
    const regularArc = (regularPercentage / 100) * circumference
    const withdrawableArc = (withdrawablePercentage / 100) * circumference
    
    // Determine color for the collapsed state
    const strokeColor = isOverLimit ? "text-destructive" : percentage < 20 ? "text-amber-500" : "text-primary"

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={manageCreditsLabel}
              className={cn(
                "flex items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors rounded-full", 
                "w-[32px] h-[32px] shrink-0",
                styles.trigger,
                className
              )}
              onClick={handleBuyCredits}
            >
              <div className={cn("relative w-[24px] h-[24px] shrink-0 flex items-center justify-center", styles.ringFrame)}>
                {/* Background circle */}
                <svg
                  role="img"
                  aria-label={balanceSummary}
                  viewBox="0 0 24 24"
                  width={24}
                  height={24}
                  className={styles.ring}
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    className="text-black/10 dark:text-white/10"
                  />
                  {/* Adjacent regular and withdrawable arcs share the same ring. */}
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={`${regularArc} ${circumference}`}
                    strokeDashoffset={0}
                    className={cn("transition-all duration-500 ease-in-out", strokeColor)}
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={`${withdrawableArc} ${circumference}`}
                    strokeDashoffset={-regularArc}
                    className="text-emerald-500 transition-all duration-500 ease-in-out"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] select-none z-10">⚡</span>
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="z-[9999]">
            <p>{manageCreditsLabel}</p>
            <p className="text-xs text-muted-foreground">{displayAvailable} / {displayTotal} {t('layout.sidebar.creditsAvailable') || 'available'}</p>
            {balanceBreakdown}
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
            <button
              type="button"
              aria-label={manageCreditsLabel}
              onClick={handleBuyCredits}
              className="!block w-full text-left bg-muted/30 rounded-lg p-3 border dark:border-white/5 border-black/5/50 cursor-pointer hover:bg-muted/50 transition-colors group font-inter"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1.5">
                  <span className="text-xs">⚡</span>
                  {t('layout.sidebar.credits') || 'Credits'}
                </span>
                <span className={cn(
                  "text-xs font-bold whitespace-nowrap",
                  isOverLimit ? "text-destructive" : "text-foreground"
                )}>
                  {displayAvailable} / {displayTotal}
                </span>
              </div>
              
              <Progress 
                value={Math.min(100, percentage)}
                aria-label={t('layout.sidebar.credits') || 'Credits'}
                aria-valuetext={balanceSummary}
                className="h-1.5 bg-black/10 dark:bg-white/10" 
                segments={[
                  { label: "Regular credits", value: regularPercentage, className: regularColor },
                  { label: "Withdrawable credits", value: withdrawablePercentage, className: "bg-emerald-500" },
                ]}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="z-[9999]">
            <p>{manageCreditsLabel}</p>
            {balanceBreakdown}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

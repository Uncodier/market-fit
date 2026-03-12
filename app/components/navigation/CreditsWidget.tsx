"use client"

import { useSite } from "@/app/context/SiteContext"
import { cn } from "@/lib/utils"
import { Progress } from "@/app/components/ui/progress"
import { useRouter } from "next/navigation"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useLocalization } from "@/app/context/LocalizationContext"

interface CreditsWidgetProps {
  className?: string
  isCollapsed?: boolean
}

export function CreditsWidget({ className, isCollapsed }: CreditsWidgetProps) {
  const { currentSite } = useSite()
  const router = useRouter()
  const { t } = useLocalization()
  
  // Default values
  const defaultMonthlyCredits = 30
  
  // Get values from site context
  const creditsAvailable = currentSite?.billing?.credits_available || 0
  const creditsUsed = currentSite?.billing?.credits_used || 0
  
  // Calculate total limit (default 30 + any purchased credits)
  // If user purchased credits, they are added to creditsAvailable
  // So the total capacity is what they started with (30) + what they bought
  // But since we don't track "purchased amount" separately in the context easily,
  // we can infer the limit.
  
  // Logic: 
  // 1. Base limit is 30
  // 2. If they have more than 30 available, it means they bought some.
  //    So the limit should be at least (available + used)
  // 3. If they haven't bought any, the limit is 30.
  
  // Let's try a simpler approach based on the requirement:
  // "default 30, si compro creditos ese sería su nuevo top"
  // This implies the "limit" grows when you buy credits.
  
  // If creditsAvailable > 30, then the limit is creditsAvailable (assuming 0 used)
  // If creditsAvailable + creditsUsed > 30, then the limit is creditsAvailable + creditsUsed
  
  const totalCredits = Math.max(defaultMonthlyCredits, creditsAvailable + creditsUsed)
  
  // Calculate percentage for the progress bar
  // Show AVAILABLE credits (fuel gauge style)
  // If creditsAvailable is negative (overage), percentage is 0
  const percentage = Math.min(100, Math.max(0, (creditsAvailable / totalCredits) * 100))
  
  // Determine color based on usage
  // If creditsAvailable < 0 (over limit), show red
  // If percentage < 20% (low credits), show yellow/orange
  // Otherwise show primary color
  const isOverLimit = creditsAvailable < 0
  
  const handleBuyCredits = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push('/billing')
  }

  // Collapsed view - Pie Graph
  if (isCollapsed) {
    const radius = 10
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (percentage / 100) * circumference
    
    // Determine color for the collapsed state
    const strokeColor = isOverLimit ? "text-destructive" : percentage < 20 ? "text-amber-500" : "text-primary"

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
              onClick={handleBuyCredits}
            >
              <div className="relative w-[24px] h-[24px] flex items-center justify-center">
                {/* Background circle */}
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
                  {/* Progress circle */}
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 10}
                    strokeDashoffset={(2 * Math.PI * 10) - (percentage / 100) * (2 * Math.PI * 10)}
                    strokeLinecap="round"
                    className={cn("transition-all duration-500 ease-in-out", strokeColor)}
                  />
                </svg>
                <span className="text-[10px] leading-none select-none">⚡</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="z-[9999]">
            <p>{t('layout.sidebar.manageCredits') || 'Manage credits'}</p>
            <p className="text-xs text-muted-foreground">{creditsAvailable} / {totalCredits} {t('layout.sidebar.creditsAvailable') || 'available'}</p>
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
              onClick={handleBuyCredits}
              className="bg-muted/30 rounded-lg p-3 border dark:border-white/5 border-black/5/50 cursor-pointer hover:bg-muted/50 transition-colors group font-inter"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1.5">
                  <span className="text-xs">⚡</span>
                  {t('layout.sidebar.credits') || 'Credits'}
                </span>
                <span className={cn(
                  "text-xs font-bold",
                  isOverLimit ? "text-destructive" : "text-foreground"
                )}>
                  {creditsAvailable} / {totalCredits}
                </span>
              </div>
              
              <Progress 
                value={percentage} 
                className="h-1.5 bg-black/10 dark:bg-white/10" 
                indicatorClassName={cn(
                  isOverLimit ? "bg-destructive" : 
                  percentage < 20 ? "bg-amber-500" : "bg-primary"
                )}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="z-[9999]">
            <p>{t('layout.sidebar.manageCredits') || 'Manage credits'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

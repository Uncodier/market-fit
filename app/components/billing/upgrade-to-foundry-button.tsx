"use client"

import { Button } from "@/app/components/ui/button"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"
import { TrendingUp } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

interface UpgradeToFoundryButtonProps {
  className?: string
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  children?: React.ReactNode
}

export function UpgradeToFoundryButton({ 
  className = "",
  variant = "default",
  size = "default",
  children
}: UpgradeToFoundryButtonProps) {
  const { t } = useLocalization()
  const router = useRouter()
  const { currentSite } = useSite()

  const handleUpgrade = () => {
    if (!currentSite) {
      return
    }

    // Redirect to billing page instead of directly to Stripe
    router.push('/billing')
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleUpgrade}
    >
      {children ? (
        children
      ) : (
        <>
          <TrendingUp className="mr-2 h-4 w-4" />
          {t('billing.upgrade.toFoundry', { plan: t('billing.plan.foundry.title') || "Foundry" }) || `Upgrade to ${t('billing.plan.foundry.title') || "Foundry"}`}
        </>
      )}
    </Button>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { useRouter } from "next/navigation"
import { TrendingUp } from "@/app/components/ui/icons"

interface UpgradeToStartupButtonProps {
  className?: string
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  children?: React.ReactNode
}

export function UpgradeToStartupButton({ 
  className = "",
  variant = "default",
  size = "default",
  children
}: UpgradeToStartupButtonProps) {
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
          Upgrade to Startup
        </>
      )}
    </Button>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { billingService } from "@/app/services/billing-service"
import { toast } from "sonner"
import { TrendingUp } from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"

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
  const [isUpgrading, setIsUpgrading] = useState(false)
  const { user } = useAuth()
  const { currentSite } = useSite()

  const handleUpgrade = async () => {
    if (!currentSite || !user?.email) {
      toast.error("No site selected or user not authenticated")
      return
    }

    setIsUpgrading(true)
    
    try {
      const result = await billingService.createSubscriptionCheckoutSession(
        currentSite.id,
        'startup',
        user.email
      )
      
      if (result.success && result.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.url
      } else {
        toast.error(result.error || "Failed to create checkout session")
      }
    } catch (error) {
      console.error("Error upgrading to startup:", error)
      toast.error("An unexpected error occurred while upgrading")
    } finally {
      setIsUpgrading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleUpgrade}
      disabled={isUpgrading}
    >
      {isUpgrading ? (
        <>
          <LoadingSkeleton variant="button" size="sm" className="text-white" />
          Upgrading...
        </>
      ) : children ? (
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

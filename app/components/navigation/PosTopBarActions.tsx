"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { ShoppingCart } from "@/app/components/ui/icons"
import { PosSellerSelector } from "@/app/pos/components/PosSellerSelector"

type SellerState = {
  userId: string
  name: string
}

export function PosTopBarActions() {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const { t } = useLocalization()
  const [cartQty, setCartQty] = useState(0)
  const [seller, setSeller] = useState<SellerState | null>(null)
  const selectSeller = useCallback((nextSeller: SellerState) => {
    setSeller(nextSeller)
    window.dispatchEvent(
      new CustomEvent("pos:seller-change", { detail: nextSeller }),
    )
  }, [])

  useEffect(() => {
    if (!seller && user?.id) {
      setSeller({
        userId: user.id,
        name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email ||
          "Current user",
      })
    }
  }, [seller, user])

  useEffect(() => {
    const handleCartUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ qty?: number }>).detail
      setCartQty(Number(detail?.qty) || 0)
    }
    const handleSellerState = (event: Event) => {
      const detail = (event as CustomEvent<SellerState>).detail
      if (detail?.userId) setSeller(detail)
    }
    window.addEventListener("pos:cart-updated", handleCartUpdate)
    window.addEventListener("pos:seller-state", handleSellerState)
    return () => {
      window.removeEventListener("pos:cart-updated", handleCartUpdate)
      window.removeEventListener("pos:seller-state", handleSellerState)
    }
  }, [])

  if (!currentSite) return null

  return (
    <div className="flex items-center gap-2">
      <PosSellerSelector
        siteId={currentSite.id}
        user={user}
        value={seller?.userId || user?.id || null}
        onSellerChange={selectSeller}
      />
      <Button
        variant="default"
        size="default"
        className="hidden sm:flex items-center justify-center gap-2 overflow-visible transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("pos:send-order"))
        }
        title={t("layout.topbar.sendOrder") || "Send Order"}
      >
        <div className="relative overflow-visible">
          <ShoppingCart className="h-4 w-4 shrink-0" />
          {cartQty > 0 ? (
            <span className="absolute -right-2 -top-1 z-20 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-1 ring-background">
              {cartQty > 99 ? "99+" : cartQty}
            </span>
          ) : null}
        </div>
        <span className="hidden text-sm font-medium sm:inline">
          {t("layout.topbar.sendOrder") || "Send Order"}
        </span>
      </Button>
    </div>
  )
}

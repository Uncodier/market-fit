"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { ShoppingCart } from "@/app/components/ui/icons"
import { PosSellerSelector } from "@/app/pos/components/PosSellerSelector"
import { OrderUpdatesBadge } from "./OrderUpdatesBadge"

type SellerState = {
  userId: string
  name: string
}

export function PosTopBarActions() {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const { t } = useLocalization()
  const [pendingSendQty, setPendingSendQty] = useState(0)
  const [seller, setSeller] = useState<SellerState | null>(null)
  const sendButtonContainerRef = useRef<HTMLDivElement>(null)
  const sendIconRef = useRef<HTMLSpanElement>(null)
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
      const detail = (
        event as CustomEvent<{ qty?: number; deltaQty?: number }>
      ).detail
      setPendingSendQty(Number(detail?.deltaQty ?? detail?.qty) || 0)
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
      <div
        ref={sendButtonContainerRef}
        className="relative hidden overflow-visible sm:block"
      >
        <Button
          variant="default"
          size="default"
          className="!flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("pos:send-order"))
          }
          title={t("layout.topbar.sendOrder") || "Send Order"}
        >
          <span
            ref={sendIconRef}
            className="flex h-6 w-6 shrink-0 items-center justify-center"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
          </span>
          <span className="text-sm font-medium">
            {t("layout.topbar.sendOrder") || "Send Order"}
          </span>
        </Button>
        <OrderUpdatesBadge
          count={pendingSendQty}
          anchorRef={sendIconRef}
          containerRef={sendButtonContainerRef}
        />
      </div>
    </div>
  )
}

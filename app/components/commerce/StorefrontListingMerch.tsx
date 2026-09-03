import type { ReactNode } from "react"
import type { CatalogItem } from "@/app/types"
import { BuyerAvatarStack } from "@/app/components/commerce/BuyerAvatarStack"
import {
  getInventoryDisplayRule,
  type StorefrontShopFields,
} from "@/app/commerce/storefront-display-helpers"

export function StorefrontListingMerch({
  item,
  shop,
  showSeller = false,
  t,
  tone = "default",
}: {
  item: CatalogItem
  shop?: StorefrontShopFields
  showSeller?: boolean
  t: (key: string, vars?: Record<string, unknown>) => string
  tone?: "default" | "onDark"
}) {
  const fields = shop || {}
  const rule = getInventoryDisplayRule(item, fields, showSeller)
  const hasBuyers = Boolean(item.metadata?.show_buyers && fields.buyers?.length)

  let inventoryLine: ReactNode = null
  if (rule.type === "spots_left") {
    inventoryLine = (
      <span className={tone === "onDark"
        ? `inline-block rounded-md px-2 py-0.5 text-xs font-medium ${rule.isUrgent ? "bg-red-500/20 text-red-100" : "bg-white/10 text-white/90"}`
        : `text-xs font-medium ${rule.isUrgent ? "text-destructive" : "text-muted-foreground"}`}>
        {t("shop.spotsLeft", { count: rule.count }) || `${rule.count} spots left`}
      </span>
    )
  } else if (rule.type === "only_left") {
    inventoryLine = (
      <span className={tone === "onDark"
        ? `inline-block rounded-md px-2 py-0.5 text-xs font-medium ${rule.isUrgent ? "bg-red-500/20 text-red-100" : "bg-white/10 text-white/90"}`
        : `text-xs font-medium ${rule.isUrgent ? "text-destructive" : "text-muted-foreground"}`}>
        {t("shop.onlyLeft", { count: rule.count }) || `Only ${rule.count} left`}
      </span>
    )
  }

  if (!inventoryLine && !hasBuyers) return null

  return (
    <div className="mt-2 flex items-center gap-2">
      {hasBuyers && (
        <BuyerAvatarStack
          buyers={fields.buyers!}
          totalCount={fields.buyerCount}
          size="sm"
        />
      )}
      {inventoryLine}
    </div>
  )
}

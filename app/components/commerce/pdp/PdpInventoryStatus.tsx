"use client"

import type { ReactNode } from "react"
import type { CatalogItem } from "@/app/types"
import { BuyerAvatarStack } from "@/app/components/commerce/BuyerAvatarStack"
import {
  getInventoryDisplayRule,
  type StorefrontShopFields,
} from "@/app/commerce/storefront-display-helpers"
import { useLocalization } from "@/app/context/LocalizationContext"

export function PdpInventoryStatus({
  item,
}: {
  item: CatalogItem & { _shop?: StorefrontShopFields }
}) {
  const { t } = useLocalization()
  const shop = item._shop || {}
  const meta = item.metadata || {}
  const rule = getInventoryDisplayRule(item, shop)

  let inventoryLine: ReactNode = null
  if (rule.type === "spots_left") {
    inventoryLine = (
      <span
        className={`w-fit inline-flex items-center text-sm ${
          rule.isUrgent
            ? "font-semibold text-destructive"
            : "font-medium text-muted-foreground"
        }`}
      >
        {rule.count} {t("pdp.spotsLeftNextSlot") || "spots left in the next slot"}
      </span>
    )
  } else if (rule.type === "only_left") {
    inventoryLine = (
      <span
        className={`w-fit inline-flex items-center text-sm ${
          rule.isUrgent
            ? "font-semibold text-destructive"
            : "font-medium text-muted-foreground"
        }`}
      >
        {t("pdp.onlyUnitsLeft") || "Only"} {rule.count}{" "}
        {t("pdp.unitsLeftInStock") || "units left in stock"}
      </span>
    )
  }

  const buyers = shop.buyers || []
  const hasBuyers = meta.show_buyers && buyers.length > 0
  if (!inventoryLine && !hasBuyers) return null

  return (
    <div className="flex flex-col gap-2 mb-4">
      {inventoryLine}
      {hasBuyers && (
        <div className="flex items-center gap-2">
          <BuyerAvatarStack
            buyers={buyers}
            size="md"
            totalCount={shop.buyerCount}
          />
          <span className="text-sm font-medium text-muted-foreground">
            {shop.buyerCount} {t("pdp.boughtThis") || "bought this"}
          </span>
        </div>
      )}
    </div>
  )
}

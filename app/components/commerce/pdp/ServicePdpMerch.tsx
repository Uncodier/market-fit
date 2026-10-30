import type { CatalogItem } from "@/app/types"
import { BuyerAvatarStack } from "@/app/components/commerce/BuyerAvatarStack"
import { getInventoryDisplayRule } from "@/app/commerce/storefront-display-helpers"

export function ServicePdpMerch({
  item,
  t,
}: {
  item: CatalogItem
  t: (key: string) => string
}) {
  const shop = item._shop || {}
  const rule = getInventoryDisplayRule(item, shop)
  const hasBuyers = Boolean(item.metadata?.show_buyers && shop.buyers?.length)

  let inventoryLine: React.ReactNode = null
  if (rule.type === "spots_left") {
    inventoryLine = (
      <span className={`w-fit inline-flex items-center text-sm ${rule.isUrgent ? "font-semibold text-destructive" : "font-medium text-muted-foreground"}`}>
        {rule.count} {t("pdp.spotsLeftNextSlot") || "spots left in the next slot"}
      </span>
    )
  } else if (rule.type === "only_left") {
    inventoryLine = (
      <span className={`w-fit inline-flex items-center text-sm ${rule.isUrgent ? "font-semibold text-destructive" : "font-medium text-muted-foreground"}`}>
        {t("pdp.onlyUnitsLeft") || "Only"} {rule.count}{" "}
        {t("pdp.spotsLeft") || "spots left"}
      </span>
    )
  }

  if (!inventoryLine && !hasBuyers) return null

  return (
    <div className="flex flex-col gap-2 mb-2">
      {inventoryLine}
      {hasBuyers && (
        <div className="flex items-center gap-2">
          <BuyerAvatarStack buyers={shop.buyers || []} size="md" totalCount={shop.buyerCount} />
          <span className="text-sm font-medium text-muted-foreground">
            {shop.buyerCount}{" "}
            {item.is_reservation
              ? t("pdp.going") || "going"
              : t("pdp.boughtThis") || "bought this"}
          </span>
        </div>
      )}
    </div>
  )
}

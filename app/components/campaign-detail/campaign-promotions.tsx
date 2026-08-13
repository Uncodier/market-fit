"use client"

import useSWR from "swr"
import Link from "next/link"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { useSite } from "@/app/context/SiteContext"
import { listPromotions } from "@/app/promotions/actions"
import { listPromotionRedemptions } from "@/app/promotions/list-redemptions"
import { formatPromotionDiscountLabel } from "@/app/promotions/bogo-discount"
import {
  displayPromotionUsageCount,
  type PromotionRedemption,
} from "@/app/promotions/redemption-map"
import { PromotionRedemptionsTable } from "@/app/promotions/components/PromotionRedemptionsTable"
import type { PromotionWithCampaign } from "@/app/promotions/types"

function usageLabel(promo: PromotionWithCampaign, redemptions: PromotionRedemption[]) {
  const listed = redemptions.filter((row) => row.promotionId === promo.id).length
  const count = displayPromotionUsageCount(promo.usage_count, listed)
  if (promo.usage_limit) return `${count} / ${promo.usage_limit} uses`
  return `${count} uses`
}

export function CampaignPromotions({ campaignId }: { campaignId: string }) {
  const { currentSite } = useSite()

  const { data: promotionsData, isLoading: loadingPromotions } = useSWR(
    currentSite?.id ? ["campaign_promotions", campaignId, currentSite.id] : null,
    () => listPromotions({ siteId: currentSite!.id, campaignId, pageSize: 50 })
  )

  const { data: redemptionsData, isLoading: loadingRedemptions } = useSWR(
    currentSite?.id ? ["campaign_promotion_redemptions", campaignId, currentSite.id] : null,
    () => listPromotionRedemptions({ siteId: currentSite!.id, campaignId, pageSize: 50 })
  )

  const promotions = promotionsData?.data || []
  const redemptions = redemptionsData?.data || []

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium">Promotions</h3>
          <Link href="/promotions">
            <Button variant="ghost" size="sm" className="h-8">
              Manage Promotions
            </Button>
          </Link>
        </div>

        {loadingPromotions ? (
          <p className="text-sm text-muted-foreground py-3">Loading promotions...</p>
        ) : promotions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">No promotions linked to this campaign yet.</p>
        ) : (
          promotions.map((promo) => (
            <Link
              key={promo.id}
              href={`/promotions/${promo.id}`}
              className="flex items-center justify-between py-3 border-b border-border/40 last:border-0 hover:bg-muted/40 -mx-1 px-1 rounded-md"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{promo.name}</p>
                {promo.code && (
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{promo.code}</p>
                )}
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-sm">{formatPromotionDiscountLabel(promo)}</p>
                <p className="text-xs text-muted-foreground">{usageLabel(promo, redemptions)}</p>
                <Badge variant="outline" className="mt-1 text-[10px] uppercase font-normal">
                  {promo.status}
                </Badge>
              </div>
            </Link>
          ))
        )}
      </section>

      {promotions.length > 0 && (
        <section>
          <h3 className="text-sm font-medium mb-1">
            Redemptions
            {typeof redemptionsData?.count === "number" && redemptionsData.count > 0
              ? ` (${redemptionsData.count})`
              : ""}
          </h3>
          <PromotionRedemptionsTable
            redemptions={redemptions}
            loading={loadingRedemptions}
            emptyLabel="No coupon redemptions yet."
            loadingLabel="Loading redemptions..."
            labels={{
              order: "Order",
              customer: "Customer",
              discount: "Discount",
              total: "Total",
              date: "Date",
              unknownCustomer: "Unknown customer",
            }}
          />
        </section>
      )}
    </div>
  )
}

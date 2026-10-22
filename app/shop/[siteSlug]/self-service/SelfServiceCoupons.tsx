"use client"

import Link from "next/link"
import { Tag } from "@/app/components/ui/icons"
import { PromptImage } from "@/app/components/commerce/PromptImage"
import { resolvePromotionImage } from "@/app/lib/image-utils"
import { promoBadgeLabel, type StorefrontPromoCard } from "@/app/promotions/promotion-merchandising"

/** Every coupon action stays in the location flow; normal Shop quick-apply uses a different cart. */
export function SelfServiceCoupons({ promos, locationId }: { promos: StorefrontPromoCard[]; locationId: string }) {
  if (!promos.length) return null
  return <section aria-label="Coupons" className="mx-auto w-full max-w-7xl px-4 pb-3 md:px-8">
    <h2 className="mb-4 text-2xl font-bold">Offers</h2>
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
      {promos.map((promo) => <Link key={promo.id} href={`/shop/${locationId}/promo/${promo.id}`} className="w-64 shrink-0 snap-start overflow-hidden rounded-2xl border bg-white">
        <PromptImage src={resolvePromotionImage(promo, "hero")} alt="" className="aspect-[16/9] w-full object-cover" />
        <div className="space-y-2 p-4"><span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><Tag className="h-4 w-4" />{promoBadgeLabel(promo)}</span>
          <h3 className="font-bold">{promo.name}</h3><p className="text-sm text-gray-500">View offer and choose items</p></div>
      </Link>)}
    </div>
  </section>
}
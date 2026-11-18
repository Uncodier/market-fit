"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Pause, Play, Tag } from "@/app/components/ui/icons"
import { PromptImage } from "@/app/components/commerce/PromptImage"
import { resolvePromotionImage } from "@/app/lib/image-utils"
import { promoBadgeLabel, type StorefrontPromoCard } from "@/app/promotions/promotion-merchandising"
import { useLocalization } from "@/app/context/LocalizationContext"

/** Every coupon action stays in the location flow; normal Shop quick-apply uses a different cart. */
export function SelfServiceCoupons({ promos, locationId }: { promos: StorefrontPromoCard[]; locationId: string }) {
  const { t } = useLocalization()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const activeIndex = index % Math.max(1, promos.length)

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    if (promos.length < 2 || paused || interacting || reducedMotion) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % promos.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [promos.length, paused, interacting, reducedMotion])

  if (!promos.length) return null
  return <section aria-label={t("shop.selfService.offers.title")} aria-roledescription={t("shop.selfService.offers.carousel")} className="mx-auto w-full max-w-7xl px-4 md:px-8"
    onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
    onFocusCapture={() => setInteracting(true)} onBlurCapture={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false)
    }}>
    <div className="overflow-hidden rounded-2xl border bg-gray-50 dark:bg-gray-900">
      <div className="flex transition-transform duration-700 ease-in-out motion-reduce:transition-none" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
        {promos.map((promo, slideIndex) => <div key={promo.id} role="group" aria-roledescription={t("shop.selfService.offers.slide")} aria-label={t("shop.selfService.offers.position", { current: slideIndex + 1, total: promos.length })}
          aria-hidden={slideIndex !== activeIndex} inert={slideIndex !== activeIndex} className="w-full min-w-0 shrink-0">
          <Link href={`/shop/${locationId}/promo/${promo.id}`} className="grid min-h-64 grid-cols-2 items-center md:min-h-72">
            <div className="space-y-3 p-5 md:p-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400"><Tag className="h-4 w-4 shrink-0" />{promoBadgeLabel(promo, t)}</span>
              <h2 className="line-clamp-3 text-xl font-bold md:text-4xl">{promo.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("shop.selfService.offers.view")}</p>
            </div>
            <PromptImage src={resolvePromotionImage(promo, "hero")} alt="" className="h-64 w-full object-cover md:h-72" />
          </Link>
        </div>)}
      </div>
    </div>
    {promos.length > 1 && <div className="flex items-center justify-center gap-3 py-3">
      <button type="button" aria-label={t("shop.selfService.offers.previous")} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted" onClick={() => setIndex((activeIndex + promos.length - 1) % promos.length)}><ChevronLeft className="h-4 w-4" /></button>
      {promos.map((promo, slideIndex) => <button key={promo.id} type="button" aria-label={t("shop.selfService.offers.show", { number: slideIndex + 1 })} aria-current={slideIndex === activeIndex ? "true" : undefined}
        className="flex h-9 w-6 items-center justify-center" onClick={() => setIndex(slideIndex)}>
        <span className={`h-2 rounded-full transition-all motion-reduce:transition-none ${slideIndex === activeIndex ? "w-6 bg-gray-900 dark:bg-white" : "w-2 bg-gray-300 dark:bg-gray-600"}`} />
      </button>)}
      <button type="button" aria-label={t("shop.selfService.offers.next")} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted" onClick={() => setIndex((activeIndex + 1) % promos.length)}><ChevronRight className="h-4 w-4" /></button>
      {!reducedMotion && <button type="button" aria-label={paused ? t("shop.selfService.offers.play") : t("shop.selfService.offers.pause")} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted" onClick={() => setPaused(!paused)}>
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </button>}
    </div>}
  </section>
}
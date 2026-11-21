"use client"

import Link from "next/link"
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"
import { Button } from "@/app/components/ui/button"
import { ChevronLeft, ChevronRight, Pause, Play, Tag } from "@/app/components/ui/icons"
import { PromptImage } from "@/app/components/commerce/PromptImage"
import { usePromptImageDelivery } from "@/app/components/commerce/PublicImageDelivery"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolvePromotionImage } from "@/app/lib/image-utils"
import { promoBadgeLabel, type StorefrontPromoCard } from "@/app/promotions/promotion-merchandising"
import { ShopHeroSlide, shopHeroCtaClass, shopHeroFrameClass, shopHeroImageClass, shopHeroTitleClass } from "../ShopHeroSlide"
import { ShopHeroTrust, type ShopHeroSite } from "../ShopHeroTrust"

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"
const controlClass = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"

function subscribeToReducedMotion(onChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

export function SelfServiceHero({ site, locationId, searchQuery, promos }: {
  site: ShopHeroSite
  locationId: string
  searchQuery: string
  promos: StorefrontPromoCard[]
}) {
  return (
    <ShopHeroTrust site={site} searchQuery={searchQuery} allowExternalCta={false}
      renderHero={promos.length ? (shopSlide) => <HeroCarousel shopSlide={shopSlide} promos={promos} locationId={locationId} /> : undefined} />
  )
}

function OfferSlide({ promo, locationId, active }: { promo: StorefrontPromoCard; locationId: string; active: boolean }) {
  const { t } = useLocalization()
  const delivery = usePromptImageDelivery()
  const title = promo.name || t("shop.promo.offerBadge")
  const label = t("shop.promo.viewOffer")
  return (
    <ShopHeroSlide background={
      <PromptImage src={resolvePromotionImage(promo, "full", delivery)} alt="" loading={active ? "eager" : "lazy"}
        decoding="async" className={shopHeroImageClass} />
    }>
      <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold">
        <Tag className="h-4 w-4 shrink-0" aria-hidden />{promoBadgeLabel(promo, t)}
      </span>
      <h2 className={`${shopHeroTitleClass} line-clamp-3 break-words`}>{title}</h2>
      <Button asChild className={shopHeroCtaClass} data-permission="allow">
        <Link href={`/shop/${locationId}/promo/${promo.id}`} prefetch={false} aria-label={`${label}: ${title}`}>{label}</Link>
      </Button>
    </ShopHeroSlide>
  )
}

function HeroCarousel({ shopSlide, promos, locationId }: { shopSlide: ReactNode; promos: StorefrontPromoCard[]; locationId: string }) {
  const { t } = useLocalization()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const reducedMotion = useSyncExternalStore(subscribeToReducedMotion, () => window.matchMedia(reducedMotionQuery).matches, () => false)
  const slides = [...(shopSlide ? [{ key: "shop", promo: null }] : []), ...promos.map((promo) => ({ key: `offer-${promo.id}`, promo }))]
  const count = slides.length
  const activeIndex = index % count
  const rotating = count > 1 && !paused && !hovered && !focused && !reducedMotion

  useEffect(() => {
    if (!rotating) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % count)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [count, rotating])

  function move(offset: number) {
    setIndex((current) => (current + count + offset) % count)
  }

  return (
    <section aria-label={t("shop.selfService.hero.title")} aria-roledescription={count > 1 ? t("shop.selfService.hero.carousel") : undefined}
      className={shopHeroFrameClass} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}>
      {count > 1 && (
        <div className="absolute inset-x-4 bottom-3 z-20 flex justify-center md:bottom-4">
          <div className="flex max-w-full items-center rounded-full bg-black/70 text-white">
            {!reducedMotion && (
              <button type="button" aria-label={t(paused ? "shop.selfService.hero.play" : "shop.selfService.hero.pause")}
                className={controlClass} onClick={() => setPaused((value) => !value)}>
                {paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
              </button>
            )}
            <button type="button" aria-label={t("shop.selfService.hero.previous")} className={controlClass} onClick={() => move(-1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <div className="flex min-w-0 overflow-x-auto">
              {slides.map(({ key }, slideIndex) => (
                <button key={key} type="button" aria-label={t("shop.selfService.hero.show", { number: slideIndex + 1 })}
                  aria-current={slideIndex === activeIndex ? "true" : undefined} className={`${controlClass} !w-6`} onClick={() => setIndex(slideIndex)}>
                  <span className={`h-2 rounded-full ${slideIndex === activeIndex ? "w-4 bg-white" : "w-2 bg-white/50"}`} />
                </button>
              ))}
            </div>
            <button type="button" aria-label={t("shop.selfService.hero.next")} className={controlClass} onClick={() => move(1)}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
      <div aria-live={rotating ? "off" : "polite"} className="flex h-full transition-transform duration-700 ease-in-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
        {slides.map(({ key, promo }, slideIndex) => {
          const active = slideIndex === activeIndex
          return (
            <div key={key} role="group" aria-roledescription={t("shop.selfService.hero.slide")}
              aria-label={t("shop.selfService.hero.position", { current: slideIndex + 1, total: count })}
              aria-hidden={!active} inert={!active} className="h-full w-full min-w-0 shrink-0">
              {promo ? <OfferSlide promo={promo} locationId={locationId} active={active} /> : shopSlide}
            </div>
          )
        })}
      </div>
    </section>
  )
}
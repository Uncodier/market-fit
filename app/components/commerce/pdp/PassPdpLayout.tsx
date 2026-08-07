"use client"

import { useState, useEffect } from "react"
import { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { resolveItemSpecDisplay, resolveVenueLocation } from "@/app/catalog/product-details"
import { VenueLocationSection } from "./VenueLocationSection"
import { CheckCircle, MapPin, ChevronLeft, User } from "@/app/components/ui/icons"
import Link from "next/link"
import { usePdpCart } from "./usePdpCart"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { resolveBookableAccess } from "@/app/buyer/entitlement-queries"

import { PdpCtaButton } from "./PdpCtaButton"
import { PdpPriceBlock } from "./PdpPriceBlock"
import { PdpMetricChips } from "./PdpMetricChips"
import { PdpMobileBuyBar } from "./PdpMobileBuyBar"
import { PdpExperience } from "./pdp-experience"
import { PassBookingPanel } from "./PassBookingPanel"
import { SubscriptionManagePanel } from "./SubscriptionManagePanel"

export function PassPdpLayout({ item, backUrl, experience }: { item: CatalogItem & { _shop?: any }, backUrl: string, experience?: PdpExperience }) {
  const { t } = useLocalization()
  const router = useRouter()
  const { addToCartStorage, startBuyNow } = usePdpCart(item.site_id)
  
  const [ownedEntitlement, setOwnedEntitlement] = useState<any>(null)
  const [canBook, setCanBook] = useState(false)
  const [loadingOwned, setLoadingOwned] = useState(true)

  const isEntitlementExperience = experience?.kind === "entitlement" && !!experience.entitlement

  useEffect(() => {
    if (isEntitlementExperience) {
      setOwnedEntitlement(experience!.entitlement)
      setCanBook(true)
      setLoadingOwned(false)
      return
    }
    async function checkOwnership() {
      try {
        const { entitlement, canBook: bookable } = await resolveBookableAccess(item.id, item.is_reservation || false)
        setOwnedEntitlement(entitlement)
        setCanBook(bookable)
      } catch (e) {
        // user probably not logged in
      }
      setLoadingOwned(false)
    }
    checkOwnership()
  }, [item.id, item.is_reservation, isEntitlementExperience, experience])

  const metadata = item.metadata || {}
  const attributes = metadata.attributes || {}
  const isRecurring = item.is_recurring
  const imageUrl = resolveItemImage(item)

  const venueLocation = resolveVenueLocation(item)
  const organizer = resolveItemSpecDisplay(item, 'instructor') || resolveItemSpecDisplay(item, 'organizer') || resolveItemSpecDisplay(item, 'host')

  const handleAdd = () => {
    addToCartStorage(item)
    toast.success(`${item.name} ${t('marketplace.addedToCart') || 'added to cart'}`)
  }

  const handleBuyNow = () => {
    startBuyNow(item, 1, backUrl)
  }

  if (isEntitlementExperience) {
    return (
      <div className="pb-16 max-w-7xl mx-auto w-full px-4 md:px-8 mt-12 md:mt-16 space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-2">
            {item.name}
          </h1>
          <div className="text-muted-foreground font-medium flex items-center gap-4">
            <Link
              href={experience!.backUrl || backUrl}
              className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-full hover:bg-muted -ml-2"
            >
              <ChevronLeft className="w-3 h-3 mr-1" />
              {t("buyer.reservations.back") || t("common.back") || "Back"}
            </Link>
            <div>
              {isRecurring
                ? t("pdp.subscriptionBadge") || "Subscription"
                : t("pdp.accessPassBadge") || "Access Pass"}
            </div>
          </div>
        </div>

        <PassBookingPanel
          entitlement={experience!.entitlement}
          services={experience!.extras?.services || []}
          initialServiceId={experience!.extras?.initialServiceId}
          backUrl={experience!.backUrl || backUrl}
        />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 lg:py-12 pb-32 lg:pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-16">
        
        {/* Mobile: Buy Card goes first, Desktop: Buy Card is right column */}
        <div className="lg:col-span-1 lg:order-last">
          <div className="lg:sticky lg:top-32 bg-card border border-border/50 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-black/5 relative">
            
            {!ownedEntitlement ? (
              <div className="mb-8">
                <PdpPriceBlock 
                  price={item.target_sale_price || 0}
                  currency={item.currency || 'USD'}
                  isRecurring={isRecurring}
                  validityDays={item.pass_validity_days}
                />
              </div>
            ) : (
              <div className="mb-8 overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-b from-primary/5 to-transparent text-center relative">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0" />
                <div className="p-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-6 shadow-xl shadow-primary/20 ring-8 ring-primary/5">
                    <CheckCircle className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight mb-2">
                    {t('pdp.youOwnThisPass') || 'You own this pass'}
                  </h3>
                  {ownedEntitlement.uses_remaining !== null ? (
                    <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-background border shadow-sm text-foreground rounded-full text-sm font-semibold mt-2">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      {ownedEntitlement.uses_remaining} {t('buyer.library.usesRemaining') || 'uses remaining'}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground font-medium mt-2">
                      {t('pdp.activeSubscription') || 'Active and ready to use'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Hidden on mobile if bottom bar is shown, but for simplicity let's keep it here 
                and just hide the sticky card's CTA on mobile if we use the bottom bar.
                Actually, simpler to show it on both so users don't have to scroll to bottom. */}
            <div className="hidden lg:block">
              {ownedEntitlement ? (
                canBook ? (
                  <PdpCtaButton onClick={() => router.push(`/buyer/book/${ownedEntitlement.id}`)}>
                    {t('buyer.library.actions.book') || 'Book'}
                  </PdpCtaButton>
                ) : null
              ) : (
                <div className="space-y-3">
                  <PdpCtaButton 
                    onClick={handleBuyNow}
                    disabled={item._shop?.sellable === false || loadingOwned}
                  >
                    {item._shop?.sellable === false ? (t('pdp.soldOut') || 'Sold Out') : (isRecurring ? (t('pdp.subscribe') || 'Subscribe Now') : (t('pdp.payNow') || 'Buy Now'))}
                  </PdpCtaButton>
                  <PdpCtaButton 
                    variant="outline"
                    onClick={handleAdd}
                    disabled={item._shop?.sellable === false || loadingOwned}
                  >
                    {t('marketplace.add') || 'Add to Cart'}
                  </PdpCtaButton>
                </div>
              )}
              <div className="mt-6 text-center text-xs text-muted-foreground font-medium flex items-center justify-center gap-2">
                <span>{t('pdp.secureCheckout') || 'Secure checkout'}</span>
                <span>•</span>
                <span>{t('pdp.instantAccess') || 'Instant access'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details & Benefits */}
        <div className="lg:col-span-2 space-y-8 lg:space-y-10">
          <div className="aspect-[16/10] sm:aspect-[21/9] rounded-[2rem] overflow-hidden shadow-sm bg-muted relative">
            {imageUrl ? (
              <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-secondary/50" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-6 left-6 sm:left-8 pr-6 text-white">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider mb-3">
                {isRecurring ? (t('pdp.subscriptionBadge') || 'Subscription') : (t('pdp.accessPassBadge') || 'Access Pass')}
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight drop-shadow-sm leading-tight">{item.name}</h1>
            </div>
          </div>

          <PdpMetricChips 
            chips={[
              organizer ? { label: organizer.name, icon: <User className="w-4 h-4" /> } : null,
              item.pass_uses ? { label: `${item.pass_uses} ${t('pdp.usesIncluded') || 'uses included'}` } : null,
              item.pass_validity_days ? { label: `${item.pass_validity_days} ${t('pdp.validDays') || 'days valid'}` } : null,
              venueLocation.name ? { label: venueLocation.name, icon: <MapPin className="w-4 h-4" /> } : null,
              venueLocation.city ? { label: venueLocation.city } : null
            ]}
          />

          <div className="prose prose-base sm:prose-lg dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
            <p className="whitespace-pre-wrap">{item.description || 'Access all benefits and premium services.'}</p>
          </div>

          {(item.pass_uses || venueLocation.name) && (
            <div className="pt-8 border-t">
              <h3 className="text-2xl font-bold mb-6">{t('pdp.whatsIncluded') || "What's Included"}</h3>
              <div className="flex flex-col gap-4 sm:gap-6">
                {item.pass_uses && (
                  <div className="flex w-full gap-4 p-4 sm:p-5 rounded-2xl bg-muted/30 border">
                    <div className="mt-0.5">
                      <CheckCircle className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-bold text-base sm:text-lg mb-1">{item.pass_uses} {t('pdp.usesIncluded') || 'Uses Included'}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">Access limited to the specified number of uses.</div>
                    </div>
                  </div>
                )}
                {venueLocation.name && (
                  <div className="w-full p-4 sm:p-5 rounded-2xl bg-muted/30 border">
                    <VenueLocationSection
                      name={venueLocation.name}
                      address={venueLocation.address}
                      city={venueLocation.city}
                      eyebrow={t("pdp.validAt") || "Valid at"}
                      compact
                      leading={
                        venueLocation.image_url ? (
                          <img
                            src={venueLocation.image_url}
                            alt={venueLocation.name}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <MapPin className="w-6 h-6 text-primary" />
                          </div>
                        )
                      }
                    />
                  </div>
                )}
                {organizer && (
                  <div className="flex w-full gap-4 p-4 sm:p-5 rounded-2xl bg-muted/30 border">
                    {organizer.image_url ? (
                      <img
                        src={organizer.image_url}
                        alt={organizer.name}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-xl font-bold text-primary">
                        {organizer.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">
                        {t("buyer.reservations.instructor") || "Instructor"}
                      </div>
                      <div className="font-bold text-base sm:text-lg text-foreground leading-tight truncate">
                        {organizer.name}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {experience?.kind === 'subscription' && experience.subscription && (
            <div className="pt-8 lg:pt-10 border-t mt-8 lg:mt-10">
              <SubscriptionManagePanel subscription={experience.subscription} />
            </div>
          )}
        </div>
      </div>

      {!ownedEntitlement && (
        <PdpMobileBuyBar 
          price={item.target_sale_price || 0}
          isRecurring={isRecurring}
          validityDays={item.pass_validity_days}
        >
          <div className="flex gap-2 w-full min-w-0">
            <PdpCtaButton 
              variant="outline"
              onClick={handleAdd}
              disabled={item._shop?.sellable === false || loadingOwned}
              className="flex-1 min-w-0 px-3"
            >
              <span className="truncate">{t('common.add') || 'Add'}</span>
            </PdpCtaButton>
            <PdpCtaButton 
              onClick={handleBuyNow}
              disabled={item._shop?.sellable === false || loadingOwned}
              className="flex-1 min-w-0 px-3"
            >
              <span className="truncate">
                {item._shop?.sellable === false
                  ? (t('pdp.soldOut') || 'Sold Out')
                  : (isRecurring
                    ? (t('marketplace.listing.cta.subscribe') || t('pdp.subscribe') || 'Subscribe')
                    : (t('pdp.payNow') || 'Buy Now'))}
              </span>
            </PdpCtaButton>
          </div>
        </PdpMobileBuyBar>
      )}

      {ownedEntitlement && canBook && (
        <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden p-4 pb-safe bg-background/80 backdrop-blur-xl border-t">
          <PdpCtaButton onClick={() => router.push(`/buyer/book/${ownedEntitlement.id}`)}>
            {t('buyer.library.actions.book') || 'Book'}
          </PdpCtaButton>
        </div>
      )}
    </div>
  )
}
"use client"

import { useState, useEffect, useMemo } from "react"
import { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { resolveItemSpecDisplay, resolveVenueLocation } from "@/app/catalog/product-details"
import { VenueLocationDetails } from "./VenueLocationDetails"
import { VenueLocationSection } from "./VenueLocationSection"
import { MapPin, User, Clock, CheckCircle, Calendar, ChevronLeft } from "@/app/components/ui/icons"
import { usePdpCart } from "./usePdpCart"
import { toast } from "sonner"
import Link from "next/link"
import { isAccessOnlyItem } from "@/app/catalog/product-details"
import { getActivePassEntitlementForReservable } from "@/app/buyer/entitlement-queries"

import { PdpCtaButton } from "./PdpCtaButton"
import { PdpPriceBlock } from "./PdpPriceBlock"
import { PdpMetricChips } from "./PdpMetricChips"
import { PdpMobileBuyBar } from "./PdpMobileBuyBar"
import { VariantPicker } from "./VariantPicker"
import { usePathname, useRouter } from "next/navigation"
import { PdpExperience } from "./pdp-experience"
import { ReservationManagePanel } from "./ReservationManagePanel"
import { SubscriptionManagePanel } from "./SubscriptionManagePanel"
import { DynamicQuotePdpProvider } from "./DynamicQuotePdpPanel"
import { ServiceDynamicQuoteLayout } from "./ServiceDynamicQuoteLayout"
import {
  getDynamicPricingConfig,
  isDynamicPricedItem,
} from "@/app/catalog/dynamic-pricing"

export function ServicePdpLayout({
  item,
  backUrl,
  experience,
}: {
  item: CatalogItem & { _shop?: any }
  backUrl: string
  experience?: PdpExperience
}) {
  const { t } = useLocalization()
  const { addToCartStorage, startBuyNow } = usePdpCart(item.site_id)
  const pathname = usePathname()
  const router = useRouter()

  const [ownedEntitlement, setOwnedEntitlement] = useState<any>(null)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})

  const isReservationExperience = experience?.kind === "reservation" && !!experience.reservation
  const reservation = experience?.reservation

  const metadata = item.metadata || {}
  const attributes = metadata.attributes || {}
  const instructor = resolveItemSpecDisplay(item, "instructor") || resolveItemSpecDisplay(item, "host")
  const venueLocation = resolveVenueLocation(item)
  const axes = metadata.variant_axes || []
  const hasVariants = axes.length > 0
  const children = item._shop?.children || []

  const resolvedChild = useMemo(() => {
    if (!hasVariants) return item
    if (Object.keys(selectedOptions).length !== axes.length) return null
    return (
      children.find((c: CatalogItem) => {
        const childOpts = c.metadata?.option_values
        if (!childOpts) return false
        return Object.entries(selectedOptions).every(([aId, vId]) => childOpts[aId] === vId)
      }) || null
    )
  }, [selectedOptions, hasVariants, axes.length, children, item])

  const activeItem = resolvedChild || item
  const isSelectionComplete = !hasVariants || !!resolvedChild
  const isDynamic = isDynamicPricedItem(item)
  const dynamicConfig = isDynamic ? getDynamicPricingConfig(item) : null
  const displayPrice = isDynamic
    ? (dynamicConfig?.min_price ?? item.lowest_sale_price ?? 0)
    : (activeItem.target_sale_price || item.target_sale_price || 0)

  useEffect(() => {
    if (isReservationExperience) return
    async function checkOwnership() {
      try {
        const ent = await getActivePassEntitlementForReservable(item.id)
        setOwnedEntitlement(ent)
      } catch {
        // user probably not logged in
      }
    }
    if (item.is_reservation && !isAccessOnlyItem(item)) {
      checkOwnership()
    }
  }, [item.id, item.is_reservation, item, isReservationExperience])

  const handleBook = () => {
    if (hasVariants && !resolvedChild) {
      toast.error(t("pdp.selectOptions") || "Please select all options")
      return
    }
    router.push(`${pathname}/book`)
  }

  const handleAdd = () => {
    if (hasVariants && !resolvedChild) {
      toast.error(t("pdp.selectOptions") || "Please select all options")
      return
    }
    addToCartStorage(activeItem)
    toast.success(`${activeItem.name} ${t("marketplace.addedToCart") || "added to cart"}`)
  }

  const handleBuyNow = () => {
    if (hasVariants && !resolvedChild) {
      toast.error(t("pdp.selectOptions") || "Please select all options")
      return
    }
    startBuyNow(activeItem, 1, backUrl)
  }

  const isDropIn = item.is_reservation && !isAccessOnlyItem(item)
  const isSellable = isSelectionComplete && item._shop?.sellable !== false

  const passImageUrl =
    isReservationExperience && (
      reservation?.entitlement?.catalog_item?.image_url ||
      reservation?.entitlement?.subscription?.catalog_item?.image_url
    )
  const heroImageUrl = passImageUrl || resolveItemImage(item)

  const bookedDateLabel = reservation
    ? new Date(reservation.start_time).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null
  const bookedTimeLabel = reservation
    ? `${new Date(reservation.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(reservation.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : null

  if (isDynamic && !isReservationExperience) {
    return (
      <ServiceDynamicQuoteLayout
        item={item}
        backUrl={backUrl}
        experience={experience}
      />
    )
  }

  return (
    <DynamicQuotePdpProvider item={item} backUrl={backUrl}>
    <div className={isReservationExperience ? "pb-8" : "pb-32 lg:pb-0"}>
      <div className="w-full px-4 md:px-8">
        <div className="w-full h-[28vh] min-h-[200px] sm:h-[36vh] md:h-[42vh] bg-muted relative rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden">
          <img src={heroImageUrl} alt={item.name} className="absolute inset-0 h-full w-full object-cover object-center" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="mb-8 lg:mb-12">
          <PdpMetricChips
            className="mb-4 sm:mb-6"
            chips={[
              isReservationExperience && bookedDateLabel
                ? { icon: <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />, label: bookedDateLabel }
                : null,
              isReservationExperience && bookedTimeLabel
                ? { icon: <Clock className="w-4 h-4 sm:w-5 sm:h-5" />, label: bookedTimeLabel }
                : null,
              instructor
                ? {
                    icon: <User className="w-4 h-4 sm:w-5 sm:h-5" />,
                    imageUrl: instructor.image_url,
                    label: instructor.name,
                  }
                : attributes.instructor
                  ? { icon: <User className="w-4 h-4 sm:w-5 sm:h-5" />, label: attributes.instructor }
                  : null,
              venueLocation.name
                ? {
                    icon: <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />,
                    imageUrl: venueLocation.image_url,
                    label: venueLocation.name,
                  }
                : null,
              !isReservationExperience && attributes.duration
                ? { icon: <Clock className="w-4 h-4 sm:w-5 sm:h-5" />, label: attributes.duration }
                : null,
            ]}
          />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
            {item.name}
          </h1>

          {!isReservationExperience && (
            <div className="mt-4 lg:hidden">
              <PdpPriceBlock price={displayPrice} currency={item.currency || "USD"} />
            </div>
          )}
          {(venueLocation.name || venueLocation.address || venueLocation.city || isReservationExperience) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {isReservationExperience && (
                <>
                  <Link
                    href={experience!.backUrl || backUrl}
                    className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
                    {t("buyer.reservations.back") || t("common.back") || "Back"}
                  </Link>
                  {(venueLocation.address || venueLocation.city || venueLocation.name) && (
                    <span className="text-border select-none" aria-hidden>·</span>
                  )}
                </>
              )}
              <VenueLocationDetails
                name={venueLocation.name}
                address={venueLocation.address}
                city={venueLocation.city}
                showName={false}
                showDirections={false}
                layout="inline"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Submit / price card — below form on mobile, right column on desktop */}
          <div className={`lg:col-span-1 order-2 lg:order-2 ${isReservationExperience ? "order-1 lg:order-2" : ""}`}>
            {isReservationExperience ? (
              <ReservationManagePanel
                reservation={reservation}
                schedules={experience?.extras?.schedules || []}
              />
            ) : (
              <div className="lg:sticky lg:top-32 lg:bg-card lg:border lg:border-border/50 lg:rounded-3xl lg:p-8 lg:shadow-2xl lg:shadow-black/5 relative">
                <div className="hidden lg:block mb-6 lg:mb-8">
                  <PdpPriceBlock price={displayPrice} currency={item.currency || "USD"} />
                </div>

                <>
                {hasVariants && (
                  <VariantPicker
                    axes={axes}
                    selectedOptions={selectedOptions}
                    onOptionSelect={(axisId, valueId) =>
                      setSelectedOptions((prev) => ({ ...prev, [axisId]: valueId }))
                    }
                    childrenItems={children}
                  />
                )}

                {isDropIn ? (
                  <>
                    {ownedEntitlement && (
                      <div className="mb-8 overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-b from-primary/5 to-transparent text-center relative">
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0" />
                        <div className="p-6 sm:p-8">
                          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-primary rounded-full mb-5 shadow-xl shadow-primary/20 ring-8 ring-primary/5">
                            <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
                          </div>
                          <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mb-4">
                            {t("pdp.youOwnThisPass") || "You own a pass for this"}
                          </h3>
                          <PdpCtaButton
                            onClick={() =>
                              router.push(`/buyer/book/${ownedEntitlement.id}?serviceId=${item.id}`)
                            }
                            className="w-full sm:w-auto px-8"
                          >
                            {t("pdp.bookWithPass") || "Book with Pass"}
                          </PdpCtaButton>
                          <div className="mt-8 text-center text-xs sm:text-sm font-medium text-muted-foreground relative">
                            <span className="bg-card px-4 relative z-10 font-bold tracking-widest text-[10px] uppercase">
                              {t("pdp.orPayDropIn") || "OR PAY DROP-IN"}
                            </span>
                            <div className="absolute top-1/2 left-0 right-0 h-px bg-border -translate-y-1/2" />
                          </div>
                        </div>
                      </div>
                    )}
                    <PdpCtaButton onClick={handleBook} disabled={!isSellable}>
                      {!isSellable
                        ? isSelectionComplete
                          ? t("pdp.soldOut") || "Sold Out"
                          : t("pdp.selectOptions") || "Select Options"
                        : t("booking.selectTime") || "Select a Time"}
                    </PdpCtaButton>
                  </>
                ) : (
                  <div className="hidden lg:block space-y-3">
                    <PdpCtaButton onClick={handleBuyNow} disabled={!isSellable}>
                      {!isSellable
                        ? isSelectionComplete
                          ? t("pdp.soldOut") || "Sold Out"
                          : t("pdp.selectOptions") || "Select Options"
                        : t("pdp.buyNow") || "Buy Now"}
                    </PdpCtaButton>
                    <PdpCtaButton variant="outline" onClick={handleAdd} disabled={!isSellable}>
                      {t("marketplace.add") || "Add to Cart"}
                    </PdpCtaButton>
                  </div>
                )}
                </>
              </div>
            )}
          </div>

          <div className={`lg:col-span-2 space-y-8 ${isReservationExperience ? "order-2 lg:order-1" : "order-1 lg:order-1"}`}>
            {isReservationExperience && (
              <div className="rounded-3xl border border-border/50 bg-card shadow-sm shadow-black/5 p-6 sm:p-8 space-y-6">
                <h3 className="font-bold text-xl">
                  {t("buyer.reservations.title") || "Reservation details"}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                  {reservation?.site?.name && (
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1.5">{t("buyer.reservations.provider")}</div>
                      <div className="font-semibold text-base">{reservation.site.name}</div>
                    </div>
                  )}
                  {(item as any)._parent?.name && (item as any)._parent.name !== item.name && (
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1.5">{t("buyer.reservations.parentService")}</div>
                      <div className="font-semibold text-base">{(item as any)._parent.name}</div>
                    </div>
                  )}
                  {reservation?.entitlement?.subscription?.catalog_item?.name && (
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1.5">{t("buyer.reservations.subscription")}</div>
                      <div className="font-semibold text-base">{reservation.entitlement.subscription.catalog_item.name}</div>
                    </div>
                  )}
                  {reservation?.entitlement?.catalog_item?.name && (
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1.5">{t("buyer.home.cards.passes.title")}</div>
                      <div className="font-semibold text-base">{reservation.entitlement.catalog_item.name}</div>
                    </div>
                  )}
                  {venueLocation.name && (
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1.5">{t("buyer.reservations.venue")}</div>
                      <div className="font-semibold text-base">{venueLocation.name}</div>
                      {(venueLocation.address || venueLocation.city) && (
                        <div className="text-muted-foreground mt-1 text-sm">
                          {[venueLocation.address, venueLocation.city].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                  {instructor && (
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1.5">
                        {t("buyer.reservations.instructor")}
                      </div>
                      <div className="font-semibold text-base">{instructor.name}</div>
                    </div>
                  )}
                  {reservation?.quantity > 1 && (
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1.5">{t("buyer.reservations.guests")}</div>
                      <div className="font-semibold text-base">{reservation.quantity}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(item.description || isReservationExperience) && (
              <div className="pt-4 lg:pt-8">
                <h3 className="font-bold text-2xl mb-6">
                  {t("marketplace.catalogDetails.about")}
                </h3>
                <div className="prose prose-base sm:prose-lg dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  <p>
                    {item.description || t("buyer.reservations.aboutFallback")}
                  </p>
                </div>
              </div>
            )}

            {(venueLocation.address || venueLocation.city || venueLocation.name) && (
              <div className="pt-4 lg:pt-8 border-t">
                <VenueLocationSection
                  name={venueLocation.name}
                  address={venueLocation.address}
                  city={venueLocation.city}
                />
              </div>
            )}

            {experience?.kind === 'subscription' && experience.subscription && (
              <div className="pt-4 lg:pt-8 mt-8 border-t">
                <SubscriptionManagePanel subscription={experience.subscription} />
              </div>
            )}

          </div>
        </div>
      </div>

      {!isDropIn && !experience && (
        <PdpMobileBuyBar price={displayPrice} fullWidthCta={true}>
          <div className="flex gap-2 w-full">
            <PdpCtaButton
              variant="outline"
              onClick={handleAdd}
              disabled={!isSellable}
              className="px-4 shrink-0 w-auto"
            >
              {t("marketplace.add") || "Add"}
            </PdpCtaButton>
            <PdpCtaButton onClick={handleBuyNow} disabled={!isSellable} className="flex-1">
              {!isSellable
                ? isSelectionComplete
                  ? t("pdp.soldOut") || "Sold Out"
                  : t("pdp.selectOptions") || "Select Options"
                : t("pdp.buyNow") || "Buy Now"}
            </PdpCtaButton>
          </div>
        </PdpMobileBuyBar>
      )}
    </div>
    </DynamicQuotePdpProvider>
  )
}

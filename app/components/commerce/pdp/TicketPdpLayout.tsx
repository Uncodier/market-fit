"use client"

import { useState, useEffect, type ReactNode } from "react"
import { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { buildPdpGalleryEntries, resolveItemImage } from "@/app/lib/image-utils"
import { VenueLocationSection } from "./VenueLocationSection"
import { resolveVenueLocation, resolveItemSpecDisplay, resolveItemSpecDisplays, getPdpSpecDisplay, countPdpSpecDisplay, getPdpFilledAttributeFields } from "@/app/catalog/product-details"
import { usePdpCart } from "./usePdpCart"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { PdpPriceBlock } from "./PdpPriceBlock"
import { PdpPurchaseCtas } from "./PdpPurchaseCtas"
import { afterAddToCartHref } from "./pdp-purchase-cta"
import { PdpMobileBuyBar } from "./PdpMobileBuyBar"
import { PdpExperience } from "./pdp-experience"
import { SubscriptionManagePanel } from "./SubscriptionManagePanel"
import { PdpProductDetails } from "./PdpProductDetails"
import { hasPdpProductDetails } from "./pdp-item-description"
import { TicketEventMeta } from "./TicketEventMeta"
import { TicketPurchaseCard } from "./TicketPurchaseCard"
import { TicketManagePanel } from "./TicketManagePanel"
import { PdpHeroGallery } from "./PdpHeroGallery"
import { BuyerAvatarStack } from "@/app/components/commerce/BuyerAvatarStack"
import { getInventoryDisplayRule } from "@/app/commerce/storefront-display-helpers"

export function TicketPdpLayout({ item, backUrl, experience, catalogSize = 0 }: { item: CatalogItem & { _shop?: any }, backUrl: string, experience?: PdpExperience, catalogSize?: number }) {
  const { t } = useLocalization()
  const router = useRouter()
  const { addToCartStorage, startBuyNow } = usePdpCart(item.site_id)
  
  const [ownedEntitlement, setOwnedEntitlement] = useState<any>(null)
  
  useEffect(() => {
    if (experience?.kind === "entitlement" && experience.entitlement) return
    async function checkOwnership() {
      const { getActiveDigitalEntitlementForCatalogItem } = await import("@/app/buyer/entitlement-queries")
      try {
        const ent = await getActiveDigitalEntitlementForCatalogItem(item.id)
        if (ent) setOwnedEntitlement(ent)
      } catch {
        // user probably not logged in
      }
    }
    checkOwnership()
  }, [item.id, experience?.kind, experience?.entitlement?.id])

  const metadata = item.metadata || {}
  const attributes = metadata.attributes || {}
  
  const event = resolveItemSpecDisplay(item, 'event')
  const artists = resolveItemSpecDisplays(item, 'artist')
  const venueLocation = resolveVenueLocation(item)

  const specDisplay = getPdpSpecDisplay(item)
  
  // Filter out attributes already shown in When/Where
  const excludedAttrs = ['event_date', 'event_time', 'doors_open', 'duration']
  const attrFields = getPdpFilledAttributeFields(item).filter(f => !excludedAttrs.includes(f))

  const hasExtraDetails = hasPdpProductDetails({
    description: null,
    attrCount: attrFields.length,
    specCount: countPdpSpecDisplay(specDisplay),
  })

  const handleAdd = () => {
    addToCartStorage(item)
    toast.success(`${item.name} ${t('marketplace.addedToCart') || 'added to cart'}`)
    router.push(afterAddToCartHref(backUrl))
  }

  const handleBuyNow = () => {
    startBuyNow(item, 1, backUrl)
  }

  const isTicketExperience = experience?.kind === 'entitlement' && experience.entitlement
  const activeEntitlement = isTicketExperience ? experience.entitlement : ownedEntitlement

  const heroImageUrl = resolveItemImage(item, "full")
  const galleryEntries = buildPdpGalleryEntries({ parent: item, size: "full" })
  const isSellable = item._shop?.sellable !== false
  const timeLabel = (attributes as any).event_time || (attributes as any).doors_open
  const durationLabel = attributes.duration

  return (
    <div className="pb-8">
      <div className="w-full px-4 md:px-8">
        <div className="w-full h-[28vh] min-h-[200px] sm:h-[36vh] md:h-[42vh] bg-muted relative rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden">
          <PdpHeroGallery entries={galleryEntries} itemName={item.name} />
          {activeEntitlement && (
            <span className="absolute top-3 left-3 z-20 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm uppercase tracking-wider">
              {t('shop.yourTicket') || 'Your ticket'}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="mb-8 lg:mb-12 max-w-4xl">
          {!activeEntitlement && (
            <div className="lg:hidden mb-4">
              <PdpPriceBlock price={item.target_sale_price || 0} currency={item.currency || 'USD'} />
            </div>
          )}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight mb-8">
            {event?.name || item.name}
          </h1>

          <TicketEventMeta
            date={attributes.event_date}
            time={timeLabel}
            duration={durationLabel}
            venueName={venueLocation.name}
            venueAddress={venueLocation.address}
            venueCity={venueLocation.city}
          />

          {artists.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-4">
              {artists.map(artist => (
                <div key={artist.id} className="flex items-center gap-3 bg-muted/30 p-2 pr-4 rounded-full border">
                  {artist.image_url ? (
                    <img src={artist.image_url} alt={artist.name} className="w-10 h-10 rounded-full object-cover bg-muted" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {artist.name.charAt(0)}
                    </div>
                  )}
                  <span className="font-semibold">{artist.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Main content column */}
          <div className="lg:col-span-2 space-y-8 order-2 lg:order-1">
            {isTicketExperience && ((item as any)._shop?.site_name || (event?.name && event.name !== item.name) || venueLocation.name || artists.length > 0) && (
              <div className="rounded-3xl border border-border/50 bg-card shadow-sm shadow-black/5 p-6 sm:p-8 space-y-6">
                <h3 className="font-bold text-xl">
                  {t("buyer.ticket.details") || "Ticket details"}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                  {(item as any)._shop?.site_name && (
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1.5">
                        {t("buyer.reservations.provider")}
                      </div>
                      <div className="font-semibold text-base">{(item as any)._shop.site_name}</div>
                    </div>
                  )}
                  {event?.name && event.name !== item.name && (
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1.5">
                        {t("pdp.aboutThisEvent") || "Event"}
                      </div>
                      <div className="font-semibold text-base">{event.name}</div>
                    </div>
                  )}
                  {venueLocation.name && (
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1.5">
                        {t("buyer.reservations.venue")}
                      </div>
                      <div className="font-semibold text-base">{venueLocation.name}</div>
                      {(venueLocation.address || venueLocation.city) && (
                        <div className="text-muted-foreground mt-1 text-sm">
                          {[venueLocation.address, venueLocation.city].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                  {artists.length > 0 && (
                    <div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1.5">
                        {t("pdp.artists") || "Artists"}
                      </div>
                      <div className="font-semibold text-base">
                        {artists.map((artist) => artist.name).join(", ")}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(item.description || isTicketExperience || hasExtraDetails) && (
              <div className="pt-4 lg:pt-8 border-t border-transparent lg:border-border">
                <PdpProductDetails
                  description={item.description || (isTicketExperience ? t("buyer.reservations.aboutFallback") : null)}
                  attrFields={attrFields}
                  attributes={attributes as Record<string, string | undefined>}
                  specGroups={specDisplay.groups}
                  specs={specDisplay.rows}
                  aboutLabel={t("pdp.aboutThisEvent") || "About this event"}
                  showShortDescription
                />
              </div>
            )}

            {(venueLocation.address || venueLocation.city || venueLocation.name) && (
              <div className="pt-8 lg:pt-10 border-t">
                <VenueLocationSection
                  name={venueLocation.name}
                  address={venueLocation.address}
                  city={venueLocation.city}
                />
              </div>
            )}

            {experience?.kind === 'subscription' && experience.subscription && (
              <div className="pt-8 lg:pt-10 border-t">
                <SubscriptionManagePanel subscription={experience.subscription} />
              </div>
            )}
          </div>

          {/* Sticky purchase rail */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <div className="lg:sticky lg:top-32 flex flex-col gap-4">
              {activeEntitlement ? (
                <TicketManagePanel
                  entitlement={activeEntitlement}
                  item={item}
                  event={event}
                  venueLocation={venueLocation}
                  attributes={attributes}
                  merchNode={<div className="hidden lg:block"><TicketPdpMerch item={item} t={t} /></div>}
                />
              ) : (
                <TicketPurchaseCard
                  price={item.target_sale_price || 0}
                  currency={item.currency || 'USD'}
                  imageUrl={heroImageUrl}
                  itemName={item.name}
                  date={attributes.event_date}
                  time={timeLabel}
                  isSellable={isSellable}
                  catalogSize={catalogSize}
                  onAdd={handleAdd}
                  onBuyNow={handleBuyNow}
                  onViewTicket={() => router.push(`/buyer/ticket/${ownedEntitlement?.id}`)}
                  ownedEntitlement={ownedEntitlement}
                  merchNode={<div className="hidden lg:block"><TicketPdpMerch item={item} t={t} /></div>}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {!activeEntitlement && (
        <PdpMobileBuyBar price={item.target_sale_price || 0} fullWidthCta={true}>
          <PdpPurchaseCtas
            catalogSize={catalogSize}
            disabled={!isSellable}
            disabledLabel={!isSellable ? (t('pdp.soldOut') || 'Sold Out') : null}
            onAdd={handleAdd}
            onBuyNow={handleBuyNow}
            buyNowLabel={t('pdp.getTickets') || 'Get Tickets'}
            presentation="mobile"
          />
        </PdpMobileBuyBar>
      )}
    </div>
  )
}

function TicketPdpMerch({
  item,
  t,
}: {
  item: CatalogItem & { _shop?: any }
  t: (key: string) => string
}) {
  const shop = item._shop || {}
  const rule = getInventoryDisplayRule(item, shop)
  const hasBuyers = Boolean(item.metadata?.show_buyers && shop.buyers?.length)

  let inventoryLine: ReactNode = null
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
        {t("pdp.ticketsLeft") || "tickets left"}
      </span>
    )
  }

  if (!inventoryLine && !hasBuyers) return null

  return (
    <div className="flex flex-col gap-2 mb-2">
      {inventoryLine}
      {hasBuyers && (
        <div className="flex items-center gap-2">
          <BuyerAvatarStack buyers={shop.buyers} size="md" totalCount={shop.buyerCount} />
          <span className="text-sm font-medium text-muted-foreground">
            {shop.buyerCount} {t("pdp.going") || "going"}
          </span>
        </div>
      )}
    </div>
  )
}

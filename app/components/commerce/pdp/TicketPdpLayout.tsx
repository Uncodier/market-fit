"use client"

import { useState, useEffect, useRef } from "react"
import { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { buildPdpGalleryEntries, resolveItemImage } from "@/app/lib/image-utils"
import { VenueLocationSection } from "./VenueLocationSection"
import { resolveVenueLocation, resolveItemSpecDisplay, resolveItemSpecDisplays, getPdpSpecDisplay, countPdpSpecDisplay, getPdpFilledAttributeFields } from "@/app/catalog/product-details"
import { usePdpCart } from "./usePdpCart"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Download } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { downloadAccessPass } from "@/app/lib/download-access-pass"

import { PdpPriceBlock } from "./PdpPriceBlock"
import { PdpPurchaseCtas } from "./PdpPurchaseCtas"
import { afterAddToCartHref } from "./pdp-purchase-cta"
import { PdpMobileBuyBar } from "./PdpMobileBuyBar"
import { PdpExperience } from "./pdp-experience"
import QRCode from "react-qr-code"
import { SubscriptionManagePanel } from "./SubscriptionManagePanel"
import { PdpProductDetails } from "./PdpProductDetails"
import { hasPdpProductDetails } from "./pdp-item-description"
import { TicketEventMeta } from "./TicketEventMeta"
import { TicketPurchaseCard } from "./TicketPurchaseCard"
import { PdpHeroGallery } from "./PdpHeroGallery"

export function TicketPdpLayout({ item, backUrl, experience, catalogSize = 0 }: { item: CatalogItem & { _shop?: any }, backUrl: string, experience?: PdpExperience, catalogSize?: number }) {
  const { t } = useLocalization()
  const router = useRouter()
  const { addToCartStorage, startBuyNow } = usePdpCart(item.site_id)
  const qrRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  
  const [ownedEntitlement, setOwnedEntitlement] = useState<any>(null)
  
  useEffect(() => {
    async function checkOwnership() {
      // Import dynamically to avoid top-level import
      const { getActiveDigitalEntitlementForCatalogItem } = await import("@/app/buyer/entitlement-queries")
      try {
        const ent = await getActiveDigitalEntitlementForCatalogItem(item.id)
        if (ent) setOwnedEntitlement(ent)
      } catch (e) {}
    }
    checkOwnership()
  }, [item.id])

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

  if (experience?.kind === 'entitlement' && experience.entitlement) {
    return (
      <div className="pb-16 max-w-7xl mx-auto w-full px-4 md:px-8 space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-2">
            {event?.name || item.name}
          </h1>
          <div className="text-muted-foreground font-medium flex flex-wrap items-center gap-2">
            {t('buyer.library.actions.ticket') || 'Ticket'}
            {attributes.event_date && (
              <>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>{attributes.event_date}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-6 sm:p-12 bg-white dark:bg-background border rounded-3xl shadow-sm">
          <div ref={qrRef} className="relative bg-white p-4 rounded-xl shadow-sm border mb-6">
            <QRCode
              value={experience.entitlement.metadata?.access_token || experience.entitlement.metadata?.ticket_token || experience.entitlement.id}
              size={200}
              level="H"
              style={{ opacity: experience.entitlement.status === 'used' || experience.entitlement.uses_remaining === 0 ? 0.3 : 1 }}
            />
            {(experience.entitlement.status === 'used' || experience.entitlement.uses_remaining === 0) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-background/90 text-foreground font-black px-6 py-3 rounded-xl border shadow-lg text-lg tracking-widest uppercase rotate-12">
                  {t("ticket.checkedIn") || "Checked In"}
                </div>
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-mono text-muted-foreground mb-1 uppercase tracking-wider">{t("ticket.ticketId") || "Ticket ID"}</p>
            <p className="font-mono font-medium text-foreground mb-4">{experience.entitlement.id}</p>
            {experience.entitlement.status !== 'used' && experience.entitlement.uses_remaining !== 0 && (
              <Button
                variant="outline"
                onClick={async () => {
                  const svg = qrRef.current?.querySelector("svg")
                  if (!svg) return
                  setIsDownloading(true)
                  try {
                    const code =
                      experience.entitlement.metadata?.access_token ||
                      experience.entitlement.metadata?.ticket_token ||
                      experience.entitlement.id
                    await downloadAccessPass({
                      qrSvg: svg,
                      title: event?.name || item.name,
                      brandName: (item as any)._shop?.site_name || "Market Fit",
                      kind: "ticket",
                      dateLabel: attributes.event_date,
                      timeLabel: (attributes as any).event_time || (attributes as any).doors_open,
                      venueLabel: [venueLocation.name, venueLocation.city].filter(Boolean).join(" · ") || undefined,
                      codeLabel: code,
                      footnote: t("buyer.reservations.presentQr") || "Present this QR at the entrance",
                      filename: `ticket-${experience.entitlement.id.slice(0, 8)}.png`,
                    })
                  } finally {
                    setIsDownloading(false)
                  }
                }}
                disabled={isDownloading}
              >
                <Download className="w-4 h-4 mr-2" />
                {isDownloading
                  ? "..."
                  : t("buyer.reservations.downloadPass") || "Download Pass"}
              </Button>
            )}
          </div>

          {(venueLocation.name || venueLocation.address || venueLocation.city) && (
            <div className="mt-8 w-full max-w-lg text-left">
              <VenueLocationSection
                name={venueLocation.name}
                address={venueLocation.address}
                city={venueLocation.city}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

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
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="mb-8 lg:mb-12 max-w-4xl">
          <div className="lg:hidden mb-4">
            <PdpPriceBlock price={item.target_sale_price || 0} currency={item.currency || 'USD'} />
          </div>
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
            {(item.description || hasExtraDetails) && (
              <div className="pt-4 lg:pt-8 border-t border-transparent lg:border-border">
                <PdpProductDetails
                  description={item.description}
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
          <div className="lg:col-span-1 order-1 lg:order-2 hidden lg:block">
            <div className="lg:sticky lg:top-32">
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
                onViewTicket={() => router.push(`/buyer/ticket/${ownedEntitlement.id}`)}
                ownedEntitlement={ownedEntitlement}
              />
            </div>
          </div>
        </div>
      </div>

      {!ownedEntitlement && !experience && (
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

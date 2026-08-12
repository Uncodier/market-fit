"use client"

import { useState, useEffect, useRef } from "react"
import { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { VenueLocationDetails } from "./VenueLocationDetails"
import { VenueLocationSection } from "./VenueLocationSection"
import { resolveVenueLocation, resolveItemSpecDisplay, resolveItemSpecDisplays } from "@/app/catalog/product-details"
import { usePdpCart } from "./usePdpCart"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { CheckCircle, MapPin, Download } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { downloadAccessPass } from "@/app/lib/download-access-pass"

import { PdpCtaButton } from "./PdpCtaButton"
import { PdpPriceBlock } from "./PdpPriceBlock"
import { PdpMetricChips } from "./PdpMetricChips"
import { PdpMobileBuyBar } from "./PdpMobileBuyBar"
import { PdpExperience } from "./pdp-experience"
import QRCode from "react-qr-code"
import { SubscriptionManagePanel } from "./SubscriptionManagePanel"

export function TicketPdpLayout({ item, backUrl, experience }: { item: CatalogItem & { _shop?: any }, backUrl: string, experience?: PdpExperience }) {
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
  const organizer = resolveItemSpecDisplay(item, 'organizer')
  const venueLocation = resolveVenueLocation(item)

  const handleAdd = () => {
    addToCartStorage(item)
    toast.success(`${item.name} ${t('marketplace.addedToCart') || 'added to cart'}`)
    router.push(`${backUrl}?cart=1`)
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
                      timeLabel: attributes.event_time || attributes.doors_open,
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

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12 pb-32 lg:pb-12">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-20 bg-card rounded-[2rem] lg:rounded-[3rem] border overflow-hidden shadow-xl">
        <div className="w-full lg:w-[45%] aspect-[4/5] lg:aspect-auto bg-muted relative">
          <img src={resolveItemImage(item)} alt={item.name} className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 lg:from-transparent to-transparent" />
        </div>
        
        <div className="w-full lg:w-[55%] p-6 sm:p-8 lg:p-16 flex flex-col justify-center relative">
          {/* Decorative element */}
          <div className="hidden lg:block absolute -left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-background border border-r-0 z-10" />
          
          <div className="mb-4">
            <PdpMetricChips 
              className="mb-6"
              chips={[
                attributes.event_date ? { label: attributes.event_date } : null,
                venueLocation.name ? { icon: <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />, label: venueLocation.name } : null
              ]}
            />
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black tracking-tight mb-4 sm:mb-6 leading-tight">
              {event?.name || item.name}
            </h1>
            <VenueLocationDetails
              name={venueLocation.name}
              address={venueLocation.address}
              city={venueLocation.city}
              showDirections={false}
              layout="stack"
              className="mb-6"
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

          {item.description && (
            <div className="prose prose-base sm:prose-lg dark:prose-invert max-w-none text-muted-foreground leading-relaxed my-8 sm:my-10">
              <p>{item.description}</p>
            </div>
          )}

          {(venueLocation.address || venueLocation.city || venueLocation.name) && (
            <div className="my-8 sm:my-10 pt-8 border-t">
              <VenueLocationSection
                name={venueLocation.name}
                address={venueLocation.address}
                city={venueLocation.city}
              />
            </div>
          )}

          <div className="mt-auto pt-8 sm:pt-10 border-t">
            {ownedEntitlement ? (
              <div className="overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-b from-primary/5 to-transparent relative p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 justify-between">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0" />
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary rounded-full shadow-lg shadow-primary/20 ring-4 ring-primary/5 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mb-1">
                      {t('pdp.youOwnThisTicket') || 'You have a ticket for this event'}
                    </h3>
                    <p className="text-sm font-medium text-muted-foreground max-w-sm">
                      {t('pdp.viewYourTicketText') || 'You can view your ticket and QR code in your library.'}
                    </p>
                  </div>
                </div>
                <PdpCtaButton onClick={() => router.push(`/buyer/ticket/${ownedEntitlement.id}`)} className="w-full md:w-auto px-8">
                  {t('buyer.library.actions.ticket') || 'View Ticket'}
                </PdpCtaButton>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <PdpPriceBlock price={item.target_sale_price || 0} currency={item.currency || 'USD'} />
                
                <div className="hidden sm:flex gap-3">
                  <PdpCtaButton 
                    variant="outline"
                    onClick={handleAdd}
                    disabled={item._shop?.sellable === false}
                    className="w-auto px-6"
                  >
                    {t('marketplace.add') || 'Add'}
                  </PdpCtaButton>
                  <PdpCtaButton 
                    onClick={handleBuyNow}
                    disabled={item._shop?.sellable === false}
                    className="w-auto px-10"
                  >
                    {item._shop?.sellable === false ? (t('pdp.soldOut') || 'Sold Out') : (t('pdp.getTickets') || 'Get Tickets')}
                  </PdpCtaButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {experience?.kind === 'subscription' && experience.subscription && (
        <div className="mb-12 max-w-7xl mx-auto">
          <SubscriptionManagePanel subscription={experience.subscription} />
        </div>
      )}

      {!ownedEntitlement && !experience && (
        <PdpMobileBuyBar price={item.target_sale_price || 0} fullWidthCta={true}>
          <div className="flex gap-2 w-full">
            <PdpCtaButton 
              variant="outline"
              onClick={handleAdd}
              disabled={item._shop?.sellable === false}
              className="px-4 shrink-0 w-auto"
            >
              {t('marketplace.add') || 'Add'}
            </PdpCtaButton>
            <PdpCtaButton 
              onClick={handleBuyNow}
              disabled={item._shop?.sellable === false}
              className="flex-1"
            >
              {item._shop?.sellable === false ? (t('pdp.soldOut') || 'Sold Out') : (t('pdp.getTickets') || 'Get Tickets')}
            </PdpCtaButton>
          </div>
        </PdpMobileBuyBar>
      )}
    </div>
  )
}
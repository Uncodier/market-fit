"use client"

import { SectionCard, SectionCardContent, SectionCardHeader, SectionCardTitle } from "@/app/components/ui/section-card"
import { Button } from "@/app/components/ui/button"
import { Truck } from "@/app/components/ui/icons"
import { MarketplaceBadges } from "@/app/orders/components/MarketplaceBadges"
import { MarketplaceActionDialog, marketplaceActionLabels } from "@/app/orders/components/MarketplaceActionDialog"
import { useMarketplaceAction } from "@/app/orders/hooks/use-marketplace-action"
import { asRecord, marketplaceMetadata, metadataText, safeTrackingUrl } from "@/lib/marketplace/presentation"
import type { ShipmentWithRelations } from "../types"

export function MarketplaceCourierCard({ shipment, onRefresh }: {
  shipment: ShipmentWithRelations; onRefresh: () => Promise<unknown> | void
}) {
  const marketplace = marketplaceMetadata(shipment.metadata)
  const control = useMarketplaceAction({ resource: "shipments", id: shipment.id, metadata: shipment.metadata, onRefresh })
  if (!marketplace) return null
  const courier = asRecord(marketplace.courier)
  const tracking = safeTrackingUrl(courier?.tracking_url)
  const eta = metadataText(marketplace.estimated_arrival_at)
  const etaDate = eta ? new Date(eta) : null
  return <SectionCard>
    <SectionCardHeader><SectionCardTitle className="flex items-center gap-2"><Truck className="h-4 w-4" />External courier</SectionCardTitle></SectionCardHeader>
    <SectionCardContent className="space-y-4">
      <MarketplaceBadges metadata={shipment.metadata} />
      <p className="text-sm text-muted-foreground">{marketplace.delivery_mode === "marketplace_managed"
        ? "Delivery is managed by the marketplace. Courier assignment and tracking are read-only; requesting or cancelling delivery is not supported."
        : "Courier details are supplied by the provider and are read-only."}</p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-muted-foreground">Courier</dt><dd>{metadataText(courier?.name) || "Not assigned by provider"}</dd></div>
        <div><dt className="text-muted-foreground">Phone</dt><dd>{metadataText(courier?.phone) || "Not supplied"}</dd></div>
        <div><dt className="text-muted-foreground">Vehicle</dt><dd>{metadataText(courier?.vehicle) || "Not supplied"}</dd></div>
        <div><dt className="text-muted-foreground">Delivery status</dt><dd>{metadataText(marketplace.delivery_status) || shipment.status.replaceAll("_", " ")}</dd></div>
        <div><dt className="text-muted-foreground">Estimated arrival</dt><dd>{etaDate && !Number.isNaN(etaDate.valueOf()) ? etaDate.toLocaleString("en-US")
          : typeof marketplace.eta_minutes === "number" && marketplace.eta_minutes >= 0 ? `${marketplace.eta_minutes} minutes` : "Not supplied"}</dd></div>
      </dl>
      {tracking && <a className="text-sm text-primary underline" href={tracking} target="_blank" rel="noopener noreferrer">Open provider tracking</a>}
      <div className="flex flex-wrap gap-2">
        {(["request", "cancel"] as const).filter((action) => action === "request" ? control.allowed(action)
          : marketplace.delivery_mode === "merchant_managed" && asRecord(marketplace.capabilities)?.cancel_delivery === true && control.allowed(action)).map((action) =>
          <Button key={action} size="sm" variant="outline" data-permission="update" onClick={() => control.choose(action)}>{marketplaceActionLabels[action]}</Button>)}
        <Button size="sm" variant="ghost" onClick={() => void onRefresh()}>Refresh shipment</Button>
      </div>
      {control.result && !control.action && <p role="status" className="text-sm">{control.result.message}</p>}
      <MarketplaceActionDialog control={control} />
    </SectionCardContent>
  </SectionCard>
}
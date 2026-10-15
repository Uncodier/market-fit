"use client"

import { useState } from "react"
import { mutate } from "swr"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { MarketplaceBadges } from "./MarketplaceBadges"
import { MarketplaceActionDialog, marketplaceActionLabels } from "./MarketplaceActionDialog"
import { useMarketplaceAction } from "../hooks/use-marketplace-action"
import { marketplaceMetadata, metadataText } from "@/lib/marketplace/presentation"
import type { OrderWithRelations } from "../types"

export async function refreshMarketplaceOrders() {
  await mutate((key) => Array.isArray(key) ? key[0] === "order-detail"
    : key !== null && typeof key === "object" && "resource" in key && key.resource === "orders")
}

export function MarketplaceOrderControls({ order }: { order: OrderWithRelations }) {
  const [refreshing, setRefreshing] = useState(false)
  const marketplace = marketplaceMetadata(order.metadata)
  const control = useMarketplaceAction({ resource: "orders", id: order.id, metadata: order.metadata, onRefresh: refreshMarketplaceOrders })
  const refreshProvider = async () => {
    setRefreshing(true)
    try {
      const response = await fetch(`/api/marketplace/orders/${encodeURIComponent(order.id)}/sync`, {
        method: "POST", credentials: "same-origin",
      })
      const result = await response.json()
      if (!response.ok) toast.error("Provider synchronization unavailable; the saved state remains unchanged.")
      else if (result.refreshed !== true) toast.message("This order is not available from the provider's query API. Waiting for a provider event.")
      await refreshMarketplaceOrders()
    } catch {
      toast.error("Provider synchronization unavailable; the saved state remains unchanged.")
    } finally { setRefreshing(false) }
  }
  if (!marketplace) return null
  return <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
    <MarketplaceBadges metadata={order.metadata} />
    {metadataText(marketplace.external_order_id) && <p className="text-xs text-muted-foreground">Provider order: {metadataText(marketplace.external_order_id)}</p>}
    {metadataText(marketplace.accept_by) && <p className="text-xs text-muted-foreground">Accept by: {metadataText(marketplace.accept_by)}</p>}
    {metadataText(marketplace.scheduled_at) && <p className="text-xs text-muted-foreground">Provider schedule: {metadataText(marketplace.scheduled_at)}</p>}
    <div className="flex flex-wrap gap-2">
      {(["accept", "reject", "ready", "cancel"] as const).filter(control.allowed).map((action) =>
        <Button key={action} size="sm" variant={action === "reject" || action === "cancel" ? "outline" : "default"}
          data-permission="update" onClick={() => control.choose(action)}>{marketplaceActionLabels[action]}</Button>)}
      <Button variant="ghost" size="sm" disabled={refreshing} onClick={() => void refreshProvider()}>
        {refreshing ? "Refreshing…" : "Refresh provider status"}
      </Button>
    </div>
    {control.result && !control.action && <p role="status" className="text-xs">{control.result.message}</p>}
    <MarketplaceActionDialog control={control} />
  </div>
}
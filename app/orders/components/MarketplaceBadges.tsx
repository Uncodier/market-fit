import { Badge } from "@/app/components/ui/badge"
import { marketplaceMetadata, marketplaceOperation, marketplaceProvider, metadataText } from "@/lib/marketplace/presentation"

export function MarketplaceBadges({ metadata }: { metadata: unknown }) {
  const marketplace = marketplaceMetadata(metadata)
  if (!marketplace) return null
  const operation = marketplaceOperation(marketplace)
  const status = metadataText(marketplace.state)
  return <div className="flex flex-wrap items-center gap-1.5" aria-label="Marketplace metadata">
    <Badge variant="outline">{marketplaceProvider(marketplace)}</Badge>
    {status && <Badge variant="secondary">{status.replaceAll("_", " ")}</Badge>}
    {marketplace.totals_provisional === true && <Badge variant="outline">Provisional totals</Badge>}
    {marketplace.sync_status === "unknown" && operation !== "unknown" && <Badge variant="destructive">Outcome unknown</Badge>}
    {marketplace.sync_status === "pending" && operation !== "pending" && <Badge variant="outline">Awaiting provider</Badge>}
    {operation && <Badge variant={operation === "failed" || operation === "unknown" ? "destructive" : "outline"}>
      {operation === "unknown" ? "Outcome unknown" : operation === "pending" ? "Awaiting provider" : `Action ${operation}`}
    </Badge>}
  </div>
}
"use client"

import { useSyncExternalStore } from "react"
import QRCode from "react-qr-code"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { Copy, Download, ExternalLink } from "../ui/icons"
import { downloadSettingsQr, selfServiceLocationUrl } from "./share-qr"

const subscribeOrigin = () => () => {}
const browserOrigin = () => window.location.origin
const serverOrigin = () => "https://www.makinari.com"

export function LocationSelfServiceShare({ locationId, locationName }: { locationId?: string; locationName: string }) {
  const origin = useSyncExternalStore(subscribeOrigin, browserOrigin, serverOrigin)
  if (!locationId) return <p className="mt-4 text-sm text-muted-foreground">Save this location to generate its self-service link and QR code.</p>
  const url = selfServiceLocationUrl(locationId, origin)
  const containerId = `self-service-qr-${locationId}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Self-service link copied")
    } catch {
      toast.error("Failed to copy self-service link")
    }
  }
  return (
    <div className="mt-4 flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center">
      <div id={containerId} className="w-fit shrink-0 rounded-lg bg-white p-2">
        <QRCode value={url} size={80} level="M" title={`Self-service ordering at ${locationName}`} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <h4 className="text-sm font-semibold">Self-service link and QR code</h4>
        <p className="text-xs text-muted-foreground">Scan to order at this location. No account is required.</p>
        <p className="truncate select-all font-mono text-xs">{url}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copy}><Copy className="mr-2 h-4 w-4" />Copy link</Button>
          <Button type="button" variant="outline" size="sm" asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open</a></Button>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadSettingsQr(containerId, `${locationId}-self-service-qr.png`)}><Download className="mr-2 h-4 w-4" />Download QR</Button>
        </div>
      </div>
    </div>
  )
}
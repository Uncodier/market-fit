"use client"

import { useEffect, useId, useState, useSyncExternalStore } from "react"
import QRCode from "react-qr-code"
import { toast } from "sonner"
import { listLocations } from "@/app/inventory/actions"
import { Button } from "../ui/button"
import { Copy, Download, ExternalLink, Store } from "../ui/icons"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { ShopKioskShareSkeleton } from "./ShopKioskShareSkeleton"
import { downloadSettingsQr, selfServiceLocationUrl } from "./share-qr"

const subscribeOrigin = () => () => {}
const browserOrigin = () => window.location.origin
const serverOrigin = () => "https://www.makinari.com"

type LocationOption = { id: string; name: string }
type LocationState = { siteId: string; locations: LocationOption[]; error: boolean }

export function ShopKioskShareCard({ siteId }: { siteId?: string }) {
  const origin = useSyncExternalStore(subscribeOrigin, browserOrigin, serverOrigin)
  const id = useId()
  const containerId = `${id}-kiosk-qr`
  const [state, setState] = useState<LocationState | null>(null)
  const [selectedId, setSelectedId] = useState("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!siteId) return
    let cancelled = false
    async function load() {
      try {
        const result = await listLocations(siteId!)
        if (!cancelled) {
          setState({ siteId: siteId!, locations: result.error ? [] : result.data, error: Boolean(result.error) })
        }
      } catch {
        if (!cancelled) setState({ siteId: siteId!, locations: [], error: true })
      }
    }
    void load()
    return () => { cancelled = true }
  }, [siteId, attempt])

  const current = state?.siteId === siteId ? state : null
  const selected = current?.locations.find((location) => location.id === selectedId) ?? current?.locations[0]
  const url = selected ? selfServiceLocationUrl(selected.id, origin) : ""

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Kiosk link copied")
    } catch {
      toast.error("Failed to copy kiosk link")
    }
  }

  return (
    <section id="shop-kiosk-share" className="min-w-0 space-y-4" aria-labelledby={`${id}-title`}>
      <div>
        <h3 id={`${id}-title`} className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <Store className="h-5 w-5 text-muted-foreground" />
          Location Kiosks
        </h3>
        <p className="text-sm text-muted-foreground mt-1">Share your location&apos;s kiosk link and QR code.</p>
      </div>
      <div className="border rounded-xl p-4 md:p-6 bg-card text-card-foreground shadow-sm space-y-4">
        {!siteId ? (
          <p className="text-sm text-muted-foreground">Save your store to share location kiosks.</p>
        ) : !current ? (
          <ShopKioskShareSkeleton />
        ) : current.error ? (
          <div className="flex items-center gap-3">
            <p role="alert" className="text-sm text-muted-foreground">Unable to load locations.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => { setState(null); setAttempt((value) => value + 1) }}>Retry</Button>
          </div>
        ) : !selected ? (
          <p className="text-sm text-muted-foreground">Add a location in Company settings to generate its kiosk link and QR code.</p>
        ) : (
          <Tabs value={selected.id} onValueChange={setSelectedId} className="min-w-0 space-y-4">
            {current.locations.length > 1 && <TabsList aria-label="Location" className="flex h-auto w-full flex-wrap justify-start gap-0.5 p-0.5">
              {current.locations.map((location) => (
                <TabsTrigger key={location.id} value={location.id} className="min-h-7 min-w-0 max-w-full flex-auto px-2.5 py-1 text-xs whitespace-normal break-words [overflow-wrap:anywhere] sm:flex-none">
                  {location.name}
                </TabsTrigger>
              ))}
            </TabsList>}
            <TabsContent value={selected.id} className="mt-0 flex flex-col md:flex-row gap-6 items-center"
              {...(current.locations.length === 1 ? { role: "group", "aria-labelledby": `${id}-title` } : {})}>
              <div className="flex items-center gap-4 w-full md:w-auto shrink-0 justify-center">
                <div id={containerId} className="shrink-0 bg-white p-1.5 rounded-lg border shadow-sm">
                  <QRCode value={url} size={72} level="M" title={`Kiosk at ${selected.name}`} />
                </div>
                <div className="flex flex-col items-start gap-2">
                  <div className="space-y-0.5">
                    <h4 className="font-semibold text-sm">Kiosk QR Code</h4>
                    <p className="text-xs text-muted-foreground">Scan to order</p>
                  </div>
                  <Button variant="secondary" size="sm" type="button" onClick={() => downloadSettingsQr(containerId, `${selected.id}-self-service-qr.png`)} className="h-7 text-xs px-3">
                    <Download className="h-3 w-3 mr-1.5" />Download
                  </Button>
                </div>
              </div>
              <div className="hidden md:block w-px h-16 bg-border shrink-0" />
              <div className="flex-1 min-w-0 space-y-2 w-full">
                <h4 className="text-sm font-semibold">Kiosk Link</h4>
                <p className="text-xs text-muted-foreground">This is the public kiosk URL for {selected.name}. Customers can scan to order at this location. No account is required.</p>
                <div className="flex items-center gap-2 mt-2 bg-muted/50 border rounded-lg p-1.5 pl-3">
                  <span className="flex-1 min-w-0 text-sm font-mono text-muted-foreground truncate select-all">{url}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={copy} title="Copy kiosk link" aria-label="Copy kiosk link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild>
                      <a href={url} target="_blank" rel="noopener noreferrer" title="Open kiosk" aria-label="Open kiosk"><ExternalLink className="h-4 w-4" /></a>
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </section>
  )
}
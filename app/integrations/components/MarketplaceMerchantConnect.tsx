"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import type { MarketplaceProvider } from "@/lib/marketplace/providers/types"
import { MARKETPLACE_COUNTRIES, RAPPI_COUNTRIES, type MarketplaceIntegrationDTO } from "@/lib/marketplace/config-types"
import { SectionCardFooter } from "@/app/components/ui/section-card"

type Connection = { id: string; provider: MarketplaceProvider; environment: string; country: string;
  authorization_expired: boolean; stores: Array<{ id: string; name: string; location?: { address?: string; city?: string } }> }

export function MarketplaceMerchantConnect({ provider, siteId, canManage, platformApps, locations, integrations, onChanged, renderCard }: {
  provider: MarketplaceProvider; siteId: string; canManage: boolean; platformApps?: { production: boolean; sandbox: boolean };
  locations: Array<{ id: string; name: string }>; integrations: MarketplaceIntegrationDTO[]; onChanged: () => void;
  renderCard?: (content: ReactNode, actions: ReactNode) => ReactNode;
}) {
  const [mode, setMode] = useState<"platform" | "custom">("platform")
  const [environment, setEnvironment] = useState<"production" | "sandbox">("production")
  const [country, setCountry] = useState("MX")
  const [credentials, setCredentials] = useState({ client_id: "", client_secret: "", integration_id: "" })
  const [busy, setBusy] = useState(false)
  const [connections, setConnections] = useState<Connection[]>([])
  const [selected, setSelected] = useState("")
  const [location, setLocation] = useState("")
  const name = provider === "rappi" ? "Rappi" : "Uber Eats"
  useEffect(() => {
    const controller = new AbortController()
    if (!canManage) return
    void fetch(`/api/marketplace/merchant-connections?siteId=${encodeURIComponent(siteId)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) return; const result = await response.json();
        if (!controller.signal.aborted) setConnections(result.connections.filter((item: Connection) => item.provider === provider)) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [siteId, provider, canManage])

  async function connect() {
    setBusy(true)
    try {
      const response = await fetch(`/api/marketplace/oauth/${provider}/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, provider, environment, country, credential_mode: mode,
          ...(mode === "custom" ? { client_id: credentials.client_id, client_secret: credentials.client_secret,
            ...(provider === "rappi" ? { integration_id: credentials.integration_id } : {}) } : {}) }),
      })
      const result = await response.json()
      if (!response.ok || !result.url) throw new Error()
      const url = new URL(result.url)
      if (url.protocol !== "https:") throw new Error()
      window.location.assign(url.href)
    } catch { toast.error("The provider application is not configured or authorization could not be started.") }
    finally { setBusy(false) }
  }
  async function activate() {
    const [connectionId, storeId] = selected.split(":")
    if (!connectionId || !storeId || !location) return
    setBusy(true)
    try {
      const response = await fetch(`/api/marketplace/merchant-connections/${connectionId}/stores`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, external_store_id: storeId, origin_location_id: location }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error()
      toast.success(result.status === "active" ? "Store connected" : "Activation requested. Awaiting provider confirmation.")
      onChanged()
    } catch { toast.error("Activation is unavailable or uncertain. Refresh before repeating the request.") }
    finally { setBusy(false) }
  }
  async function storeAction(id: string, action: "refresh" | "disconnect") {
    if (action === "disconnect" && !window.confirm("Disconnect this store's order integration? This changes the restaurant's operation.")) return
    setBusy(true)
    try {
      const response = await fetch(`/api/marketplace/integrations/${id}/${action}`, { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId }) })
      if (!response.ok) throw new Error()
      toast.message(action === "disconnect" ? "Disconnect requested. Awaiting confirmation." : "Provider status refreshed.")
      onChanged()
    } catch { toast.error("Provider status could not be confirmed. Reauthorize if needed; do not repeat an uncertain mutation.") }
    finally { setBusy(false) }
  }

  const content = <div className="space-y-4">
    <h3 className="font-medium">Connect your {name} account</h3>
    <p className="text-sm text-muted-foreground">Authorize your restaurant and select its stores. Makinari&apos;s application secrets are never shown or requested.</p>
    <fieldset disabled={!canManage || busy} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label>Connection method</Label><Select value={mode} onValueChange={value => setMode(value as "platform" | "custom")}>
          <SelectTrigger aria-label="Connection method"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="platform">Connect with Makinari</SelectItem><SelectItem value="custom">Use my own application (advanced)</SelectItem>
          </SelectContent></Select></div>
        <div><Label>Environment</Label><Select value={environment} onValueChange={value => setEnvironment(value as "production" | "sandbox")}>
          <SelectTrigger aria-label="Merchant environment"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="production">Production</SelectItem><SelectItem value="sandbox">Sandbox</SelectItem>
          </SelectContent></Select></div>
        <div><Label>Country</Label><Select value={country} onValueChange={setCountry}><SelectTrigger aria-label="Merchant country"><SelectValue /></SelectTrigger>
          <SelectContent>{(provider === "rappi" ? RAPPI_COUNTRIES : MARKETPLACE_COUNTRIES).map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {mode === "custom" && <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Your application must be approved and register this callback: /api/marketplace/oauth/{provider}/callback</p>
        <Label htmlFor={`${provider}-merchant-client`}>Your application Client ID</Label><Input id={`${provider}-merchant-client`} type="password" autoComplete="off" value={credentials.client_id} onChange={event => setCredentials(value => ({ ...value, client_id: event.target.value }))} />
        <Label htmlFor={`${provider}-merchant-secret`}>Your application Client secret</Label><Input id={`${provider}-merchant-secret`} type="password" autoComplete="off" value={credentials.client_secret} onChange={event => setCredentials(value => ({ ...value, client_secret: event.target.value }))} />
        {provider === "rappi" && <><Label htmlFor={`${provider}-merchant-integration`}>Rappi integration ID</Label><Input id={`${provider}-merchant-integration`} value={credentials.integration_id} onChange={event => setCredentials(value => ({ ...value, integration_id: event.target.value }))} /></>}
      </div>}
      {mode === "platform" && !platformApps?.[environment] && <p role="status" className="text-sm text-muted-foreground">Makinari&apos;s {name} application is not configured for this environment yet.</p>}
      {connections.length > 0 && <div className="space-y-3 border-t pt-3">
        {connections.some(connection => connection.authorization_expired) && <p role="status" className="text-sm text-muted-foreground">A merchant authorization expired. Authorize the account again before changing its stores; existing active orders are unaffected.</p>}
        <Label>Authorized store</Label><Select value={selected} onValueChange={setSelected}><SelectTrigger aria-label="Authorized store"><SelectValue placeholder="Choose a provider store" /></SelectTrigger><SelectContent>
          {connections.flatMap(connection => connection.stores.map(store => <SelectItem key={`${connection.id}:${store.id}`} value={`${connection.id}:${store.id}`} disabled={connection.authorization_expired}>{store.name} · {[store.location?.address, store.location?.city].filter(Boolean).join(", ")} · {connection.environment}{connection.authorization_expired ? " · Reauthorize" : ""}</SelectItem>))}
        </SelectContent></Select>
        <Label>Native location</Label><Select value={location} onValueChange={setLocation}><SelectTrigger aria-label="Native location"><SelectValue placeholder="Map to a location" /></SelectTrigger><SelectContent>{locations.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
        <p className="text-xs text-muted-foreground">Activation makes Makinari responsible for operating orders. Menu and provider onboarding requirements still apply.</p>
      </div>}
      {integrations.filter(item => item.credential_mode === "platform" || item.merchant_connection_id).map(item =>
        <div key={item.id} className="flex flex-wrap items-center gap-2 border-t pt-3"><span className="text-sm">{item.external_store_id} · {item.provisioning_status || "active"}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void storeAction(item.id, "refresh")}>Refresh status</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void storeAction(item.id, "disconnect")}>Disconnect store</Button>
        </div>)}
    </fieldset>
  </div>
  const actions = <>
    <Button type="button" variant="outline" size="sm" onClick={() => void connect()}
      disabled={!canManage || busy || (mode === "platform" && !platformApps?.[environment])}>Authorize {name}</Button>
    {connections.length > 0 && <Button type="button" variant="outline" size="sm"
      disabled={!canManage || busy || !selected || !location} onClick={() => void activate()}>Activate selected store</Button>}
  </>
  return renderCard ? renderCard(content, actions) : <div className="overflow-hidden rounded-lg border">
    <div className="p-4">{content}</div>
    <SectionCardFooter className="flex-wrap">{actions}</SectionCardFooter>
  </div>
}
"use client"

import { useEffect, useState } from "react"
import { SectionCard, SectionCardHeader, SectionCardTitle, SectionCardContent, SectionCardFooter } from "@/app/components/ui/section-card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Copy } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { MARKETPLACE_COUNTRIES, MARKETPLACE_PROVIDER_NAMES, RAPPI_COUNTRIES, type MarketplaceConfigurationResponse, type MarketplaceIntegrationDTO } from "@/lib/marketplace/config-types"
import type { MarketplaceProvider } from "@/lib/marketplace/providers/types"
import { MarketplaceMerchantConnect } from "./MarketplaceMerchantConnect"

type FormProps = {
  siteId: string
  provider: MarketplaceProvider
  existing?: MarketplaceIntegrationDTO
  locations: MarketplaceConfigurationResponse["locations"]
  canManage: boolean
  onSaved: (integration: MarketplaceIntegrationDTO) => void
  formId: string
  saving: boolean
  setSaving: (saving: boolean) => void
}

function MarketplaceStoreForm({ siteId, provider, existing, locations, canManage, onSaved, formId, saving, setSaving }: FormProps) {
  const [form, setForm] = useState({
    environment: existing?.environment || "sandbox",
    country: existing?.country || "MX",
    external_store_id: existing?.external_store_id || "",
    origin_location_id: existing?.origin_location_id || "",
    enabled: existing?.enabled || false,
    manual_ready: existing?.manual_ready || false,
    client_id: "", client_secret: "", webhook_secret: "",
  })
  const countries = provider === "rappi" ? RAPPI_COUNTRIES : MARKETPLACE_COUNTRIES
  const set = (field: keyof typeof form, value: string | boolean) => setForm(previous => ({ ...previous, [field]: value }))
  const fieldId = (field: string) => `${provider}-${existing?.id || "new"}-${field}`

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage || saving) return
    setSaving(true)
    try {
      const { client_id, client_secret, webhook_secret, ...configuration } = form
      const response = await fetch("/api/marketplace/integrations", {
        method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...configuration, siteId, provider, ...(existing ? { integrationId: existing.id } : {}),
          ...(client_id ? { client_id } : {}), ...(client_secret ? { client_secret } : {}),
          ...(provider === "rappi" && webhook_secret ? { webhook_secret } : {}),
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.integration) throw new Error(data.error || "Could not save marketplace configuration")
      setForm(previous => ({ ...previous, client_id: "", client_secret: "", webhook_secret: "" }))
      onSaved(data.integration)
      toast.success("Configuration saved. Provider onboarding must be completed separately.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save marketplace configuration")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id={formId} onSubmit={save} className="space-y-4">
      <fieldset disabled={!canManage || saving} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={fieldId("environment")}>Environment</Label>
            <Select value={form.environment} onValueChange={value => set("environment", value)} disabled={!!existing}>
              <SelectTrigger id={fieldId("environment")}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="sandbox">Sandbox</SelectItem><SelectItem value="production">Production</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={fieldId("country")}>Country</Label>
            <Select value={form.country} onValueChange={value => set("country", value)}>
              <SelectTrigger id={fieldId("country")}><SelectValue /></SelectTrigger>
              <SelectContent>{countries.map(country => <SelectItem key={country} value={country}>{country}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={fieldId("store")}>External store ID</Label>
            <Input id={fieldId("store")} value={form.external_store_id} onChange={event => set("external_store_id", event.target.value)} required maxLength={200} readOnly={!!existing} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={fieldId("location")}>Origin location</Label>
            <Select value={form.origin_location_id} onValueChange={value => set("origin_location_id", value)} required>
              <SelectTrigger id={fieldId("location")}><SelectValue placeholder="Select an active location" /></SelectTrigger>
              <SelectContent>{locations.map(location => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Store ID and environment cannot be changed after saving. Add another store configuration instead.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["client_id", "client_secret", ...(provider === "rappi" ? ["webhook_secret"] : [])] as const).map(field => {
            const key = field as "client_id" | "client_secret" | "webhook_secret"
            const stored = existing?.has_credentials[key]
            return <div key={key} className="space-y-2">
              <Label htmlFor={fieldId(key)}>{key === "client_id" ? "Client ID" : key === "client_secret" ? "Client secret" : "Webhook secret"}</Label>
              <Input id={fieldId(key)} type="password" autoComplete="new-password" value={form[key]} onChange={event => set(key, event.target.value)} required={!stored} maxLength={4096} placeholder={stored ? "Saved — leave blank to keep" : "Required"} />
              <p className="text-xs text-muted-foreground">{stored ? "Saved credential. Values are never returned." : "Write-only credential, encrypted on the server."}</p>
            </div>
          })}
        </div>
        <div className="flex items-center gap-3">
          <Switch id={fieldId("enabled")} checked={form.enabled} onCheckedChange={checked => set("enabled", checked)} />
          <Label htmlFor={fieldId("enabled")}>Enable webhook receiver</Label>
        </div>
        {provider === "rappi" && <div className="flex items-center gap-3">
          <Switch id={fieldId("manual_ready")} checked={form.manual_ready} onCheckedChange={checked => set("manual_ready", checked)} />
          <Label htmlFor={fieldId("manual_ready")}>Rappi has enabled manual ready-for-pickup notifications for this store</Label>
        </div>}
      </fieldset>
      {!canManage && <p className="text-sm text-muted-foreground">Only site owners and admins with update access can change marketplace configuration.</p>}
      {locations.length === 0 && <p className="text-sm text-muted-foreground">Create an active location before configuring a marketplace store.</p>}
      {existing && <div className="space-y-2">
        <Label htmlFor={fieldId("callback")}>Provider webhook URL</Label>
        <Input id={fieldId("callback")} value={existing.webhook_url} readOnly />
        <Button type="button" variant="outline" size="sm" onClick={async () => {
          try { await navigator.clipboard.writeText(existing.webhook_url); toast.success("Webhook URL copied") }
          catch { toast.error("Could not copy webhook URL") }
        }}><Copy className="mr-2 h-4 w-4" />Copy URL</Button>
      </div>}
    </form>
  )
}

function ProviderCard(props: Omit<FormProps, "existing" | "formId" | "saving" | "setSaving"> & { integrations: MarketplaceIntegrationDTO[];
  platformApps?: { production: boolean; sandbox: boolean }; onChanged: () => void }) {
  const [selectedId, setSelectedId] = useState(props.integrations.find(integration => integration.credential_mode !== "platform" && !integration.merchant_connection_id)?.id || "new")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const formId = `marketplace-${props.provider}-${props.siteId}-configuration`
  const existing = props.integrations.find(integration => integration.id === selectedId)
  return <SectionCard id={`marketplace-${props.provider}`}>
    <SectionCardHeader><SectionCardTitle>{MARKETPLACE_PROVIDER_NAMES[props.provider]}</SectionCardTitle></SectionCardHeader>
    <MarketplaceMerchantConnect provider={props.provider} siteId={props.siteId} canManage={props.canManage}
      platformApps={props.platformApps} locations={props.locations} integrations={props.integrations} onChanged={props.onChanged}
      renderCard={(content, actions) => <>
        <SectionCardContent className="space-y-4">
          {content}
          <details className="space-y-3" onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
            <summary className="cursor-pointer text-sm font-medium">Advanced: manually configured third-party integration</summary>
            <p className="text-sm text-muted-foreground">Orders and marketplace-managed courier updates appear in Orders and Shipments. Enabling the receiver does not connect or provision your provider account.</p>
            <p className="text-sm text-muted-foreground">Complete merchant onboarding, app approval, store linkage and webhook registration with {MARKETPLACE_PROVIDER_NAMES[props.provider]} before receiving orders. Use the exact provider store ID.</p>
            {props.provider === "uber_eats" && <p className="text-sm text-muted-foreground">Uber Eats uses one primary webhook URL per app. All stores use the same URL shown here; app credentials may be shared across your store configurations. Signatures and store linkage are checked for every event.</p>}
            <div className="flex gap-2">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger aria-label={`${MARKETPLACE_PROVIDER_NAMES[props.provider]} store configuration`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New store</SelectItem>
                  {props.integrations.filter(integration => integration.credential_mode !== "platform" && !integration.merchant_connection_id).map(integration => <SelectItem key={integration.id} value={integration.id}>{integration.external_store_id} · {integration.environment} · {integration.enabled ? "Receiver enabled" : "Receiver disabled"}</SelectItem>)}
                </SelectContent>
              </Select>
              {props.canManage && <Button type="button" variant="outline" onClick={() => setSelectedId("new")}>Add store</Button>}
            </div>
            <MarketplaceStoreForm key={`${props.siteId}:${selectedId}`} {...props} existing={existing}
              formId={formId} saving={saving} setSaving={setSaving}
              onSaved={integration => { props.onSaved(integration); setSelectedId(integration.id) }} />
          </details>
        </SectionCardContent>
        <SectionCardFooter className="flex-wrap">
          {advancedOpen ? <Button type="submit" form={formId} variant="outline" size="sm"
            disabled={!props.canManage || saving || props.locations.length === 0}>{saving ? "Saving…" : "Save configuration"}</Button> : actions}
        </SectionCardFooter>
      </>}
    />
  </SectionCard>
}

export function MarketplaceConfigurationCards({ siteId }: { siteId: string }) {
  const [loaded, setLoaded] = useState<{ siteId: string; data?: MarketplaceConfigurationResponse; error?: string }>()
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/marketplace/integrations?siteId=${encodeURIComponent(siteId)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Could not load marketplace configuration")
        if (!controller.signal.aborted) setLoaded({ siteId, data })
      }).catch(() => {
        if (!controller.signal.aborted) setLoaded({ siteId, error: "Could not load marketplace configuration" })
      })
    return () => controller.abort()
  }, [siteId, retry])
  if (!loaded || loaded.siteId !== siteId) return <Skeleton className="h-40 w-full" />
  if (!loaded.data) return <div role="alert" className="space-y-2"><p>{loaded.error}</p><Button variant="outline" onClick={() => setRetry(value => value + 1)}>Retry</Button></div>
  const data = loaded.data
  return <div className="space-y-6">
    {(["rappi", "uber_eats"] as const).map(provider => <ProviderCard key={`${siteId}:${provider}`} siteId={siteId} provider={provider}
      integrations={data.integrations.filter(integration => integration.provider === provider)} locations={data.locations} canManage={data.can_manage}
      platformApps={data.platform_apps?.[provider]} onChanged={() => setRetry(value => value + 1)}
      onSaved={integration => setLoaded(previous => previous?.data && previous.siteId === siteId ? {
        siteId, data: { ...previous.data, integrations: [...previous.data.integrations.filter(item => item.id !== integration.id), integration] },
      } : previous)} />)}
  </div>
}
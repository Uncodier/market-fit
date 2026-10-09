"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter } from "../ui/section-card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Switch } from "../ui/switch"
import { Checkbox } from "../ui/checkbox"
import { BillingHelpTooltip } from "./billing-help-tooltip"
import { useLocalization } from "@/app/context/LocalizationContext"
import { draftConfig, readTopUpSettings, topUpDraft, topUpRequest,
  type TopUpConfig, type TopUpDraft, type TopUpSettings } from "./auto-top-up-state"

// A new site gets a fresh form immediately, not after an effect has reset old settings.
export function AutoTopUpCard({ siteId }: { siteId: string }) {
  return <SiteAutoTopUpCard key={siteId} siteId={siteId} />
}

function SiteAutoTopUpCard({ siteId }: { siteId: string }) {
  const { t } = useLocalization()
  const tr = (key: string, fallback: string) => {
    const translated = t(key)
    return translated && translated !== key ? translated : fallback
  }
  const [settings, setSettings] = useState<TopUpSettings | null>(null)
  const [draft, setDraft] = useState<TopUpDraft | null>(null)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [operation, setOperation] = useState<"load" | "save" | "setup" | null>("load")
  const [error, setError] = useState<"" | "load" | "save" | "setup" | "invalid" | "method" | "consent">("")
  const [saved, setSaved] = useState(false)
  const [mustReload, setMustReload] = useState(false)
  const request = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setOperation("load")
    setSettings(null)
    setDraft(null)
    setConsentAccepted(false)
    setSaved(false)
    setError("")
    try {
      const body = await topUpRequest(`/api/stripe/auto-top-up?siteId=${encodeURIComponent(siteId)}`, controller)
      const loaded = readTopUpSettings(body)
      if (request.current !== controller) return
      setSettings(loaded)
      setDraft(topUpDraft(loaded))
      setMustReload(false)
    } catch {
      if (request.current === controller) setError("load")
    } finally {
      if (request.current === controller) {
        request.current = null
        setOperation(null)
      }
    }
  }, [siteId])

  useEffect(() => {
    void load()
    return () => {
      const controller = request.current
      request.current = null
      controller?.abort()
    }
  }, [load])

  const busy = operation !== null
  const locked = busy || mustReload
  const paused = Boolean(settings && (settings.state !== "ready" || settings.needsAttention))
  const dirty = Boolean(settings && draft && JSON.stringify(draft) !== JSON.stringify(topUpDraft(settings)))

  function edit(patch: Partial<TopUpDraft>) {
    if (locked || request.current) return
    setDraft(previous => previous && ({ ...previous, ...patch }))
    setSaved(false)
    setError("")
    setConsentAccepted(false)
  }

  async function save(disable = false) {
    if (locked || request.current || !settings || !draft) return
    setError("")
    setSaved(false)
    // Switching off never submits invalid or unrelated unsaved form edits.
    const config: TopUpConfig | null = disable ? { ...settings, enabled: false } : draftConfig(draft)
    if (!config) { setError("invalid"); return }
    if (config.enabled && paused) return
    if (config.enabled && !settings.paymentMethodReady && !settings.billingCardAvailable) { setError("method"); return }
    if (config.enabled && !consentAccepted) { setError("consent"); return }
    const controller = new AbortController()
    request.current = controller
    setOperation("save")
    try {
      const body = await topUpRequest("/api/stripe/auto-top-up", controller, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, enabled: config.enabled, minimumCredits: config.minimumCredits,
          targetCredits: config.targetCredits, maxMonthlySpendCents: config.maxMonthlySpendCents,
          billingCardFingerprint: config.enabled && (settings.paymentMethodSource === "billing" ||
            (!settings.paymentMethodReady && settings.billingCardAvailable)) ? settings.billingCardFingerprint : undefined,
          consentAccepted: config.enabled && consentAccepted }),
      })
      if (body.success !== true) throw new Error("Save not confirmed")
      if (request.current !== controller) return
      const confirmed = { ...settings, ...config }
      setSettings(confirmed)
      setDraft(topUpDraft(confirmed))
      setConsentAccepted(false)
      setSaved(true)
    } catch {
      if (request.current === controller) {
        setError("save")
        setMustReload(true)
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        setOperation(null)
      }
    }
  }

  async function setup() {
    if (locked || request.current) return
    const controller = new AbortController()
    request.current = controller
    setOperation("setup")
    setError("")
    setSaved(false)
    setConsentAccepted(false)
    // Beginning setup can disable top-up before Stripe responds, even on failure.
    // Keep the previous values read-only, but never present their status as current.
    setMustReload(true)
    try {
      const body = await topUpRequest("/api/stripe/auto-top-up/setup", controller, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId }),
      })
      if (typeof body.url !== "string" || !body.url) throw new Error("Payment setup unavailable")
      if (request.current !== controller) return
      window.location.assign(body.url)
    } catch {
      if (request.current === controller) {
        setError("setup")
        setMustReload(true)
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        setOperation(null)
      }
    }
  }

  const errors = {
    load: tr("billing.topUp.loadError", "Unable to load automatic top-up settings. Please retry."),
    save: tr("billing.topUp.saveUnconfirmed", "No change was confirmed. The request may still complete. Reload saved settings before trying again; do not repeat a payment."),
    setup: tr("billing.topUp.setupReloadRequired", "Payment setup could not be opened. Automatic top-up may already have been disabled. Reload saved settings before trying again."),
    invalid: tr("billing.topUp.invalid", "Enter a minimum below the target and a monthly cap from $1 to $1,000."),
    method: tr("billing.topUp.methodRequired", "Set up a card for automatic payments first."),
    consent: tr("billing.topUp.consentRequired", "Confirm your consent to automatic charges before saving enabled settings."),
  }

  return <SectionCard id="auto-top-up">
    <SectionCardHeader title={tr("billing.topUp.title", "Automatic credit top-up")}
      description={`$1.00 ${tr("billing.credits.perCredit", "per credit")}`}
      actions={<BillingHelpTooltip label={`${tr("common.help", "Help")}: ${tr("billing.topUp.title", "Automatic credit top-up")}`}>
        <p>{tr("billing.topUp.description", "When your available credits fall below the minimum, buy enough to reach your target.")}</p>
        <p>{tr("billing.topUp.price", "Automatic credits cost $1 each, with no bulk discount. Charges use your explicitly authorized card. The monthly cap includes pending charges. Purchased credits do not expire monthly; no credits are added before payment succeeds.")}</p>
        <p>{tr("billing.topUp.defaultCardNotice", "Your primary Billing card is used by default unless you select a different top-up card. Automatic off-session charges still require your explicit consent.")}</p>
      </BillingHelpTooltip>} />
    <SectionCardContent className="space-y-4" data-testid="auto-top-up-content">
      {error && <p role="alert" className="text-sm text-destructive">{errors[error]}</p>}
      {saved && <p role="status" className="text-sm">{tr("billing.topUp.saved", "Automatic top-up settings saved.")}</p>}
      {operation === "load" && <p role="status" className="text-sm text-muted-foreground">{tr("billing.topUp.loading", "Loading settings…")}</p>}
      {settings && draft && <>
        <p id="auto-top-up-saved-status" role="status" className="text-sm">{mustReload
          ? tr("billing.topUp.statusUnconfirmed", "Saved status is unconfirmed. Reload saved settings to see whether automatic top-up is enabled.")
          : settings.enabled
          ? tr("billing.topUp.storedEnabled", "Saved setting: automatic top-up is enabled.")
          : tr("billing.topUp.storedDisabled", "Saved setting: automatic top-up is disabled.")}</p>
        {settings.pending && <p role="status" className="text-sm">{tr("billing.topUp.pendingPayment", "A top-up payment is pending. Do not repeat the payment. No new automatic charge will be started while it is pending.")}</p>}
        {paused && <p role="status" className="text-sm">{tr("billing.topUp.attentionRequired", "Automatic charges are paused and need attention. Do not repeat the payment. Contact billing support to reconcile it before re-enabling.")}</p>}
        {settings.paymentMethod && <div className="rounded-lg border p-3 text-sm">
          <p className="font-medium">{settings.paymentMethodSource === "top_up"
            ? tr("billing.topUp.selectedCard", "Selected top-up card")
            : tr("billing.topUp.billingCard", "Billing card (default)")}</p>
          <p className="capitalize">{settings.paymentMethod.brand} •••• {settings.paymentMethod.last4}</p>
        </div>}
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="auto-top-up-enabled" className="text-sm font-medium">{tr("billing.topUp.enable", "Enable automatic top-up")}</label>
          <Switch id="auto-top-up-enabled" aria-describedby="auto-top-up-saved-status" checked={draft.enabled} disabled={locked || (!draft.enabled && (paused || settings.pending === true))}
            onCheckedChange={enabled => {
              if (!enabled && settings.enabled) void save(true)
              else edit({ enabled })
            }} />
        </div>
        <p className="text-sm text-muted-foreground">{tr("billing.topUp.disableNotice", "Switching off saves immediately using your last saved limits, discarding unsaved edits. It stops future top-ups but does not cancel an in-flight payment; that payment may still complete.")}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-2 text-sm font-medium">{tr("billing.topUp.minimum", "Minimum credits")}
            <Input type="number" min="0" max="10000" step="0.01" value={draft.minimumCredits} disabled={locked}
              onChange={event => edit({ minimumCredits: event.target.value })} /></label>
          <label className="space-y-2 text-sm font-medium">{tr("billing.topUp.target", "Target credits")}
            <Input type="number" min="1" max="10000" step="1" value={draft.targetCredits} disabled={locked}
              onChange={event => edit({ targetCredits: event.target.value })} /></label>
          <label className="space-y-2 text-sm font-medium">{tr("billing.topUp.cap", "Monthly spend cap (USD)")}
            <Input type="number" min="1" max="1000" step="1" value={draft.monthlySpend} disabled={locked}
              onChange={event => edit({ monthlySpend: event.target.value })} /></label>
        </div>
        {draft.enabled && <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
          <Checkbox id="auto-top-up-consent" checked={consentAccepted} disabled={locked || paused}
            onCheckedChange={checked => { if (!locked) setConsentAccepted(checked === true) }} />
          <label htmlFor="auto-top-up-consent" className="text-sm">{tr("billing.topUp.consent", "I authorize automatic charges to my saved top-up card at $1 per credit when my balance falls below the minimum, up to my target and monthly cap shown above. I can disable future top-ups at any time; in-flight payments may still complete.")}</label>
        </div>}
        {dirty && !busy && <p role="status" className="text-sm">{tr("billing.topUp.unsaved", "You have unsaved changes.")}</p>}
        {operation === "save" && <p role="status" className="text-sm">{tr("billing.topUp.saving", "Saving top-up settings…")}</p>}
        {operation === "setup" && <p role="status" className="text-sm">{tr("billing.topUp.openingSetup", "Opening payment setup…")}</p>}
        <p id="auto-top-up-setup-notice" className="text-sm text-muted-foreground">{tr("billing.topUp.setupNotice", "Authorizing or replacing a card immediately disables future automatic top-ups and discards unsaved edits. Top-ups stay disabled until you explicitly re-enable them with new consent. In-flight payments may still complete.")}</p>
      </>}
    </SectionCardContent>
    <SectionCardFooter className="flex-wrap" data-testid="auto-top-up-footer">
      {settings && draft && <>
        <Button type="button" variant="outline" size="sm" aria-describedby="auto-top-up-setup-notice" disabled={locked} onClick={setup}>{settings.billingCardAvailable && settings.paymentMethodSource !== "top_up"
          ? tr("billing.topUp.otherCard", "Use another card")
          : settings.paymentMethodReady ? tr("billing.topUp.replaceCard", "Replace top-up card") : tr("billing.topUp.addCard", "Authorize a card for top-ups")}</Button>
        <Button type="button" variant="outline" size="sm" disabled={locked || (draft.enabled && (paused || !consentAccepted))} onClick={() => void save()}>{tr("billing.topUp.save", "Save top-up settings")}</Button>
      </>}
      {(error === "load" || (mustReload && !busy)) && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void load()}>{error === "load"
        ? tr("billing.topUp.retry", "Retry loading settings")
        : tr("billing.topUp.reloadSaved", "Reload saved settings")}</Button>}
    </SectionCardFooter>
  </SectionCard>
}

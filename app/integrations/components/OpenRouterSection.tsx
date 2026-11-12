"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { SectionCard, SectionCardContent, SectionCardHeader, SectionCardTitle } from "@/app/components/ui/section-card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { OpenRouterLoading, OpenRouterModelsLoading } from "./OpenRouterLoading"
import { connectionResponseSchema, modelsResponseSchema, type OpenRouterConnectionResponse, type OpenRouterModelsResponse } from "@/lib/integrations/openrouter-contract"
import { OpenRouterModels } from "./OpenRouterModels"
import { openRouterRequest } from "./openrouter-request"
import { OpenRouterRecommendations } from "./OpenRouterRecommendations"
import { OpenRouterVerification } from "./OpenRouterVerification"
import { OpenRouterSetupStatus } from "./OpenRouterSetupStatus"
import { openRouterFailureMessage } from "@/lib/integrations/openrouter-feedback"

class OpenRouterFeedbackError extends Error {}

async function responseBody(response: Response) {
  if (!response.ok) {
    throw new OpenRouterFeedbackError(openRouterFailureMessage(response.status, response.headers?.get("X-OpenRouter-Error")))
  }
  return response.json() as Promise<unknown>
}

function OpenRouterSiteSection({ siteId }: { siteId: string }) {
  const formId = useId()
  const [data, setData] = useState<OpenRouterConnectionResponse>()
  const [models, setModels] = useState<OpenRouterModelsResponse["models"]>()
  const [apiKey, setApiKey] = useState("")
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const [manageModels, setManageModels] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [disconnect, setDisconnect] = useState(false)
  const active = useRef(true)
  const inFlight = useRef(false)
  const connection = data?.connection
  useEffect(() => {
    active.current = true
    const controller = new AbortController()
    void openRouterRequest(`/api/integrations/openrouter?siteId=${encodeURIComponent(siteId)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(responseBody).then(body => {
        if (!controller.signal.aborted) { setData(connectionResponseSchema.parse(body)); setError("") }
      }).catch(failure => {
        if (!controller.signal.aborted) setError(failure instanceof OpenRouterFeedbackError
          ? failure.message : "Could not load OpenRouter. Check your connection and reload; this does not necessarily indicate a permissions problem.")
      })
    return () => { active.current = false; controller.abort() }
  }, [siteId, reload])

  async function mutate(operation: string, fields: Record<string, unknown> = {}) {
    if (inFlight.current || !data?.canManage) return
    inFlight.current = true; setBusy(true); setError(""); setNotice("")
    // Keep credentials only in this submission, never in a saved form or storage.
    if (operation === "connect") setApiKey("")
    try {
      const response = await openRouterRequest("/api/integrations/openrouter", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, siteId, expectedRevision: connection?.revision ?? 0, ...fields }),
      }, operation === "verify" ? 240_000 : 35_000)
      const next = connectionResponseSchema.parse(await responseBody(response))
      if (!active.current) return
      setData(next); setModels(undefined); setManageModels(false); setDisconnect(false)
      setNotice(operation === "refresh" ? "Capabilities refreshed. Manual choices were preserved." : "OpenRouter configuration saved.")
      if (operation === "connect") setConsent(false)
    } catch (failure) {
      if (active.current) setError(failure instanceof OpenRouterFeedbackError ? failure.message : "Request could not be confirmed. Reload before trying again.")
    } finally {
      inFlight.current = false
      if (active.current) setBusy(false)
    }
  }

  async function loadModels() {
    if (inFlight.current) return
    if (manageModels) { setManageModels(false); return }
    if (models) { setManageModels(true); return }
    inFlight.current = true; setBusy(true); setModelsLoading(true); setError("")
    try {
      const response = await openRouterRequest(`/api/integrations/openrouter/models?siteId=${encodeURIComponent(siteId)}`, { credentials: "same-origin", cache: "no-store" })
      const result = modelsResponseSchema.parse(await responseBody(response))
      if (active.current) { setModels(result.models); setManageModels(true) }
    } catch {
      if (active.current) setError("Could not load account models. Try again later.")
    } finally { inFlight.current = false; if (active.current) { setBusy(false); setModelsLoading(false) } }
  }

  if (!data && !error) return <OpenRouterLoading />

  return <SectionCard id="openrouter-integration">
    <SectionCardHeader><SectionCardTitle>OpenRouter · Optional BYOK</SectionCardTitle></SectionCardHeader>
    <SectionCardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">AI usage through a selected customer connection is billed to your OpenRouter account. Other paid services may require Makinari credits. Without a selected connection, existing global providers and billing remain unchanged.</p>
      {error && <div role="alert" className="space-y-2"><p>{error}</p><Button type="button" variant="outline" disabled={busy} onClick={() => { setError(""); setNotice(""); setData(undefined); setModels(undefined); setManageModels(false); setReload(value => value + 1) }}>Reload OpenRouter</Button></div>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {data && <>
        {!data.rolloutEnabled && <p role="status" className="rounded-md border p-3 text-sm">Connection setup is available, but BYOK execution is not enabled yet. Saved credentials and models do not change current service behavior. Activation requires approved schema deployment, runtime and billing validation, and site rollout approval.</p>}
        {connection && <div className="space-y-2 text-sm">
          <p>Connection: {connection.status} · {connection.selected ? "Selected for execution" : "Not selected"} · Revision {connection.revision}</p>
          <p>Last successful refresh: {connection.catalogUpdatedAt ? new Date(connection.catalogUpdatedAt).toLocaleString() : "Not refreshed"}</p>
          <p>Capabilities: {Object.values(connection.capabilities).filter(value => value?.status === "available").length} ready · {Object.values(connection.capabilities).filter(value => value?.status === "unverified").length} unverified · {Object.values(connection.capabilities).filter(value => value?.status === "unavailable").length} unavailable · {Object.values(connection.capabilities).filter(value => value?.status === "disabled").length} disabled</p>
        </div>}
        {data.canManage && <form id={formId} onSubmit={event => { event.preventDefault(); if (consent && apiKey.trim().length >= 16) void mutate("connect", { apiKey, consent: true }) }} className="space-y-3">
          <Label htmlFor="openrouter-api-key">{connection?.status === "connected" ? "Replace OpenRouter API key" : "OpenRouter API key"}</Label>
          <Input id="openrouter-api-key" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={event => setApiKey(event.target.value)} disabled={busy} />
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />I authorize this shared site connection for permitted members, agents, scheduled work and subagents when activated. OpenRouter usage is billed to my account. Connecting and refreshing do not run paid inference.</label>
        </form>}
        {connection?.status === "connected" && <>
          <OpenRouterSetupStatus siteId={siteId} mutationBusy={busy} onRecover={operationId=>void mutate("recover_verification",{operationId})} />
          {data.paidSelectionEnabled && <OpenRouterRecommendations busy={busy} onRecommend={fields => void mutate("recommend", fields)} />}
          <OpenRouterVerification modelId={connection.capabilities.image?.modelId ?? null} busy={busy} onVerify={fields => void mutate("verify", fields)} />
          {modelsLoading && <OpenRouterModelsLoading />}
          {disconnect && <div role="alert" className="space-y-2 rounded-md border p-3"><p>Disconnect this shared key? Future customer-funded dispatches stop; already accepted work keeps its original payer.</p><Button type="button" disabled={busy} onClick={() => void mutate("disconnect")}>Confirm disconnect</Button> <Button type="button" variant="outline" disabled={busy} onClick={() => setDisconnect(false)}>Cancel</Button></div>}
          {manageModels && models && <OpenRouterModels connection={connection} models={models} busy={busy} onSave={(capability, mode, modelId, embeddingDimensions) => void mutate("configure", { capabilities: { [capability]: { mode, modelId, ...(embeddingDimensions !== undefined ? { embeddingDimensions } : {}) } } })} />}
        </>}
      </>}
    </SectionCardContent>
    {data?.canManage && <ActionFooter className="flex-wrap">
      {connection?.status === "connected" && <>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void mutate("refresh")}>Refresh capabilities</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void loadModels()}>{manageModels ? "Hide models" : "Manage models"}</Button>
        <Button type="button" variant="outline" disabled={busy || !data.rolloutEnabled} onClick={() => void mutate("configure", { selected: !connection.selected, consent: true })}>{connection.selected ? "Stop using BYOK" : "Use BYOK for this site"}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => setDisconnect(true)}>Disconnect</Button>
      </>}
      <Button type="submit" form={formId} disabled={busy || !consent || apiKey.trim().length < 16}>{busy ? "Working…" : connection?.status === "connected" ? "Replace key" : "Connect OpenRouter"}</Button>
    </ActionFooter>}
  </SectionCard>
}

export function OpenRouterSection({ siteId }: { siteId: string }) {
  return <OpenRouterSiteSection key={siteId} siteId={siteId} />
}
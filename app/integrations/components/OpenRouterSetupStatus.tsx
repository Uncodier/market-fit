"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { setupResponseSchema } from "@/lib/integrations/openrouter-contract"
import type { z } from "zod"
import { openRouterRequest } from "./openrouter-request"

export function OpenRouterSetupStatus({ siteId, onRecover, mutationBusy=false }: { siteId: string; onRecover?:(operationId:string)=>void; mutationBusy?:boolean }) {
  const [runs, setRuns] = useState<z.infer<typeof setupResponseSchema>["runs"]>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  async function load() {
    setBusy(true); setError(false)
    try {
      const response = await openRouterRequest(`/api/integrations/openrouter/setup?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store", credentials: "same-origin" })
      if (!response.ok) throw new Error()
      setRuns(setupResponseSchema.parse(await response.json()).runs)
    } catch { setError(true) } finally { setBusy(false) }
  }
  return <div className="space-y-2">
    <Button type="button" variant="outline" disabled={busy} onClick={() => void load()}>{busy ? "Loading setup status…" : "Check setup status"}</Button>
    {error && <p role="alert">Setup status is unavailable. Do not repeat an uncertain provider request.</p>}
    {runs && <ul className="space-y-2 text-xs">{runs.length === 0 && <li>No paid setup attempts.</li>}{runs.map(run => <li key={run.operationId} className="rounded-md border p-2">
      {run.kind} · {run.state} · {run.operationId}<br />OpenRouter cost: {run.gatewayCost === null ? "Unknown — reconcile before retrying" : `$${run.gatewayCost}`} · Makinari inference charge: $0
      {run.kind==='verify'&&run.state==='completed'&&onRecover&&<Button type="button" variant="outline" size="sm" disabled={mutationBusy} onClick={()=>onRecover(run.operationId)}>Apply saved verification (no generation)</Button>}
    </li>)}</ul>}
  </div>
}
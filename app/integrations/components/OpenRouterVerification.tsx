"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"

export function OpenRouterVerification({ modelId, busy, onVerify }: { modelId: string | null; busy: boolean; onVerify: (fields: Record<string, unknown>) => void }) {
  const [budget, setBudget] = useState("0.25")
  const [consent, setConsent] = useState(false)
  return <details className="rounded-md border p-4"><summary className="cursor-pointer text-sm font-medium">Verify image generation</summary>
    <fieldset disabled={busy} className="mt-3 space-y-3">
      <p className="text-sm text-muted-foreground">Generate and store one synthetic PNG using the selected image model: {modelId || "Select an image model first"}. The server requires a current fixed-price endpoint quote within your budget. Token-, megapixel- and variant-priced endpoints are rejected. Provider prices can change; configure an account spending limit for an external hard cap.</p>
      <Label htmlFor="openrouter-image-budget">Maximum accepted quote (USD)</Label><Input id="openrouter-image-budget" type="number" min="0.001" max="1" step="0.01" value={budget} onChange={event => setBudget(event.target.value)} />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />I authorize this paid image verification on my OpenRouter account. The artifact and cost evidence will be stored. Uncertain outcomes will not be retried automatically.</label>
      <Button type="button" disabled={!modelId || !consent || Number(budget) < 0.001 || Number(budget) > 1 || !Number.isFinite(Number(budget))} onClick={() => {
        setConsent(false)
        onVerify({ operationId: crypto.randomUUID(), capability: "image", modelId, consent: true, maxCostUsd: Number(budget) })
      }}>Verify selected image model</Button>
    </fieldset>
  </details>
}
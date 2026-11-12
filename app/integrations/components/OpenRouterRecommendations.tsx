"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"

export function OpenRouterRecommendations({ busy, onRecommend }: { busy: boolean; onRecommend: (fields: Record<string, unknown>) => void }) {
  const [consent, setConsent] = useState(false)
  const [budget, setBudget] = useState("0.25")
  const [vendor, setVendor] = useState("")
  const [promptPrice, setPromptPrice] = useState("5")
  const [completionPrice, setCompletionPrice] = useState("20")
  const valid = Number(budget) >= 0.001 && Number(budget) <= 1 && Number(promptPrice) >= 0 && Number(promptPrice) <= 100 && Number(completionPrice) >= 0 && Number(completionPrice) <= 500
    && (!vendor || /^[a-zA-Z0-9_-]{1,80}$/.test(vendor))
  return <details className="rounded-md border p-4"><summary className="cursor-pointer text-sm font-medium">Automatic model recommendations</summary>
    <fieldset disabled={busy} className="mt-3 space-y-3">
      <p className="text-sm text-muted-foreground">A bounded AI request ranks compatible models from your account catalog. Manual pins and disabled capabilities are preserved. Quality recommendations are advisory, not live verification. No business data or tools are sent.</p>
      <Label htmlFor="openrouter-selector-budget">Maximum setup spend (USD)</Label><Input id="openrouter-selector-budget" type="number" min="0.001" max="1" step="0.01" value={budget} onChange={event => setBudget(event.target.value)} />
      <Label htmlFor="openrouter-selector-vendor">Preferred model vendor (optional)</Label><Input id="openrouter-selector-vendor" value={vendor} onChange={event => setVendor(event.target.value)} placeholder="For example: openai" />
      <Label htmlFor="openrouter-selector-prompt">Maximum input price (USD per million tokens)</Label><Input id="openrouter-selector-prompt" type="number" min="0" max="100" value={promptPrice} onChange={event => setPromptPrice(event.target.value)} />
      <Label htmlFor="openrouter-selector-completion">Maximum output price (USD per million tokens)</Label><Input id="openrouter-selector-completion" type="number" min="0" max="500" value={completionPrice} onChange={event => setCompletionPrice(event.target.value)} />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />I authorize one paid selection request on this OpenRouter account within the stated budget. No Makinari inference credits will be charged. Unknown outcomes are not automatically retried.</label>
      <Button type="button" disabled={!consent || !valid} onClick={() => {
        setConsent(false)
        onRecommend({ operationId: crypto.randomUUID(), consent: true, maxCostUsd: Number(budget), ...(vendor ? { preferredVendor: vendor } : {}), maxPromptPrice: Number(promptPrice), maxCompletionPrice: Number(completionPrice) })
      }}>Generate recommendations</Button>
    </fieldset>
  </details>
}
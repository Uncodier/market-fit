"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import type { OpenRouterCapability, OpenRouterConnectionResponse, OpenRouterModelsResponse } from "@/lib/integrations/openrouter-contract"

type Connection = NonNullable<OpenRouterConnectionResponse["connection"]>
type Props = {
  connection: Connection
  models: OpenRouterModelsResponse["models"]
  busy: boolean
  onSave: (capability: OpenRouterCapability, mode: "automatic" | "manual" | "disabled", modelId: string | null, embeddingDimensions?: number) => void
}
const labels: Record<OpenRouterCapability, string> = {
  text: "Text conversation", tools: "Tool-using agents", structured: "Structured extraction",
  vision: "Vision", summary: "Summaries", embedding: "Embeddings", image: "Images",
  speech: "Speech", transcription: "Transcription", video: "Video",
}

function catalogCandidate(id: OpenRouterCapability, model: OpenRouterModelsResponse["models"][number]) {
  const text = model.inputModalities.includes("text") && model.outputModalities.includes("text")
  switch (id) {
    case "text": case "summary": return text
    case "tools": return text && model.supportedParameters.includes("tools")
    case "structured": return text && model.supportedParameters.includes("structured_outputs")
    case "vision": return text && model.inputModalities.includes("image")
    case "embedding": return model.outputModalities.includes("embeddings")
    case "image": return model.outputModalities.includes("image")
    case "speech": return model.outputModalities.includes("audio") || model.outputModalities.includes("speech")
    case "transcription": return model.inputModalities.includes("audio") || model.outputModalities.includes("transcription")
    case "video": return model.outputModalities.includes("video")
  }
}

function ModelRow({ id, value, models, busy, onSave }: {
  id: OpenRouterCapability; value: NonNullable<Connection["capabilities"][OpenRouterCapability]>
} & Pick<Props, "models" | "busy" | "onSave">) {
  const [modelId, setModelId] = useState(value.modelId || "")
  const [search, setSearch] = useState("")
  const [mode, setMode] = useState<"automatic" | "manual" | "disabled">(value.mode)
  const [dimensions, setDimensions] = useState(String(value.embeddingDimensions ?? 1536))
  const matches = models.filter(model => catalogCandidate(id, model) && `${model.id} ${model.name}`.toLowerCase().includes(search.toLowerCase()))
  const selected = models.find(model => model.id === modelId)
  return <fieldset disabled={busy} className="space-y-3 rounded-md border p-4">
    <legend className="px-1 text-sm font-medium">{labels[id]}</legend>
    <p className="text-xs text-muted-foreground">{value.status.replaceAll("_", " ")} — {value.reason}</p>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor={`openrouter-${id}-mode`}>Routing mode</Label>
        <select id={`openrouter-${id}-mode`} className="w-full rounded-md border bg-background p-2 text-sm" value={mode} onChange={event => setMode(event.target.value as "automatic" | "manual" | "disabled")}>
          {id !== "embedding" && <option value="automatic" disabled={!value.recommendation}>Automatic recommendation</option>}
          <option value="manual">Manual model</option><option value="disabled">Disabled</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`openrouter-${id}-search`}>Search account models</Label>
        <Input id={`openrouter-${id}-search`} value={search} onChange={event => setSearch(event.target.value)} disabled={mode !== "manual"} />
      </div>
    </div>
    <Label htmlFor={`openrouter-${id}-model`}>Selected model</Label>
    <select id={`openrouter-${id}-model`} className="w-full rounded-md border bg-background p-2 text-sm" value={modelId} disabled={mode !== "manual"} onChange={event => setModelId(event.target.value)}>
      <option value="">Select a model</option>
      {modelId && !matches.some(model => model.id === modelId) && <option value={modelId}>{modelId}{selected ? "" : " (not in current catalog)"}</option>}
      {matches.map(model => <option key={model.id} value={model.id}>{model.name} · {model.id}</option>)}
    </select>
    {selected && <p className="text-xs text-muted-foreground">Input: {selected.inputModalities.join(", ")} · Output: {selected.outputModalities.join(", ")} · Context: {selected.contextLength ?? "Unknown"}</p>}
    {selected?.pricing && <p className="text-xs text-muted-foreground">Catalog pricing: {selected.pricing.prompt === undefined ? "Input unknown" : `$${selected.pricing.prompt * 1e6}/million input tokens`} · {selected.pricing.completion === undefined ? "Output unknown" : `$${selected.pricing.completion * 1e6}/million output tokens`}. Informational, not proof of external BYOK net cost.</p>}
    {value.recommendation && <p className="text-xs text-muted-foreground">AI recommendation: {value.recommendation.modelId} — {value.recommendation.reason} Per vendor: {Object.entries(value.recommendation.vendorModels).map(([vendor, model]) => `${vendor}: ${model}`).join("; ")}. Manual and disabled choices are not changed by recommendations.</p>}
    {id === "embedding" && <div className="space-y-1"><Label htmlFor="openrouter-embedding-dimensions">Existing index dimensions</Label><Input id="openrouter-embedding-dimensions" type="number" min={1} max={65536} value={dimensions} onChange={event => setDimensions(event.target.value)} /><p className="text-xs text-muted-foreground">Must match the existing index and selected model. This does not migrate stored vectors.</p></div>}
    <Button type="button" size="sm" variant="outline" disabled={mode === "manual" && !modelId} onClick={() => onSave(id, mode, mode === "automatic" ? value.recommendation?.modelId ?? null : modelId || null, id === "embedding" ? Number(dimensions) : undefined)}>Save {labels[id].toLowerCase()}</Button>
  </fieldset>
}

export function OpenRouterModels({ connection, ...props }: Props) {
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Select models manually or use a generated AI recommendation. Combined requests use the summary, vision, tool, or structured model in that priority order; the primary model must support every requested capability. Independent model pins may differ. Catalog presence does not prove funding or provider BYOK availability. Images require a successful authorized live verification before use.</p>
    {(Object.entries(connection.capabilities) as [OpenRouterCapability, NonNullable<Connection["capabilities"][OpenRouterCapability]>][])
      .map(([id, value]) => <ModelRow key={`${connection.revision}:${id}`} id={id} value={value} {...props} />)}
  </div>
}
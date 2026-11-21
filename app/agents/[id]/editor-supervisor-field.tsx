import { useEffect, useId, useMemo, useState } from "react"
import { z } from "zod"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectLabel, SelectGroup, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useLocalization } from "@/app/context/LocalizationContext"

const option = z.object({ id: z.string().uuid(), name: z.string(), role: z.string().nullable() })
const directory = z.object({ agents: z.array(option), current: option.nullish() })
type Directory = z.infer<typeof directory>
const NONE = "none"

function optionLabels(agents: Directory["agents"]) {
  const names = new Set<string>(), duplicates = new Set<string>()
  for (const agent of agents) {
    const name = agent.name.trim().toLowerCase()
    if (names.has(name)) duplicates.add(name)
    names.add(name)
  }
  return new Map(agents.map(({ id, name, role }) => {
    const label = [name.trim() || id, role].filter(Boolean).join(" · ")
    return [id, name.trim() && duplicates.has(name.trim().toLowerCase()) ? `${label} (${id})` : label]
  }))
}

type Props = {
  siteId: string; agentId: string | null; value: string | null
  disabled: boolean; onChange: (value: string | null) => void
}

export function EditorSupervisorField({ siteId, agentId, value, disabled, onChange }: Props) {
  const { t } = useLocalization()
  const id = useId()
  // The editor remounts on site/route changes. Only resolve immediately when there's a value to display.
  const [attempt, setAttempt] = useState(value ? 1 : 0)
  const [result, setResult] = useState<Directory | "failed" | null>(null)
  useEffect(() => {
    if (!attempt) return
    const request = new AbortController()
    async function load() {
      const params = new URLSearchParams({ siteId })
      if (agentId) params.set("agentId", agentId)
      try {
        const response = await fetch(`/api/agents/supervisors?${params}`, {
          credentials: "same-origin", cache: "no-store", signal: request.signal,
        })
        if (!response.ok) throw new Error("Supervisor options unavailable")
        const data = directory.parse(await response.json())
        if (!request.signal.aborted) setResult(data)
      } catch {
        if (!request.signal.aborted) setResult("failed")
      }
    }
    void load()
    return () => request.abort()
  }, [siteId, agentId, attempt])

  const data = result === "failed" ? null : result
  const labels = useMemo(() => optionLabels(data?.agents ?? []), [data])
  const loading = result === null && attempt > 0
  const current = value && data?.current?.id === value ? data.current : null
  const missingLabel = [current?.name, t("agents.hierarchy.missingSupervisor")].filter(Boolean).join(" · ")
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>{t("agents.hierarchy.field")}</Label>
    <Select value={value ?? NONE} disabled={disabled}
      onOpenChange={(open) => { if (open && !attempt) setAttempt(1) }}
      onValueChange={(next) => {
        if (next === NONE) onChange(null)
        else if (labels.has(next)) onChange(next)
      }}>
      <SelectTrigger id={id} aria-describedby={`${id}-hint`} aria-busy={loading}><SelectValue /></SelectTrigger>
      <SelectContent className="max-w-[calc(100vw-2rem)]">
        <SelectGroup>
          {loading && <SelectLabel>{t("common.loading")}</SelectLabel>}
          {result === "failed" && <SelectLabel>{t("agents.hierarchy.unavailableOptions")}</SelectLabel>}
          <SelectItem value={NONE}>{t("agents.hierarchy.noSupervisor")}</SelectItem>
          {value && !labels.has(value) && <SelectItem value={value} disabled>{loading ? t("common.loading") : missingLabel}</SelectItem>}
          {Array.from(labels, ([agent, label]) => <SelectItem key={agent} value={agent}>{label}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
    <p id={`${id}-hint`} className="text-sm text-muted-foreground">{t("agents.hierarchy.hint")}</p>
    {result === "failed" && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {t("agents.hierarchy.unavailableOptions")}
      <Button variant="outline" type="button" size="sm" disabled={disabled} onClick={() => {
        setResult(null); setAttempt((n) => n + 1)
      }}>{t("common.retry")}</Button>
    </div>}
  </div>
}
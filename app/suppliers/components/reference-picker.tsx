"use client"

import { useEffect, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { RelationSelect } from "@/app/components/ui/relation-select"
import { Badge } from "@/app/components/ui/badge"

export function SupplierReferencePicker({ siteId, kind, selected, onChange, disabled = false }: {
  siteId: string; kind: "companies" | "categories"; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean
}) {
  const [search, setSearch] = useState("")
  const [options, setOptions] = useState<{ id: string; name: string }[]>([])
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true); setError("")
      try {
        const response = await fetch(`/api/procurement/suppliers/references?site_id=${siteId}&kind=${kind}&q=${encodeURIComponent(search)}`, {
          signal: controller.signal, cache: "no-store",
        })
        if (!response.ok) throw new Error("Reference search is unavailable")
        const data = await response.json()
        if (controller.signal.aborted) return
        setOptions(data.options); setMore(data.has_more)
        setLabels(previous => ({ ...previous, ...Object.fromEntries(data.options.map((option: { id: string; name: string }) => [option.id, option.name])) }))
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Reference search failed")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [siteId, kind, search])
  return <section className="space-y-2">
    <RelationSelect label={kind === "companies" ? "Company registry (optional)" : "Supplier categories"}
      disabled={disabled} allowCreate={false} clearAfterSelect={kind === "categories"}
      value={kind === "companies" && selected[0] ? { mode: "existing", id: selected[0], label: labels[selected[0]] ?? "Linked company" } : null}
      options={options.filter(option => kind === "companies" || !selected.includes(option.id)).map(option => ({ id: option.id, label: option.name }))}
      onSearchChange={setSearch} placeholder={`Search ${kind}`} emptyMessage={error ? "Reference search unavailable" : loading ? "Searching…" : `No matching ${kind}`}
      onValueChange={value => { if (value?.mode === "existing") onChange(kind === "companies" ? [value.id] : [...selected, value.id]); else if (kind === "companies") onChange([]) }} />
    {kind === "categories" && <ul className="flex flex-wrap gap-2">{selected.map(value => <li key={value}>
      <Badge variant="secondary">{labels[value] ?? "Linked category"}
      <Button disabled={disabled} type="button" variant="ghost" size="sm" aria-label={`Remove ${labels[value] ?? value}`} onClick={() => onChange(selected.filter(item => item !== value))}>Remove</Button></Badge>
    </li>)}</ul>}
    {loading && <p role="status" className="text-sm">Searching…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {more && <p className="text-sm text-muted-foreground">Showing the first 50 matches. Refine your search.</p>}
  </section>
}
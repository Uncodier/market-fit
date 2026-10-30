"use client"

import { useEffect, useState } from "react"
import { isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'
import { demoProcurementReferences } from '@/lib/demo-data/procurement-suppliers'
import { Button } from "@/app/components/ui/button"
import { RelationSelect } from "@/app/components/ui/relation-select"
import { Badge } from "@/app/components/ui/badge"
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

export function SupplierReferencePicker({ siteId, kind, selected, onChange, disabled = false, compact = false, displayOnly = false }: {
  siteId: string; kind: "companies" | "categories"; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean; compact?: boolean; displayOnly?: boolean
}) {
  const { t, message } = useProcurementI18n()
  const [search, setSearch] = useState("")
  const [options, setOptions] = useState<{ id: string; name: string }[]>([])
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [more, setMore] = useState(false)
  useEffect(() => {
    if (isDemoSiteId(siteId)) {
      const timer = setTimeout(() => {
        const choices = demoProcurementReferences[kind]
        setOptions(choices.filter(item => item.label.toLowerCase().includes(search.toLowerCase())).map(item => ({ id: item.id, name: item.label })))
        setLabels(Object.fromEntries(choices.map(item => [item.id, item.label])))
        setLoading(false); setMore(false); setError('')
      }, 0)
      return () => clearTimeout(timer)
    }
    if (isDemoModeActive()) return
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
        if (!Array.isArray(data.options)) throw new Error('Reference search failed')
        setOptions(data.options); setMore(data.has_more)
        setLabels(previous => ({ ...previous, ...Object.fromEntries(data.options.map((option: { id: string; name: string }) => [option.id, option.name])) }))
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Reference search failed")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [siteId, kind, search])
  if (displayOnly) return <span className="block min-w-0 break-words text-sm">
    {selected.length ? selected.map(id => labels[id] ?? t(kind === "companies" ? 'procurement.partners.references.linkedCompany' : 'procurement.partners.references.linkedCategory')).join(', ') : "Not specified"}
  </span>
  return <section className={compact ? "min-w-0 space-y-1 [&_label]:sr-only [&>div]:space-y-0" : "space-y-2"}>
    <RelationSelect className={compact ? "h-7 rounded-none border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0" : undefined} label={t(`procurement.partners.references.${kind}Label`)}
      searchPlaceholder={t('procurement.common.search')}
      clearLabel={t('procurement.common.clearSelection')} loadingLabel={t('procurement.common.loadingSelection')}
      disabled={disabled} allowCreate={false} clearAfterSelect={kind === "categories"}
      value={kind === "companies" && selected[0] ? { mode: "existing", id: selected[0], label: labels[selected[0]] ?? t('procurement.partners.references.linkedCompany') } : null}
      options={options.filter(option => kind === "companies" || !selected.includes(option.id)).map(option => ({ id: option.id, label: option.name }))}
      onSearchChange={setSearch} placeholder={t(`procurement.partners.references.${kind}Search`)} emptyMessage={error ? t('procurement.partners.references.unavailable') : loading ? t('procurement.partners.references.searching') : t(`procurement.partners.references.${kind}Empty`)}
      onValueChange={value => { if (value?.mode === "existing") onChange(kind === "companies" ? [value.id] : [...selected, value.id]); else if (kind === "companies") onChange([]) }} />
    {kind === "categories" && <ul className="flex flex-wrap gap-2">{selected.map(value => <li key={value}>
      <Badge variant="secondary" className={compact ? "gap-1 px-2 py-0.5 text-xs" : undefined}>{labels[value] ?? t('procurement.partners.references.linkedCategory')}
      <Button disabled={disabled} type="button" variant="ghost" size="sm" aria-label={t('procurement.partners.actions.removeNamed', { name: labels[value] ?? value })} onClick={() => onChange(selected.filter(item => item !== value))}>{t('procurement.partners.actions.remove')}</Button></Badge>
    </li>)}</ul>}
    {loading && <p role="status" className="text-sm">{t('procurement.partners.references.searching')}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error === 'Reference search failed' ? t('procurement.partners.errors.referenceSearch') : message(error)}</p>}
    {more && <p className="text-sm text-muted-foreground">{t('procurement.partners.references.more')}</p>}
  </section>
}
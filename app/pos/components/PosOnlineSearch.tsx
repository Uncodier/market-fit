"use client"

import { useEffect, useState } from "react"
import type { CatalogItem } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { searchPosCatalog } from "../actions/search-catalog"
import type { PosItemAvailability } from "../cart-availability"

type Props = {
  siteId?: string
  query: string
  online: boolean
  hydrated: boolean
  catalogItems: CatalogItem[]
  localResultIds: string[]
  selectedCategory: string
  getAvailability: (item: CatalogItem) => PosItemAvailability
  onAdd: (item: CatalogItem) => void
}

/** Online IDs never become cart items: only complete, synchronized local items can be selected. */
export function PosOnlineSearch({ siteId, query, online, hydrated, catalogItems, localResultIds,
  selectedCategory, getAvailability, onAdd }: Props) {
  const term = query.trim()
  const key = `${siteId}:${term}`
  const [state, setState] = useState<{ key: string; result: Awaited<ReturnType<typeof searchPosCatalog>> }>()
  useEffect(() => {
    if (!siteId || siteId.startsWith("demo-") || !term || term.length > 200 || !online) return
    let current = true
    const timer = setTimeout(() => {
      void searchPosCatalog(siteId, term).then(result => {
        if (current) setState({ key, result })
      }).catch(() => {
        if (current) setState({ key, result: { items: [], error: "Online search is unavailable. Local search still works." } })
      })
    }, 350)
    return () => { current = false; clearTimeout(timer) }
  }, [siteId, term, online, key])

  if (!term || !siteId || siteId.startsWith("demo-")) return null
  const result = state?.key === key ? state.result : undefined
  const local = new Map(catalogItems.filter(item => item.site_id === siteId).map(item => [item.id, item]))
  const suggestions = (result?.items || []).filter(item => !localResultIds.includes(item.id))
  return (
    <section className="border-t p-4 space-y-3" aria-label="Online catalog suggestions">
      <h2 className="text-sm font-medium">Online suggestions</h2>
      <p className="text-xs text-muted-foreground">Ranked suggestions, separate from instant local name/SKU matches. Sync is required before selling a new or changed item.</p>
      {!online ? <p className="text-sm">Offline — local search remains available.</p>
        : term.length > 200 ? <p role="status">Use at most 200 characters for online search.</p>
        : !result ? <p role="status">Searching online…</p>
        : "error" in result ? <p role="status">{result.error}</p>
        : suggestions.length === 0 ? <p className="text-sm">No additional online suggestions.</p>
        : <div className="flex flex-wrap gap-2">{suggestions.map(suggestion => {
          const item = local.get(suggestion.id)
          const categoryMatches = selectedCategory === "all" || selectedCategory === "unavailable" ||
            (selectedCategory.startsWith("kind_") ? item?.kind === selectedCategory.slice(5) : item?.category_id === selectedCategory)
          if (item && !categoryMatches) return null
          const synced = hydrated && item && item.updated_at === suggestion.updated_at &&
            item.status === "active" && item.is_pos_available !== false && !item.parent_id
          const available = synced && getAvailability(item).sellable
          return <Button key={suggestion.id} variant="outline" disabled={!available}
            onClick={() => { if (available && item) onAdd(item) }}>
            {suggestion.name}{!synced ? " — Sync catalog to use" : !available ? " — Unavailable" : ""}
          </Button>
        })}</div>}
    </section>
  )
}
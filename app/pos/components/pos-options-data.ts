"use client"

import { useEffect, useMemo, useState } from "react"
import type { CatalogItem } from "@/app/types"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import { resolveVariantAxesForDisplay } from "@/app/catalog/variant-resolve"
import { getPosItemChildren, getPosItemModifierGroups } from "@/app/pos/item-options"
import { getPosDb } from "@/app/pos/local/db"
import { createClient } from "@/lib/supabase/client"

type Sources = {
  item: CatalogItem | null
  open: boolean
  siteId?: string
  catalogItems?: CatalogItem[]
  modifierGroupsByHostId?: Record<string, ModifierGroupWithItems[]>
}

type Fallback = {
  sources: Sources
  children: CatalogItem[]
  groups: ModifierGroupWithItems[]
  failed: boolean
}

async function loadChildren(item: CatalogItem, signal: AbortSignal): Promise<CatalogItem[]> {
  const { data, error } = await createClient().from("catalog_items").select("*")
    .eq("site_id", item.site_id).eq("parent_id", item.id)
    .eq("status", "active").eq("is_purchasable", true).abortSignal(signal)
  if (error) throw new Error("Unable to load item variants")
  return getPosItemChildren(item, (data || []) as CatalogItem[])
}

async function loadGroups(item: CatalogItem, siteId?: string): Promise<ModifierGroupWithItems[]> {
  const cacheSiteId = siteId || item.site_id
  if (!cacheSiteId) throw new Error("Missing catalog cache scope")
  const meta = await getPosDb().meta.get(cacheSiteId)
  if (!meta?.modifierGroupsByHostId) throw new Error("Modifier cache is unavailable")
  return getPosItemModifierGroups(item, meta.modifierGroupsByHostId)
}

/** Defined snapshot sources are authoritative, including empty arrays and maps. */
export function usePosOptionsData(sources: Sources) {
  const { item, open, siteId, catalogItems, modifierGroupsByHostId } = sources
  const [fallback, setFallback] = useState<Fallback | null>(null)
  const cachedVariants = useMemo(() => item && catalogItems !== undefined
    ? resolveVariantAxesForDisplay(item, getPosItemChildren(item, catalogItems)) : null,
  [item, catalogItems])
  const cachedGroups = useMemo(() => item && modifierGroupsByHostId !== undefined
    ? getPosItemModifierGroups(item, modifierGroupsByHostId) : null,
  [item, modifierGroupsByHostId])
  const complete = cachedVariants !== null && cachedGroups !== null

  useEffect(() => {
    if (!open || !item || complete) return
    const controller = new AbortController()
    let cancelled = false
    const scope = { item, open, siteId, catalogItems, modifierGroupsByHostId }
    void (async () => {
      try {
        const [children, groups] = await Promise.all([
          catalogItems !== undefined ? Promise.resolve([]) : loadChildren(item, controller.signal),
          modifierGroupsByHostId !== undefined ? Promise.resolve([]) : loadGroups(item, siteId),
        ])
        if (!cancelled) setFallback({ sources: scope, children, groups, failed: false })
      } catch {
        if (!cancelled) setFallback({ sources: scope, children: [], groups: [], failed: true })
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [open, item, complete, siteId, catalogItems, modifierGroupsByHostId])

  // Ignore results from older items, sites, or replaced snapshots before effects run.
  const current = fallback?.sources.item === item && fallback.sources.open === open &&
    fallback.sources.siteId === siteId && fallback.sources.catalogItems === catalogItems &&
    fallback.sources.modifierGroupsByHostId === modifierGroupsByHostId ? fallback : null
  const variants = useMemo(() => cachedVariants || (item && current && !current.failed
    ? resolveVariantAxesForDisplay(item, current.children) : { axes: [], children: [] }),
  [cachedVariants, item, current])
  return {
    ...variants,
    modifierGroups: cachedGroups ?? current?.groups ?? [],
    loading: Boolean(open && item && !complete && !current),
    error: !complete && current?.failed === true,
  }
}
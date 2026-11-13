"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { listCatalogItems } from "@/app/catalog/actions"
import { RelationSelect, type RelationSelectValue } from "@/app/components/ui/relation-select"
import { Button } from "@/app/components/ui/button"
import { demoItems } from "../demo-data"

const PAGE_SIZE = 50

/** Search results are discovery only; the draft owns selection and the server validates it. */
export function MovementCatalogSelect({ siteId, actorId, open, demo, disabled, label, value, onValueChange }: {
  siteId?: string; actorId?: string; open: boolean; demo: boolean; disabled: boolean;
  label: string; value: RelationSelectValue; onValueChange: (value: RelationSelectValue) => void
}) {
  const [navigation, setNavigation] = useState({ query: "", page: 1, searchId: undefined as string | undefined })
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [generation, setGeneration] = useState(0)
  const { query, page, searchId } = navigation
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(timer)
  }, [query])
  const active = open && !!siteId && !!actorId && !demo && !disabled
  const debouncing = query !== debouncedQuery
  const { data, error, isLoading, mutate } = useSWR(
    active && !debouncing ? ["movement-catalog-page", actorId, siteId, query.trim(), page, searchId, generation] : null,
    async () => {
      // Do not use kind: product: that filter excludes child variants.
      const result = await listCatalogItems({ siteId: siteId!, kind: "all", q: query.trim(), page, pageSize: PAGE_SIZE, ...(searchId ? { search_id: searchId } : {}) })
      if (result.error) throw Object.assign(new Error(result.error), { status: result.error_status })
      return result
    },
    { revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: false },
  )
  const loading = active && (debouncing || isLoading)
  const choices = demo ? demoItems : loading || error ? [] : data?.data || []
  const options = choices.map(item => ({
    id: item.id,
    label: `${item.name}${item.sku ? ` (${item.sku})` : ""}`,
    // RelationSelect filters locally. Keep the server's ranked/semantic matches visible.
    searchText: demo ? undefined : query,
    group: !demo && data?.result_kind === "related" ? "Related results" : undefined,
  }))
  const changeSearch = (next: string) => setNavigation({ query: next, page: 1, searchId: undefined })
  const hasMore = data?.has_more ?? page * PAGE_SIZE < (data?.count || 0)
  const changePage = (next: number) => setNavigation({ query, page: next, searchId: query.trim() ? data?.search_id : undefined })

  return <div className="space-y-2">
    <RelationSelect label={label} options={options} value={value}
      onSearchChange={changeSearch}
      onValueChange={next => { if (!disabled) { changeSearch(""); onValueChange(next) } }}
      allowCreate={false} disabled={disabled || (loading && !query && !value)}
      placeholder="Select an item" emptyMessage={loading ? "Loading catalog items..." : error ? "Unable to load catalog items" : "No items found"} />
    {error && <div role="alert" className="text-sm text-destructive">
      {error.message}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => {
        if (error.status === 409) {
          setNavigation({ query, page: 1, searchId: undefined })
          setGeneration(current => current + 1)
        } else void mutate()
      }}>Retry catalog search</Button>
    </div>}
    {!demo && !disabled && !error && !loading && data && (page > 1 || hasMore) && <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={page === 1} onClick={() => changePage(page - 1)}>Previous catalog page</Button>
      <span className="text-sm">Page {page}</span>
      <Button type="button" variant="outline" size="sm" disabled={!hasMore} onClick={() => changePage(page + 1)}>Next catalog page</Button>
    </div>}
    {!loading && !error && data?.candidate_window_truncated && <p className="text-xs text-muted-foreground">Showing a ranked search window. Refine your search for more items.</p>}
  </div>
}

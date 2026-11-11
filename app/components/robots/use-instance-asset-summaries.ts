"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { InstanceAssetPreview } from "./instance-browser-model"

export interface InstanceAssetSummary {
  instance_id: string
  asset_count: number
  recent_assets: InstanceAssetPreview[]
  avatar_path: string | null
}

const BATCH_SIZE = 100
const REFRESH_MS = 60_000
const REQUEST_TIMEOUT_MS = 10_000

/** Per-consumer, tenant-bound cache: never share user-scoped rows across sessions. */
export function useInstanceAssetSummaries(siteId: string | undefined, ids: string[], enabled: boolean) {
  const idsKey = JSON.stringify([...new Set(ids)].sort())
  const cache = useRef(new Map<string, { row: InstanceAssetSummary; expires: number }>())
  const [snapshot, setSnapshot] = useState<{ siteId?: string; rows: Record<string, InstanceAssetSummary> }>({ rows: {} })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useRef<AbortController | null>(null)
  const [revision, setRevision] = useState(0)
  const retry = useCallback(() => { active.current?.abort(); cache.current.clear(); setRevision(value => value + 1) }, [])

  useEffect(() => {
    let userId: string | null | undefined
    const subscription = createClient().auth?.onAuthStateChange?.((event: string, session: { user: { id: string } } | null) => {
      const nextUserId = session?.user.id || null
      const changed = userId !== undefined && userId !== nextUserId
      const firstSignIn = userId === undefined && event === "SIGNED_IN"
      userId = nextUserId
      if (event === "SIGNED_OUT" || changed || firstSignIn || event === "USER_UPDATED") {
        active.current?.abort()
        cache.current.clear()
        setSnapshot({ rows: {} })
        setRevision(value => value + 1)
      }
    })
    return () => subscription?.data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!enabled || !siteId) {
      cache.current.clear()
      let current = true
      queueMicrotask(() => {
        if (current) { setSnapshot({ rows: {} }); setError(null); setIsLoading(false) }
      })
      return () => { current = false }
    }
    const instanceIds: string[] = JSON.parse(idsKey)
    const lifecycle = new AbortController()
    active.current = lifecycle
    let running = false
    let retryAfter = 0
    const supabase = createClient()
    const key = (id: string) => `${siteId}:${id}`
    // Prune old tenants and deleted instances; completed batches survive ID updates.
    const wanted = new Set(instanceIds.map(key))
    for (const entry of cache.current.keys()) if (!wanted.has(entry)) cache.current.delete(entry)
    const publish = () => {
      if (lifecycle.signal.aborted) return
      const rows: Record<string, InstanceAssetSummary> = {}
      for (const id of instanceIds) {
        const entry = cache.current.get(key(id))
        if (entry) rows[id] = entry.row
      }
      setSnapshot({ siteId, rows })
    }
    const load = async () => {
      if (running || lifecycle.signal.aborted || Date.now() < retryAfter) return
      const missing = instanceIds.filter(id => (cache.current.get(key(id))?.expires || 0) <= Date.now())
      if (missing.length === 0) return
      running = true
      setIsLoading(true)
      setError(null)
      try {
        for (let offset = 0; offset < missing.length; offset += BATCH_SIZE) {
          if (lifecycle.signal.aborted) return
          const batch = missing.slice(offset, offset + BATCH_SIZE)
          const request = new AbortController()
          const abort = () => request.abort()
          lifecycle.signal.addEventListener("abort", abort, { once: true })
          const timer = setTimeout(abort, REQUEST_TIMEOUT_MS)
          try {
            const { data, error: queryError } = await supabase.rpc("get_instance_asset_summaries", {
              p_site_id: siteId, p_instance_ids: batch,
            }).abortSignal(request.signal)
            if (lifecycle.signal.aborted) return
            if (request.signal.aborted || queryError) throw new Error("Asset summaries unavailable")
            const rows = (data || []) as InstanceAssetSummary[]
            for (const row of rows) {
              if (batch.includes(row.instance_id)) cache.current.set(key(row.instance_id), { row, expires: Date.now() + REFRESH_MS })
            }
            // Omitted rows are inaccessible/missing, never invented successful empties.
            for (const id of batch) if (!rows.some(row => row.instance_id === id)) cache.current.delete(key(id))
            publish()
          } finally {
            clearTimeout(timer)
            lifecycle.signal.removeEventListener("abort", abort)
          }
        }
      } catch {
        if (!lifecycle.signal.aborted) {
          cache.current.clear()
          setSnapshot({ siteId, rows: {} })
          setError("Asset summaries unavailable")
          retryAfter = Date.now() + REFRESH_MS
        }
      } finally {
        running = false
        if (!lifecycle.signal.aborted) setIsLoading(false)
      }
    }
    publish()
    void load()
    const refresh = () => { if (document.visibilityState === "visible") void load() }
    // Check expiration frequently without fetching fresh rows or overlapping work.
    const timer = setInterval(refresh, 5_000)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      lifecycle.abort()
      clearInterval(timer)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [enabled, siteId, idsKey, revision])

  const summaries = useMemo(() => snapshot.siteId === siteId && enabled ? snapshot.rows : {}, [snapshot, siteId, enabled])
  return { summaries, isLoading: enabled && isLoading, error, retry }
}

export function resolveInstanceAssetUrl(path: string | null): string | null {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return createClient().storage.from("assets").getPublicUrl(path).data.publicUrl || null
}
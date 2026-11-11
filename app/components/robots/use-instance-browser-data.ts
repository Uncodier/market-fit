"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { WF_LOAD_NODE_TYPES } from "@/app/components/workflows/types"
import {
  countInstanceNodeRows,
  type InstanceMessages,
  type InstanceNodeRow,
  type InstanceStats,
} from "./instance-browser-model"
import { resolveInstanceAssetUrl, useInstanceAssetSummaries } from "./use-instance-asset-summaries"

const CHUNK_SIZE = 4
const NODE_QUERY_CHUNK_SIZE = 100
const NODE_PAGE_SIZE = 1000

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

async function fetchInstanceNodeRows(instanceIds: string[], signal: AbortSignal): Promise<InstanceNodeRow[]> {
  const supabase = createClient()
  const chunks = chunkValues(instanceIds, NODE_QUERY_CHUNK_SIZE)
  const results: InstanceNodeRow[][] = []
  for (const chunk of chunks) {
    const rows: InstanceNodeRow[] = []

    for (let offset = 0; ; offset += NODE_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("instance_nodes")
        .select("instance_id, type")
        .in("instance_id", chunk)
        .order("id", { ascending: true })
        .range(offset, offset + NODE_PAGE_SIZE - 1)
        .abortSignal(signal)

      if (error) throw error

      const page = (data || []) as InstanceNodeRow[]
      rows.push(...page)
      if (page.length < NODE_PAGE_SIZE) break
    }

    results.push(rows)
  }

  return results.flat()
}

export function useInstanceBrowserData(isOpen: boolean, instances: Array<{ id: string }>, siteId?: string) {
  const idsKey = JSON.stringify([...new Set(instances.map(instance => instance.id))].sort())
  const { summaries, isLoading: isLoadingAssets, error: assetsError, retry: retryAssets } = useInstanceAssetSummaries(siteId, instances.map(instance => instance.id), isOpen)
  const [snapshot, setSnapshot] = useState<{ siteId?: string; stats: Record<string, InstanceStats>; messages: Record<string, InstanceMessages> }>({ stats: {}, messages: {} })
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const retryData = useCallback(() => setRevision(value => value + 1), [])

  useEffect(() => {
    if (!isOpen || !siteId) return
    const lifecycle = new AbortController()
    const supabase = createClient()
    const instanceIds: string[] = JSON.parse(idsKey)
    let running = false
    let lastCompleted = 0
    const load = async () => {
      if (running || lifecycle.signal.aborted) return
      running = true
      setIsLoadingStats(true)
      setIsLoadingMessages(true)
      setDataError(null)
      const request = new AbortController()
      const abort = () => request.abort()
      lifecycle.signal.addEventListener("abort", abort, { once: true })
      const timeout = setTimeout(abort, 30_000)
      const current = () => !lifecycle.signal.aborted && !request.signal.aborted
      const update = (apply: (previous: typeof snapshot) => typeof snapshot) => {
        if (current()) setSnapshot(previous => apply(previous.siteId === siteId ? previous : { siteId, stats: {}, messages: {} }))
      }
      const stats = async () => {
        try {
          const rows = await fetchInstanceNodeRows(instanceIds, request.signal)
          const counts = countInstanceNodeRows(instanceIds, rows, WF_LOAD_NODE_TYPES)
          update(previous => ({ ...previous, stats: Object.fromEntries(instanceIds.map(id => [id, {
            ...previous.stats[id], ...counts[id], recentAssets: [], avatarUrl: null,
          }])) }))
          for (let offset = 0; offset < instanceIds.length; offset += CHUNK_SIZE) {
            if (!current()) return
            const results = await Promise.all(instanceIds.slice(offset, offset + CHUNK_SIZE).map(async id => {
              const result = await supabase.from("requirement_status").select("id", { count: "exact", head: true })
                .eq("instance_id", id).eq("site_id", siteId).abortSignal(request.signal)
              if (result.error || request.signal.aborted) throw new Error("Instance counts unavailable")
              return { id, count: result.count || 0 }
            }))
            update(previous => ({ ...previous, stats: { ...previous.stats,
              ...Object.fromEntries(results.map(result => [result.id, { ...previous.stats[result.id], requirements: result.count }])) } }))
          }
        } catch {
          if (!lifecycle.signal.aborted) {
            setDataError("Instance details unavailable")
            setSnapshot(previous => ({ ...previous, stats: {} }))
          }
        } finally { if (!lifecycle.signal.aborted) setIsLoadingStats(false) }
      }
      const messages = async () => {
        try {
          for (let offset = 0; offset < instanceIds.length; offset += CHUNK_SIZE) {
            if (!current()) return
            const results = await Promise.all(instanceIds.slice(offset, offset + CHUNK_SIZE).map(async id => {
              const [user, agent] = await Promise.all([
                supabase.from("instance_logs").select("message, details, created_at").eq("instance_id", id).eq("log_type", "user_action").order("created_at", { ascending: false }).limit(1).abortSignal(request.signal),
                supabase.from("instance_logs").select("message, details, created_at").eq("instance_id", id).in("log_type", ["agent_action", "system"]).order("created_at", { ascending: false }).limit(1).abortSignal(request.signal),
              ])
              if (user.error || agent.error || request.signal.aborted) throw new Error("Instance messages unavailable")
              return { id, row: { user: user.data?.[0] || null, agent: agent.data?.[0] || null } }
            }))
            update(previous => ({ ...previous, messages: { ...previous.messages, ...Object.fromEntries(results.map(result => [result.id, result.row])) } }))
          }
        } catch {
          if (!lifecycle.signal.aborted) {
            setDataError("Instance details unavailable")
            setSnapshot(previous => ({ ...previous, messages: {} }))
          }
        } finally { if (!lifecycle.signal.aborted) setIsLoadingMessages(false) }
      }
      try { await Promise.all([stats(), messages()]) }
      finally {
        clearTimeout(timeout)
        lifecycle.signal.removeEventListener("abort", abort)
        running = false
        lastCompleted = Date.now()
      }
    }
    void load()
    const refresh = () => {
      if (document.visibilityState === "visible" && Date.now() - lastCompleted >= 60_000) void load()
    }
    const interval = setInterval(refresh, 5_000)
    document.addEventListener("visibilitychange", refresh)
    return () => { lifecycle.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", refresh) }
  }, [isOpen, idsKey, siteId, revision])

  const instanceStats = useMemo(() => {
    if (!isOpen || snapshot.siteId !== siteId) return {}
    const ids: string[] = JSON.parse(idsKey)
    return Object.fromEntries(ids.filter(id => snapshot.stats[id]).map(id => [id, snapshot.stats[id]]))
  }, [snapshot, siteId, isOpen, idsKey])
  const instanceMessages = useMemo(() => {
    if (!isOpen || snapshot.siteId !== siteId) return {}
    const ids: string[] = JSON.parse(idsKey)
    return Object.fromEntries(ids.filter(id => snapshot.messages[id]).map(id => [id, snapshot.messages[id]]))
  }, [snapshot, siteId, isOpen, idsKey])

  const mergedStats = useMemo(() => {
    const next = { ...instanceStats }
    for (const [id, summary] of Object.entries(summaries)) {
      next[id] = { ...next[id], assets: summary.asset_count,
        recentAssets: summary.recent_assets, avatarUrl: resolveInstanceAssetUrl(summary.avatar_path) }
    }
    return next
  }, [instanceStats, summaries])
  return { instanceMessages, instanceStats: mergedStats, isLoadingStats: isLoadingStats || isLoadingAssets, isLoadingMessages, assetsError, retryAssets, dataError, retryData }
}

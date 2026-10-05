"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AggregatedTrendsResponse, TrendItem } from "@/app/types/trends"
import { trendsManager } from "@/app/services/trends-service"
import { selectTrends, TRENDS_PLATFORMS, type TrendsSegments, type TrendsSort } from "./trends-presentation"

interface TrendsState {
  key: string
  trends: TrendItem[]
  lastUpdated: string
  platformErrors: NonNullable<AggregatedTrendsResponse['platformErrors']>
  error?: string
  status: 'loading' | 'success' | 'failed'
}

const EMPTY_STATE: TrendsState = {
  key: '', trends: [], lastUpdated: '', platformErrors: {}, status: 'loading'
}

interface TrendsResultsOptions {
  currentSiteId?: string
  segments?: TrendsSegments
  // Callers can gate loading while resolving site/segment context; [] is valid.
  contextReady?: boolean
  sortBy: TrendsSort
  view: 'section' | 'column'
}

export function useTrendsResults({ currentSiteId, segments, contextReady = true, sortBy, view }: TrendsResultsOptions) {
  // Value-based identity avoids requests caused only by a parent's new array reference.
  const segmentsKey = JSON.stringify((segments ?? []).map(({ id, name, description }) => ({ id, name, description })))
  const stableSegments = useMemo<TrendsSegments>(() => JSON.parse(segmentsKey), [segmentsKey])
  const canRequest = Boolean(currentSiteId && currentSiteId !== 'default' && contextReady)
  const contextKey = JSON.stringify([currentSiteId, canRequest, segmentsKey, sortBy, view])
  const [state, setState] = useState<TrendsState>(EMPTY_STATE)
  const requestId = useRef(0)
  if (state.key !== contextKey) {
    setState({ ...EMPTY_STATE, key: contextKey })
  }

  const load = useCallback(async (forceRefresh: boolean) => {
    if (!canRequest) return
    const id = ++requestId.current
    // Defer work so a replaced/unmounted context never starts a request.
    await Promise.resolve()
    if (id !== requestId.current) return
    try {
      const result = await trendsManager.getAllTrends(TRENDS_PLATFORMS, stableSegments, {
        limitPerPlatform: view === 'section' ? 15 : 10,
        sortBy,
        forceRefresh
      })
      if (id !== requestId.current) return
      const platformErrors = result.platformErrors ?? {}
      const data = result.data
      const failed = !result.success || !data || TRENDS_PLATFORMS.every(platform => Boolean(platformErrors[platform]))
      setState({
        key: contextKey,
        status: failed ? 'failed' : 'success',
        trends: failed || !data ? [] : selectTrends(data.trends, view),
        lastUpdated: failed || !data ? '' : data.lastUpdated,
        platformErrors,
        error: failed ? result.error || 'Unable to load trends. Please try again.' : undefined
      })
    } catch {
      if (id !== requestId.current) return
      // Unexpected transport failures are local UI state, not repeated notifications.
      setState({ ...EMPTY_STATE, key: contextKey, status: 'failed', error: 'Unable to load trends. Please try again.' })
    }
  }, [canRequest, contextKey, stableSegments, sortBy, view])

  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active) void load(false) })
    return () => {
      active = false
      requestId.current += 1
    }
  }, [load])

  const refresh = () => {
    if (!canRequest) return
    setState({ ...EMPTY_STATE, key: contextKey })
    void load(true)
  }

  // Hide old-context data immediately, before effects run (including open details).
  const visible = canRequest && state.key === contextKey ? state : EMPTY_STATE
  return { ...visible, contextKey, canRequest, isLoading: canRequest && visible.status === 'loading', refresh }
}
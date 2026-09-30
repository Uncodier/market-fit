"use client"

import { useEffect, useState } from "react"
import { fetchIcpMiningLists, ICP_MINING_LIST_ERROR, type IcpMiningList } from "./icp-mining-lists"

type ListState = { siteId?: string; lists: IcpMiningList[]; loading: boolean; error: string }

export function useIcpMiningLists(siteId?: string) {
  const [state, setState] = useState<ListState>({ lists: [], loading: false, error: "" })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setState({ siteId, lists: [], loading: !!siteId, error: "" })
    if (siteId) void fetchIcpMiningLists(siteId, controller.signal).then(
      lists => { if (!controller.signal.aborted) setState({ siteId, lists, loading: false, error: "" }) },
      () => { if (!controller.signal.aborted) setState({ siteId, lists: [], loading: false, error: ICP_MINING_LIST_ERROR }) },
    )
    return () => controller.abort()
  }, [siteId, revision])

  // Hide old-site options synchronously, before the new site's effect starts.
  const current = state.siteId === siteId ? state : { lists: [], loading: !!siteId, error: "" }
  return { ...current, retry: () => setRevision(value => value + 1) }
}
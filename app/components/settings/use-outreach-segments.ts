"use client"

import { useEffect, useState } from "react"
import { fetchOutreachSegments, type OutreachSegment } from "./outreach-segments"

export function useOutreachSegments(siteId?: string) {
  const [state, setState] = useState<{ siteId?: string; segments: OutreachSegment[]; loading: boolean; error: string }>({ segments: [], loading: true, error: "" })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    setState({ siteId, segments: [], loading: !!siteId, error: "" })
    if (siteId) fetchOutreachSegments(siteId).then(
      segments => { if (!cancelled) setState({ siteId, segments, loading: false, error: "" }) },
      () => { if (!cancelled) setState({ siteId, segments: [], loading: false, error: "Unable to load this site's segments. Please try again." }) },
    )
    return () => { cancelled = true }
  }, [siteId, revision])
  // Do not show another site's segments during the render before the effect runs.
  return { ...(state.siteId === siteId ? state : { segments: [], loading: true, error: "" }), retry: () => setRevision(value => value + 1) }
}
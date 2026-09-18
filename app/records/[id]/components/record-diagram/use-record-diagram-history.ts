"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { RecordDiagramDraft } from "@/app/records/lib/record-diagram"

type CommitOptions = {
  group?: string
}

const MAX_HISTORY_ENTRIES = 100
const GROUP_WINDOW_MS = 700

export function useRecordDiagramHistory(
  diagram: RecordDiagramDraft,
  onChange: (diagram: RecordDiagramDraft) => void,
) {
  const presentRef = useRef(diagram)
  const pastRef = useRef<RecordDiagramDraft[]>([])
  const futureRef = useRef<RecordDiagramDraft[]>([])
  const lastCommitRef = useRef<{ group?: string; at: number }>({ at: 0 })
  const [historyVersion, setHistoryVersion] = useState(0)

  useEffect(() => {
    presentRef.current = diagram
  }, [diagram])

  const notify = useCallback(() => setHistoryVersion((version) => version + 1), [])

  const commit = useCallback((next: RecordDiagramDraft, options: CommitOptions = {}) => {
    const current = presentRef.current
    if (next === current) return
    const now = Date.now()
    const coalesces = Boolean(
      options.group
      && options.group === lastCommitRef.current.group
      && now - lastCommitRef.current.at < GROUP_WINDOW_MS
    )
    if (!coalesces) {
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY_ENTRIES - 1)), current]
    }
    futureRef.current = []
    lastCommitRef.current = { group: options.group, at: now }
    presentRef.current = next
    onChange(next)
    notify()
  }, [notify, onChange])

  const undo = useCallback(() => {
    const previous = pastRef.current.at(-1)
    if (!previous) return
    const current = presentRef.current
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [current, ...futureRef.current].slice(0, MAX_HISTORY_ENTRIES)
    const restored = preservePersistenceState(previous, current)
    presentRef.current = restored
    lastCommitRef.current = { at: 0 }
    onChange(restored)
    notify()
  }, [notify, onChange])

  const redo = useCallback(() => {
    const next = futureRef.current[0]
    if (!next) return
    const current = presentRef.current
    futureRef.current = futureRef.current.slice(1)
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY_ENTRIES - 1)), current]
    const restored = preservePersistenceState(next, current)
    presentRef.current = restored
    lastCommitRef.current = { at: 0 }
    onChange(restored)
    notify()
  }, [notify, onChange])

  return {
    commit,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    historyVersion,
  }
}

function preservePersistenceState(
  snapshot: RecordDiagramDraft,
  current: RecordDiagramDraft,
): RecordDiagramDraft {
  return {
    ...snapshot,
    revision: current.revision,
    viewport: current.viewport,
  }
}

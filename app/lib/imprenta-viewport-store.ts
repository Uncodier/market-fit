"use client"

import { useEffect, useRef, useState } from "react"
import type { ZoomableViewportInfo } from "@/app/components/agents/zoomable-canvas"

/**
 * External pub/sub store for canvas pan/zoom so components that repaint on every frame
 * (edges canvas, nodes canvas) do not go through React reconcile.
 *
 * Subscribers choose when to transition back into React state (e.g. via a debounced
 * "settle" notification in ImprentaPanel).
 */
export type ViewportSnapshot = ZoomableViewportInfo & {
  /** True while the user is actively panning / pinching / wheel-zooming. */
  interacting: boolean
}

export type ViewportStore = {
  get: () => ViewportSnapshot
  set: (next: Partial<ViewportSnapshot>) => void
  subscribe: (listener: (s: ViewportSnapshot) => void) => () => void
  /** Convenience: mark interaction boundary (writes only `interacting` and fires). */
  setInteracting: (v: boolean) => void
}

const DEFAULT_SNAPSHOT: ViewportSnapshot = {
  scale: 1,
  position: { x: 0, y: 0 },
  canvasWidth: 0,
  canvasHeight: 0,
  interacting: false,
}

export function createViewportStore(initial?: Partial<ViewportSnapshot>): ViewportStore {
  let snapshot: ViewportSnapshot = { ...DEFAULT_SNAPSHOT, ...initial }
  const listeners = new Set<(s: ViewportSnapshot) => void>()
  let rafId: number | null = null

  const flush = () => {
    rafId = null
    const s = snapshot
    listeners.forEach((l) => {
      try {
        l(s)
      } catch (e) {
        console.error("ViewportStore listener:", e)
      }
    })
  }

  const schedule = () => {
    if (rafId != null) return
    if (typeof window === "undefined") {
      flush()
      return
    }
    rafId = window.requestAnimationFrame(flush)
  }

  return {
    get: () => snapshot,
    set: (next) => {
      snapshot = {
        ...snapshot,
        ...next,
        position: next.position ? { ...next.position } : snapshot.position,
      }
      schedule()
    },
    setInteracting: (v) => {
      if (snapshot.interacting === v) return
      snapshot = { ...snapshot, interacting: v }
      schedule()
    },
    subscribe: (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
  }
}

/**
 * React hook that re-renders only when the selected slice changes (using Object.is).
 * Use with care in the render-hot path of ImprentaPanel; canvases should subscribe
 * directly via `store.subscribe` to avoid React reconcile.
 */
export function useViewportStoreSelector<T>(
  store: ViewportStore,
  selector: (s: ViewportSnapshot) => T,
  equals: (a: T, b: T) => boolean = Object.is
): T {
  const [value, setValue] = useState(() => selector(store.get()))
  const selectorRef = useRef(selector)
  selectorRef.current = selector
  const equalsRef = useRef(equals)
  equalsRef.current = equals
  const lastValueRef = useRef(value)
  lastValueRef.current = value

  useEffect(() => {
    const listener = (s: ViewportSnapshot) => {
      const next = selectorRef.current(s)
      if (!equalsRef.current(lastValueRef.current, next)) {
        lastValueRef.current = next
        setValue(next)
      }
    }
    const unsub = store.subscribe(listener)
    listener(store.get())
    return unsub
  }, [store])

  return value
}

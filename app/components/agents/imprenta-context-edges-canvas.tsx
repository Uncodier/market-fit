"use client"

import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import type { InstanceNode } from "@/app/types/instance-nodes"
import type { ImprentaHoverStore } from "@/app/lib/imprenta-hover-store"
import type { ImprentaDragPreview, ImprentaDragStore } from "@/app/lib/imprenta-drag-store"
import type { ViewportSnapshot, ViewportStore } from "@/app/lib/imprenta-viewport-store"
import type { ImprentaContext } from "./imprenta-panel/data-types"
import {
  buildContextEdgeScene, contextEdgesWithDrag, contextHoverChain,
  type ContextEdgeGeometry, type ContextEdgeScene,
} from "./imprenta-context-edges-geometry"
import { hitContextEdge } from "./imprenta-context-edges-hit"
import { bindContextEdgeInteraction } from "./imprenta-context-edges-interaction"
import { paintContextEdgeLayer, type ContextEdgePaths } from "./imprenta-context-edges-paint"

export interface ImprentaContextEdgesCanvasProps {
  contexts: ImprentaContext[]
  nodes: InstanceNode[]
  positions: Record<string, { x: number; y: number }>
  nodeHeights: Record<string, number>
  selectedContextId: string | null
  onSelectContext: (id: string | null, anchor?: { x: number; y: number }) => void
  hoverStore: ImprentaHoverStore
  viewportStore: ViewportStore
  dragStore?: ImprentaDragStore
  nodeW?: number
  rowH?: number
  isDarkMode?: boolean
}

function sameViewport(a: ViewportSnapshot, b: ViewportSnapshot) {
  return a.scale === b.scale && a.position.x === b.position.x && a.position.y === b.position.y
    && a.canvasWidth === b.canvasWidth && a.canvasHeight === b.canvasHeight
}

/** Mount in screenSpaceBehind, never in the world-transformed graph subtree.
 * Two viewport-sized bitmaps isolate highlight changes from static edge paint.
 * Store subscriptions schedule one frame without scheduling any React updates. */
export const ImprentaContextEdgesCanvas = memo(function ImprentaContextEdgesCanvas({
  contexts, nodes, positions, nodeHeights, selectedContextId, onSelectContext,
  hoverStore, viewportStore, dragStore, nodeW = 480, rowH = 300, isDarkMode = false,
}: ImprentaContextEdgesCanvasProps) {
  const staticRef = useRef<HTMLCanvasElement>(null)
  const highlightRef = useRef<HTMLCanvasElement>(null)
  const scheduleRef = useRef<((staticChanged: boolean) => void) | null>(null)
  const scene = useMemo(() => buildContextEdgeScene(contexts, nodes, positions, nodeHeights, nodeW, rowH),
    [contexts, nodes, positions, nodeHeights, nodeW, rowH])
  const committed = useRef({ scene, selectedContextId, onSelectContext, isDarkMode })
  useLayoutEffect(() => {
    committed.current = { scene, selectedContextId, onSelectContext, isDarkMode }
  }, [scene, selectedContextId, onSelectContext, isDarkMode])

  useEffect(() => {
    const base = staticRef.current, highlight = highlightRef.current
    if (!base || !highlight) return
    let raf: number | null = null
    let staticDirty = true
    let lastViewport = viewportStore.get()
    let color = ""
    let lastDark: boolean | undefined
    const paths: ContextEdgePaths = new WeakMap()
    let cached: { scene: ContextEdgeScene; drag: ImprentaDragPreview; edges: ContextEdgeGeometry[] } | null = null
    const currentEdges = () => {
      const current = committed.current.scene
      const drag = dragStore?.get() ?? null
      if (!cached || cached.scene !== current || cached.drag?.id !== drag?.id || cached.drag?.x !== drag?.x || cached.drag?.y !== drag?.y) {
        cached = { scene: current, drag, edges: contextEdgesWithDrag(current, drag) }
      }
      return cached.edges
    }
    const draw = () => {
      raf = null
      const view = viewportStore.get()
      const props = committed.current
      if (lastDark !== props.isDarkMode) {
        lastDark = props.isDarkMode
        color = getComputedStyle(base).color || (lastDark ? "#fafafa" : "#18181b")
        staticDirty = true
      }
      if (!sameViewport(lastViewport, view)) staticDirty = true
      lastViewport = view
      const edges = currentEdges()
      if (staticDirty) {
        paintContextEdgeLayer(base, view, edges, paths, color)
        staticDirty = false
      }
      paintContextEdgeLayer(highlight, view, edges, paths, color, {
        selectedId: props.selectedContextId,
        hoverChain: contextHoverChain(hoverStore.get(), props.scene.nodesById),
      })
    }
    const schedule = (staticChanged: boolean) => {
      staticDirty ||= staticChanged
      if (raf === null) raf = window.requestAnimationFrame(draw)
    }
    scheduleRef.current = schedule
    const unsubscribeViewport = viewportStore.subscribe(view => {
      if (!sameViewport(lastViewport, view)) schedule(true)
    })
    const unsubscribeHover = hoverStore.subscribe(() => schedule(false))
    const unsubscribeDrag = dragStore?.subscribe(() => schedule(true))
    const resize = () => schedule(true)
    window.addEventListener("resize", resize)
    const unbind = bindContextEdgeInteraction(base, {
      enabled: () => !dragStore?.get(),
      hitTest: (clientX, clientY) => {
        const rect = base.getBoundingClientRect()
        const point = { x: clientX - rect.left, y: clientY - rect.top }
        const view = viewportStore.get()
        if (point.x < 0 || point.y < 0 || point.x > view.canvasWidth || point.y > view.canvasHeight) return null
        return hitContextEdge(currentEdges(), point, view)?.id ?? null
      },
      onSelect: (id, anchor) => {
        const props = committed.current
        const deselect = id === props.selectedContextId
        // The parent retains the existing lock/deletion/editor policy.
        props.onSelectContext(deselect ? null : id, deselect ? undefined : anchor)
      },
    })
    schedule(true)
    return () => {
      unsubscribeViewport()
      unsubscribeHover()
      unsubscribeDrag?.()
      window.removeEventListener("resize", resize)
      unbind()
      scheduleRef.current = null
      if (raf !== null) window.cancelAnimationFrame(raf)
    }
  }, [viewportStore, hoverStore, dragStore])

  useEffect(() => { scheduleRef.current?.(true) }, [scene, isDarkMode])
  useEffect(() => { scheduleRef.current?.(false) }, [selectedContextId])

  const style = { position: "absolute" as const, inset: 0, width: "100%", height: "100%", pointerEvents: "none" as const, color: "hsl(var(--primary))" }
  return <>
    <canvas ref={staticRef} data-imprenta-context-edges="static" style={style} aria-hidden />
    <canvas ref={highlightRef} data-imprenta-context-edges="highlight" style={style} aria-hidden />
  </>
})
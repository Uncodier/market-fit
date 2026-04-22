"use client"

import { useEffect, useRef } from "react"
import type { InstanceNode } from "@/app/types/instance-nodes"
import type { ViewportStore, ViewportSnapshot } from "@/app/lib/imprenta-viewport-store"
import {
  buildNodeCellGrid,
  collectIdsFromGrid,
  worldViewportFromCanvas,
} from "@/app/lib/graph-viewport"

export interface ImprentaParentEdgesCanvasProps {
  nodes: InstanceNode[]
  positions: Record<string, { x: number; y: number }>
  nodeHeights: Record<string, number>
  nodeW: number
  rowH: number
  strokeStyle: string
  /** Subscribes directly; bypasses React reconcile on pan/zoom. */
  viewportStore: ViewportStore
  /** When set, tree edges whose endpoints are both in this set use `hoverChainStroke`. */
  hoverChainNodeIds?: ReadonlySet<string> | null
  /** Stroke for edges on the hovered node → root chain (see `hoverChainNodeIds`). */
  hoverChainStroke?: string
  /** World padding beyond the visible viewport (keeps edges from popping when panning). */
  padWorld?: number
  /**
   * Live drag preview — if set, substitutes the node's position in-flight so
   * the edge follows the pointer without invalidating the stable grid cache
   * (the grid is keyed on `positions`, which stays stable while dragging).
   */
  dragOverride?: { id: string; x: number; y: number } | null
  /**
   * Scale below which edges are drawn as straight lines instead of beziers.
   * At `0` (or negative) the canvas always uses beziers — useful for small
   * graphs where there is no performance reason to drop visual fidelity.
   * Defaults to 0.4 (matches the lite-canvas full-detail threshold).
   */
  straightLinesBelowScale?: number
}

const DEFAULT_PAD_WORLD = 240

/**
 * Draws parent→child Bezier edges in a viewport-sized canvas.
 *
 * - Canvas bitmap is sized to the container (screen space), so memory is O(viewport),
 *   independent of graph size.
 * - World-to-screen mapping is applied via `ctx.setTransform` inside the draw, using
 *   the current `ViewportSnapshot`.
 * - Repaints are scheduled on a single rAF so multiple listeners fired in the same
 *   frame coalesce.
 */
export function ImprentaParentEdgesCanvas({
  nodes,
  positions,
  nodeHeights,
  nodeW,
  rowH,
  strokeStyle,
  viewportStore,
  padWorld = DEFAULT_PAD_WORLD,
  dragOverride = null,
  straightLinesBelowScale = 0.4,
  hoverChainNodeIds = null,
  hoverChainStroke,
}: ImprentaParentEdgesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const positionsRef = useRef(positions)
  positionsRef.current = positions
  const heightsRef = useRef(nodeHeights)
  heightsRef.current = nodeHeights
  const nodeWRef = useRef(nodeW)
  nodeWRef.current = nodeW
  const rowHRef = useRef(rowH)
  rowHRef.current = rowH
  const strokeRef = useRef(strokeStyle)
  strokeRef.current = strokeStyle
  const padWorldRef = useRef(padWorld)
  padWorldRef.current = padWorld
  const dragOverrideRef = useRef(dragOverride)
  dragOverrideRef.current = dragOverride
  const straightBelowRef = useRef(straightLinesBelowScale)
  straightBelowRef.current = straightLinesBelowScale
  const hoverChainRef = useRef(hoverChainNodeIds)
  hoverChainRef.current = hoverChainNodeIds
  const hoverChainStrokeRef = useRef(hoverChainStroke)
  hoverChainStrokeRef.current = hoverChainStroke

  const scheduleRef = useRef<(() => void) | null>(null)

  // Cached spatial grid; survives across frames during pan because data refs stay stable.
  const gridCacheRef = useRef<{
    nodes: InstanceNode[]
    positions: Record<string, { x: number; y: number }>
    heights: Record<string, number>
    nodeW: number
    rowH: number
    ids: string[]
    grid: Map<string, Set<string>>
  } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let rafId: number | null = null
    let lastSnapshot: ViewportSnapshot = viewportStore.get()

    const getCachedIdsAndGrid = () => {
      const all = nodesRef.current
      const pos = positionsRef.current
      const h = heightsRef.current
      const w = nodeWRef.current
      const rH = rowHRef.current
      const cached = gridCacheRef.current
      if (
        cached &&
        cached.nodes === all &&
        cached.positions === pos &&
        cached.heights === h &&
        cached.nodeW === w &&
        cached.rowH === rH
      ) {
        return cached
      }
      const ids = new Array<string>(all.length)
      for (let i = 0; i < all.length; i++) ids[i] = all[i].id
      const grid = buildNodeCellGrid(ids, pos, h, w, rH)
      const entry = { nodes: all, positions: pos, heights: h, nodeW: w, rowH: rH, ids, grid }
      gridCacheRef.current = entry
      return entry
    }

    const resizeToViewport = (snap: ViewportSnapshot) => {
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2)
      const w = Math.max(0, Math.floor(snap.canvasWidth))
      const h = Math.max(0, Math.floor(snap.canvasHeight))
      const targetW = Math.max(1, Math.floor(w * dpr))
      const targetH = Math.max(1, Math.floor(h * dpr))
      if (canvas.width !== targetW) canvas.width = targetW
      if (canvas.height !== targetH) canvas.height = targetH
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      return dpr
    }

    const draw = () => {
      rafId = null
      const snap = lastSnapshot
      if (!snap.canvasWidth || !snap.canvasHeight) {
        const ctx = canvas.getContext("2d")
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }

      const dpr = resizeToViewport(snap)
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const s = snap.scale
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * snap.position.x, dpr * snap.position.y)

      const baseLineWidth = Math.max(1, 2 / s)
      ctx.strokeStyle = strokeRef.current
      ctx.lineWidth = baseLineWidth
      ctx.lineCap = "round"

      const pos = positionsRef.current
      const heights = heightsRef.current
      const w = nodeWRef.current
      const rH = rowHRef.current

      const world = worldViewportFromCanvas(
        snap.canvasWidth,
        snap.canvasHeight,
        snap.scale,
        snap.position,
        padWorldRef.current
      )

      const cached = getCachedIdsAndGrid()
      const allNodes = cached.nodes
      const candidates = collectIdsFromGrid(cached.grid, world)
      const override = dragOverrideRef.current
      const resolve = (id: string): { x: number; y: number } | undefined =>
        override && override.id === id ? override : pos[id]

      // LOD: beziers are expensive. At far zoom we draw straight lines — visually
      // indistinguishable when each edge is only a few CSS pixels long. For small
      // graphs the parent passes `straightLinesBelowScale = 0` so we keep beziers
      // at every zoom.
      const useStraightLines = snap.scale < straightBelowRef.current

      for (let i = 0; i < allNodes.length; i++) {
        const node = allNodes[i]
        const parentId = node.parent_node_id
        if (!parentId) continue
        const start = resolve(parentId)
        const end = resolve(node.id)
        if (!start || !end) continue

        // Include both endpoints for culling; the override may push an endpoint
        // far from its cached cell during drag — always accept it then.
        const isOverrideEdge =
          override && (override.id === node.id || override.id === parentId)
        if (!isOverrideEdge && !candidates.has(node.id) && !candidates.has(parentId)) continue

        const startCy = (heights[parentId] || rH) / 2
        const endCy = (heights[node.id] || rH) / 2
        const x1 = start.x + w
        const y1 = start.y + startCy
        const x2 = end.x
        const y2 = end.y + endCy
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        if (useStraightLines) {
          ctx.lineTo(x2, y2)
        } else {
          const cx1 = x1 + 50
          const cy1 = y1
          const cx2 = x2 - 50
          const cy2 = y2
          ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2)
        }
        const hl = hoverChainRef.current
        const hlStroke = hoverChainStrokeRef.current
        const onHoveredChain =
          hl != null && hl.size > 0 && hl.has(parentId) && hl.has(node.id) && typeof hlStroke === "string"
        if (onHoveredChain) {
          ctx.strokeStyle = hlStroke
          ctx.lineWidth = Math.max(1, 3.25 / s)
          ctx.stroke()
          ctx.strokeStyle = strokeRef.current
          ctx.lineWidth = baseLineWidth
        } else {
          ctx.stroke()
        }
      }
    }

    const schedule = () => {
      if (rafId != null) return
      rafId = window.requestAnimationFrame(draw)
    }
    scheduleRef.current = schedule

    const unsub = viewportStore.subscribe((snap) => {
      lastSnapshot = snap
      schedule()
    })

    schedule()

    return () => {
      unsub()
      scheduleRef.current = null
      if (rafId != null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
    }
  }, [viewportStore])

  useEffect(() => {
    scheduleRef.current?.()
  }, [
    nodes,
    positions,
    nodeHeights,
    nodeW,
    rowH,
    strokeStyle,
    dragOverride,
    straightLinesBelowScale,
    hoverChainNodeIds,
    hoverChainStroke,
  ])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0, width: "100%", height: "100%" }}
      aria-hidden
    />
  )
}

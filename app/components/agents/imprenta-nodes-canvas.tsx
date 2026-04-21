"use client"

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from "react"
import type { InstanceNode } from "@/app/types/instance-nodes"
import type { ViewportStore, ViewportSnapshot } from "@/app/lib/imprenta-viewport-store"
import {
  buildNodeCellGrid,
  collectIdsFromGrid,
  worldViewportFromCanvas,
  type GraphBBox,
} from "@/app/lib/graph-viewport"
import {
  bandFromScale,
  drawLiteNode,
  drawSelectionHighlight,
  imprentaCanvasTheme,
  type ImprentaCanvasTheme,
  type ImprentaLiteBand,
} from "@/app/lib/imprenta-canvas-draw"
import type { ImprentaThumbCache } from "@/app/lib/imprenta-thumb-cache"

type GridCacheEntry = {
  nodes: InstanceNode[]
  positions: Record<string, { x: number; y: number }>
  heights: Record<string, number>
  nodeW: number
  rowH: number
  ids: string[]
  grid: Map<string, Set<string>>
}

/**
 * Module-level helper: rebuilds the spatial grid only when one of the input refs changes
 * identity. Kept outside the component so it is not subject to HMR/React-Compiler closure
 * transforms that (in some Turbopack builds) renamed the equivalent `useCallback` target.
 */
function readCachedIdsAndGrid(
  cacheRef: MutableRefObject<GridCacheEntry | null>,
  nodes: InstanceNode[],
  positions: Record<string, { x: number; y: number }>,
  heights: Record<string, number>,
  nodeW: number,
  rowH: number
): GridCacheEntry {
  const cached = cacheRef.current
  if (
    cached &&
    cached.nodes === nodes &&
    cached.positions === positions &&
    cached.heights === heights &&
    cached.nodeW === nodeW &&
    cached.rowH === rowH
  ) {
    return cached
  }
  const ids = new Array<string>(nodes.length)
  for (let i = 0; i < nodes.length; i++) ids[i] = nodes[i].id
  const grid = buildNodeCellGrid(ids, positions, heights, nodeW, rowH)
  const entry: GridCacheEntry = {
    nodes,
    positions,
    heights,
    nodeW,
    rowH,
    ids,
    grid,
  }
  cacheRef.current = entry
  return entry
}

export interface ImprentaNodesCanvasProps {
  /** Nodes to consider (already includes dummies filtered out by the parent). */
  nodes: InstanceNode[]
  positions: Record<string, { x: number; y: number }>
  heights: Record<string, number>
  nodeW: number
  rowH: number
  /** Full detail scale; below it, this canvas owns the node rendering. */
  fullDetailScale: number
  liteMicroMax: number
  liteSimpleMax: number
  viewportStore: ViewportStore
  thumbs: ImprentaThumbCache
  isDarkMode: boolean
  /** Optional: ids currently rendered as full-detail DOM cards (skip in canvas). */
  skipIds?: Set<string>
  /** Currently selected node id (drawn with ring). */
  selectedId?: string | null
  /** Extracts cover / thumbnail URLs for a node. Provided by the parent so we reuse the same logic as DOM. */
  getImageUrls: (node: InstanceNode) => string[]
  getVideoUrls: (node: InstanceNode) => string[]
  /** Fired on pointerdown over a node (bubbles up world coordinates via pointer event). */
  onNodePointerDown: (nodeId: string, ev: PointerEvent) => void
  /** Fired on pointerdown over empty canvas (for deselect). */
  onBackgroundPointerDown?: (ev: PointerEvent) => void
  /** World padding to avoid edge popping. */
  padWorld?: number
  /**
   * Master switch: when false, the canvas disables pointer events entirely so DOM
   * layers below (full cards, drop anchors) receive them. Typically set to false
   * while a temp connection is being dragged.
   */
  pointerEventsEnabled?: boolean
}

const DEFAULT_PAD_WORLD = 96

/**
 * Canvas-based lite node layer. Subscribes directly to the viewport store, skips React
 * reconcile on pan/zoom, and repaints once per rAF coalesced. Owns pointer hit testing
 * for lite nodes so the existing drag/connection pipelines keep working.
 */
export function ImprentaNodesCanvas({
  nodes,
  positions,
  heights,
  nodeW,
  rowH,
  fullDetailScale,
  liteMicroMax,
  liteSimpleMax,
  viewportStore,
  thumbs,
  isDarkMode,
  skipIds,
  selectedId,
  getImageUrls,
  getVideoUrls,
  onNodePointerDown,
  onBackgroundPointerDown,
  padWorld = DEFAULT_PAD_WORLD,
  pointerEventsEnabled = true,
}: ImprentaNodesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const theme = useMemo(() => imprentaCanvasTheme(isDarkMode), [isDarkMode])
  const themeRef = useRef(theme)
  themeRef.current = theme

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const positionsRef = useRef(positions)
  positionsRef.current = positions
  const heightsRef = useRef(heights)
  heightsRef.current = heights
  const nodeWRef = useRef(nodeW)
  nodeWRef.current = nodeW
  const rowHRef = useRef(rowH)
  rowHRef.current = rowH
  const fullRef = useRef(fullDetailScale)
  fullRef.current = fullDetailScale
  const microMaxRef = useRef(liteMicroMax)
  microMaxRef.current = liteMicroMax
  const simpleMaxRef = useRef(liteSimpleMax)
  simpleMaxRef.current = liteSimpleMax
  const skipRef = useRef(skipIds)
  skipRef.current = skipIds
  const selRef = useRef(selectedId)
  selRef.current = selectedId
  const getImgRef = useRef(getImageUrls)
  getImgRef.current = getImageUrls
  const getVidRef = useRef(getVideoUrls)
  getVidRef.current = getVideoUrls
  const onDownRef = useRef(onNodePointerDown)
  onDownRef.current = onNodePointerDown
  const onBgDownRef = useRef(onBackgroundPointerDown)
  onBgDownRef.current = onBackgroundPointerDown
  const padRef = useRef(padWorld)
  padRef.current = padWorld

  const scheduleRef = useRef<(() => void) | null>(null)
  const touchTickRef = useRef(0)

  // Per-node URL memoization — avoids re-parsing `node.result` for every repaint.
  // Keyed by node object; invalidated when `node.result` reference changes.
  const urlCacheRef = useRef<WeakMap<InstanceNode, { resultRef: unknown; imgs: string[]; vids: string[] }>>(
    new WeakMap()
  )

  // Shared grid + ids cache — rebuilt only when nodes/positions/heights/geometry change.
  // During pan/zoom all those refs are stable so the grid survives across frames.
  const gridCacheRef = useRef<GridCacheEntry | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let rafId: number | null = null
    let lastSnapshot: ViewportSnapshot = viewportStore.get()

    const resizeToViewport = (snap: ViewportSnapshot) => {
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2)
      const wCss = Math.max(0, Math.floor(snap.canvasWidth))
      const hCss = Math.max(0, Math.floor(snap.canvasHeight))
      const targetW = Math.max(1, Math.floor(wCss * dpr))
      const targetH = Math.max(1, Math.floor(hCss * dpr))
      if (canvas.width !== targetW) canvas.width = targetW
      if (canvas.height !== targetH) canvas.height = targetH
      canvas.style.width = `${wCss}px`
      canvas.style.height = `${hCss}px`
      return dpr
    }

    const draw = () => {
      rafId = null
      const snap = lastSnapshot
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      if (!snap.canvasWidth || !snap.canvasHeight) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }
      // Only paint when we own the node rendering (lite band).
      if (snap.scale >= fullRef.current) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }

      const dpr = resizeToViewport(snap)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const s = snap.scale
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * snap.position.x, dpr * snap.position.y)

      const band: ImprentaLiteBand = bandFromScale(s, microMaxRef.current, simpleMaxRef.current)
      const pos = positionsRef.current
      const h = heightsRef.current
      const w = nodeWRef.current
      const rH = rowHRef.current
      const skip = skipRef.current
      const sel = selRef.current
      const themeVal: ImprentaCanvasTheme = themeRef.current

      const world: GraphBBox = worldViewportFromCanvas(
        snap.canvasWidth,
        snap.canvasHeight,
        s,
        snap.position,
        padRef.current
      )

      const cached = readCachedIdsAndGrid(
        gridCacheRef,
        nodesRef.current,
        positionsRef.current,
        heightsRef.current,
        nodeWRef.current,
        rowHRef.current
      )
      const all = cached.nodes
      const candidates = collectIdsFromGrid(cached.grid, world)

      const urlCache = urlCacheRef.current
      const getUrls = (node: InstanceNode) => {
        const hit = urlCache.get(node)
        if (hit && hit.resultRef === node.result) return hit
        const imgs = getImgRef.current(node)
        const vids = getVidRef.current(node)
        const entry = { resultRef: node.result, imgs, vids }
        urlCache.set(node, entry)
        return entry
      }

      // Collect urls to request (in viewport only) and pass to drawLiteNode.
      const requestedUrls: string[] = []
      const drawLabel = band !== "micro"

      // Draw in stable order (parent first) so child cards paint on top of siblings.
      for (let i = 0; i < all.length; i++) {
        const node = all[i]
        if (!candidates.has(node.id)) continue
        if (skip && skip.has(node.id)) continue
        const p = pos[node.id]
        if (!p) continue
        const hh = h[node.id] || rH

        const { imgs, vids } = getUrls(node)
        const coverImage = imgs[0] ?? null
        const coverVideo = !coverImage ? vids[0] ?? null : null
        if (coverImage) requestedUrls.push(coverImage)
        if (band === "rich") {
          for (let j = 1; j < imgs.length && j <= 3; j++) requestedUrls.push(imgs[j])
        }

        drawLiteNode(ctx, {
          node,
          x: p.x,
          y: p.y,
          w,
          h: hh,
          band,
          theme: themeVal,
          coverImageUrl: coverImage,
          coverVideoUrl: coverVideo,
          extraImageUrls: band === "rich" ? imgs.slice(1, 4) : [],
          thumbs,
          drawLabel,
        })

        if (sel && sel === node.id) {
          drawSelectionHighlight(ctx, p.x, p.y, w, hh, themeVal.primary)
        }
      }

      // Protect current viewport URLs from LRU eviction. Throttled to every 4th
      // frame so it doesn't dominate pan cost when thousands of urls are live.
      touchTickRef.current = (touchTickRef.current + 1) & 0x0f
      if (touchTickRef.current === 0) {
        thumbs.touch(requestedUrls)
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

    const unsubThumbs = thumbs.onDecoded(() => schedule())

    schedule()

    return () => {
      unsub()
      unsubThumbs()
      scheduleRef.current = null
      if (rafId != null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
    }
  }, [viewportStore, thumbs])

  // Schedule repaints on data-only changes.
  useEffect(() => {
    scheduleRef.current?.()
  }, [nodes, positions, heights, nodeW, rowH, isDarkMode, selectedId, skipIds])

  /**
   * Hit test using the spatial grid so it scales to thousands of nodes.
   * For a client coordinate, resolves the world position, asks the grid for the
   * (usually small) set of candidate ids whose cell the point falls into, and
   * performs bbox containment only on those.
   */
  const hitTest = useCallback(
    (clientX: number, clientY: number): InstanceNode | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const snap = viewportStore.get()
      if (snap.scale >= fullRef.current) return null
      const sx = clientX - rect.left
      const sy = clientY - rect.top
      const wx = (sx - snap.position.x) / snap.scale
      const wy = (sy - snap.position.y) / snap.scale
      const pos = positionsRef.current
      const h = heightsRef.current
      const w = nodeWRef.current
      const rH = rowHRef.current
      const cached = readCachedIdsAndGrid(gridCacheRef, nodesRef.current, pos, h, w, rH)
      const point: GraphBBox = { minX: wx, minY: wy, maxX: wx, maxY: wy }
      const candidates = collectIdsFromGrid(cached.grid, point)
      const all = cached.nodes
      // Iterate in stable reverse order so children (later in array) win over parents.
      for (let i = all.length - 1; i >= 0; i--) {
        const node = all[i]
        if (!candidates.has(node.id)) continue
        const p = pos[node.id]
        if (!p) continue
        const hh = h[node.id] || rH
        if (wx >= p.x && wx <= p.x + w && wy >= p.y && wy <= p.y + hh) {
          return node
        }
      }
      return null
    },
    [viewportStore]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return
      const hit = hitTest(ev.clientX, ev.clientY)
      if (hit) {
        onDownRef.current(hit.id, ev)
      } else {
        onBgDownRef.current?.(ev)
      }
    }

    // rAF-throttled cursor update: raw pointermove can fire 200+ Hz on Mac trackpads.
    let lastX = 0
    let lastY = 0
    let pendingMove = false
    let lastCursor: string | null = null
    const flushCursor = () => {
      pendingMove = false
      const hit = hitTest(lastX, lastY)
      const next = hit ? "grab" : "default"
      if (next !== lastCursor) {
        canvas.style.cursor = next
        lastCursor = next
      }
    }
    const onPointerMove = (ev: PointerEvent) => {
      lastX = ev.clientX
      lastY = ev.clientY
      if (pendingMove) return
      pendingMove = true
      window.requestAnimationFrame(flushCursor)
    }

    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointermove", onPointerMove)
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointermove", onPointerMove)
    }
  }, [hitTest])

  /** Toggle CSS `pointer-events` off when we are not the hit surface (full detail or disabled). */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const apply = (snap: ViewportSnapshot) => {
      const canHit = pointerEventsEnabled && snap.scale < fullRef.current
      canvas.style.pointerEvents = canHit ? "auto" : "none"
    }
    apply(viewportStore.get())
    const unsub = viewportStore.subscribe(apply)
    return unsub
  }, [viewportStore, pointerEventsEnabled])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        touchAction: "none",
        zIndex: 0,
      }}
      aria-hidden
    />
  )
}

"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import type { InstanceNode } from "@/app/types/instance-nodes"
import type { ViewportStore, ViewportSnapshot } from "@/app/lib/imprenta-viewport-store"
import {
  collectIdsFromGrid,
  worldViewportFromCanvas,
  type GraphBBox,
} from "@/app/lib/graph-viewport"
import {
  bandFromScale,
  drawSelectionHighlight,
  liteNodeMarkerRect,
  imprentaCanvasTheme,
  type ImprentaCanvasTheme,
  type ImprentaLiteBand,
} from "@/app/lib/imprenta-canvas-draw"
import type { ImprentaThumbCache } from "@/app/lib/imprenta-thumb-cache"
import { readCachedIdsAndGrid, type GridCacheEntry } from "./imprenta-nodes-canvas-grid"
import { bindCanvasPointerInteraction } from "./imprenta-nodes-canvas-interaction"
import { expandMarkerQuery } from "./imprenta-nodes-canvas-geometry"
import { createImprentaSpriteRenderer, spriteFootprint } from "@/app/lib/imprenta-sprite-renderer"

// Preserve the existing helper import surface.
export { readCachedIdsAndGrid, type GridCacheEntry } from "./imprenta-nodes-canvas-grid"

export interface ImprentaNodesCanvasProps {
  /** Nodes to consider (already includes dummies filtered out by the parent). */
  nodes: InstanceNode[]
  positions: Record<string, { x: number; y: number }>
  heights: Record<string, number>
  nodeW: number
  rowH: number
  /** Full detail scale; below it, this canvas owns the node rendering. */
  fullDetailScale: number
  /** Keep canvas previews/hit handling above full detail; preserve overview LOD below it. */
  renderAtAllScales?: boolean
  liteMarkerMax: number
  liteMicroMax: number
  liteSimpleMax: number
  viewportStore: ViewportStore
  thumbs: ImprentaThumbCache
  isDarkMode: boolean
  /** Actual mounted DOM card ids, not scheduled/desired ids (skip in canvas). */
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
   * Master switch for delegated canvas hit handling. Paint always remains
   * pointer-transparent. Disable while dragging a node or temp connection.
   */
  pointerEventsEnabled?: boolean
}

const DEFAULT_PAD_WORLD = 96

/** Lite node layer: direct viewport subscription, coalesced drawing and grid hit testing. */
export function ImprentaNodesCanvas({
  nodes,
  positions,
  heights,
  nodeW,
  rowH,
  fullDetailScale,
  renderAtAllScales = false,
  liteMarkerMax,
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

  const nodesRef = useRef(nodes)
  const positionsRef = useRef(positions)
  const heightsRef = useRef(heights)
  const nodeWRef = useRef(nodeW)
  const rowHRef = useRef(rowH)
  const fullRef = useRef(fullDetailScale)
  const allScalesRef = useRef(renderAtAllScales)
  const markerMaxRef = useRef(liteMarkerMax)
  const microMaxRef = useRef(liteMicroMax)
  const simpleMaxRef = useRef(liteSimpleMax)
  const skipRef = useRef(skipIds)
  const selRef = useRef(selectedId)
  const getImgRef = useRef(getImageUrls)
  const getVidRef = useRef(getVideoUrls)
  const onDownRef = useRef(onNodePointerDown)
  const onBgDownRef = useRef(onBackgroundPointerDown)
  const pointerEnabledRef = useRef(pointerEventsEnabled)
  const padRef = useRef(padWorld)

  // Native listeners and frame callbacks see only committed props.
  useLayoutEffect(() => {
    themeRef.current = theme
    nodesRef.current = nodes
    positionsRef.current = positions
    heightsRef.current = heights
    nodeWRef.current = nodeW
    rowHRef.current = rowH
    fullRef.current = fullDetailScale
    allScalesRef.current = renderAtAllScales
    markerMaxRef.current = liteMarkerMax
    microMaxRef.current = liteMicroMax
    simpleMaxRef.current = liteSimpleMax
    skipRef.current = skipIds
    selRef.current = selectedId
    getImgRef.current = getImageUrls
    getVidRef.current = getVideoUrls
    onDownRef.current = onNodePointerDown
    onBgDownRef.current = onBackgroundPointerDown
    pointerEnabledRef.current = pointerEventsEnabled
    padRef.current = padWorld
  })

  const scheduleRef = useRef<(() => void) | null>(null)
  const touchTickRef = useRef(0)

  // Per-node URL memoization — avoids re-parsing `node.result` for every repaint.
  // Keyed by node object; invalidated when `node.result` reference changes.
  const urlCacheRef = useRef<WeakMap<InstanceNode, {
    resultRef: unknown; imgs: string[]; vids: string[]
    imageReader: typeof getImageUrls; videoReader: typeof getVideoUrls
  }>>(
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
    const sprites = createImprentaSpriteRenderer()
    let visibleUrls = new Set<string>()
    let retainedNodes: InstanceNode[] | null = null
    // A decode completion can emit again for DOM blob encoding; only changed pixels matter.
    const decoded = new Map<string, { image: HTMLCanvasElement | null; status: string }>()

    const resizeToViewport = (snap: ViewportSnapshot) => {
      const maxDpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2)
      const dpr = snap.interacting ? 1 : maxDpr
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
        visibleUrls = new Set()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }
      // Keep fallback shells until their actual DOM cards have mounted, even at rest.
      const isTurbo = !allScalesRef.current && snap.scale >= fullRef.current

      const dpr = resizeToViewport(snap)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const s = snap.scale
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * snap.position.x, dpr * snap.position.y)

      const band: ImprentaLiteBand = allScalesRef.current && s >= fullRef.current ? "rich" : isTurbo
        ? "turbo"
        : bandFromScale(s, markerMaxRef.current, microMaxRef.current, simpleMaxRef.current)
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
      const candidates = collectIdsFromGrid(cached.grid, expandMarkerQuery(world, band, s))
      if (retainedNodes !== nodesRef.current) {
        retainedNodes = nodesRef.current
        sprites.cache.retainNodes(new Set(retainedNodes.map((node) => node.id)))
      }
      sprites.beginFrame({ dpr, interacting: snap.interacting, visibleIds: candidates })

      const urlCache = urlCacheRef.current
      const getUrls = (node: InstanceNode) => {
        const hit = urlCache.get(node)
        if (hit && hit.resultRef === node.result && hit.imageReader === getImgRef.current && hit.videoReader === getVidRef.current) return hit
        const imgs = getImgRef.current(node)
        const vids = getVidRef.current(node)
        const entry = { resultRef: node.result, imgs, vids, imageReader: getImgRef.current, videoReader: getVidRef.current }
        urlCache.set(node, entry)
        return entry
      }

      // Collect urls to request (in viewport only) and pass to drawLiteNode.
      const requestedUrls: string[] = []
      const drawLabel = band !== "micro"

      // Iterate in stable order (parent first) by sorting candidates using nodeIndexes.
      const candidateArray = Array.from(candidates);
      candidateArray.sort((a, b) => {
        return (cached.nodeIndexes.get(a) || 0) - (cached.nodeIndexes.get(b) || 0);
      });

      for (let i = 0; i < candidateArray.length; i++) {
        const nodeId = candidateArray[i];
        const node = cached.nodesById.get(nodeId);
        if (!node) continue;
        if (skip && skip.has(node.id)) continue
        const p = pos[node.id]
        if (!p) continue
        const hh = h[node.id] || rH
        const footprint = spriteFootprint({ x: p.x, y: p.y, w, h: hh, scale: s, band })
        if (footprint.x > world.maxX || footprint.y > world.maxY ||
          footprint.x + footprint.w < world.minX || footprint.y + footprint.h < world.minY) continue

        const { imgs, vids } = getUrls(node)
        const coverImage = imgs[0] ?? null
        const coverVideo = vids[0] ?? null
        if (coverImage) requestedUrls.push(coverImage)
        else if (coverVideo) requestedUrls.push(coverVideo)
        if (band === "rich") {
          for (let j = 1; j < imgs.length && j <= 3; j++) requestedUrls.push(imgs[j])
        }

        sprites.draw(ctx, {
          node,
          x: p.x,
          y: p.y,
          w,
          h: hh,
          scale: s,
          band,
          theme: themeVal,
          coverImageUrl: coverImage,
          coverVideoUrl: coverVideo,
          extraImageUrls: band === "rich" ? imgs.slice(1, 4) : [],
          thumbs,
          drawLabel,
        })

        if (sel && sel === node.id) {
          if (band === "marker") {
            const scratch = { x: 0, y: 0, w: 0, h: 0 }
            liteNodeMarkerRect(p.x, p.y, w, hh, s, scratch)
            drawSelectionHighlight(ctx, scratch.x, scratch.y, scratch.w, scratch.h, themeVal.primary)
          } else {
            drawSelectionHighlight(ctx, p.x, p.y, w, hh, themeVal.primary)
          }
        }
      }

      visibleUrls = new Set(requestedUrls)
      if (sprites.endFrame()) schedule()

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
      const previous = lastSnapshot
      lastSnapshot = snap
      if (snap.scale === previous.scale && snap.position.x === previous.position.x &&
        snap.position.y === previous.position.y && snap.canvasWidth === previous.canvasWidth &&
        snap.canvasHeight === previous.canvasHeight && snap.interacting === previous.interacting) return
      schedule()
    })

    const unsubThumbs = thumbs.onDecoded((url) => {
      const image = thumbs.get?.(url) ?? null
      const status = thumbs.status?.(url) ?? "ready"
      const previous = decoded.get(url)
      if (previous?.image === image && previous?.status === status) return
      decoded.delete(url)
      decoded.set(url, { image, status })
      if (decoded.size > 1024) decoded.delete(decoded.keys().next().value!)
      sprites.cache.invalidateMedia(url)
      if (visibleUrls.has(url)) schedule()
    })

    schedule()

    return () => {
      unsub()
      unsubThumbs()
      sprites.dispose()
      decoded.clear()
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
  }, [nodes, positions, heights, nodeW, rowH, isDarkMode, selectedId, skipIds,
    fullDetailScale, renderAtAllScales, liteMarkerMax, liteMicroMax, liteSimpleMax, padWorld,
    getImageUrls, getVideoUrls])

  /** Resolve client coordinates against spatial candidates in reverse paint order. */
  const hitTest = useCallback(
    (clientX: number, clientY: number): InstanceNode | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const snap = viewportStore.get()
      if (!pointerEnabledRef.current || (!allScalesRef.current && snap.scale >= fullRef.current)) return null
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
      const s = snap.scale
      const band = allScalesRef.current && s >= fullRef.current ? "rich" : bandFromScale(s, markerMaxRef.current, microMaxRef.current, simpleMaxRef.current)
      const candidates = collectIdsFromGrid(cached.grid, expandMarkerQuery(point, band, s))
      // Only visit spatial candidates, in reverse paint order so children win.
      const orderedIds = Array.from(candidates).sort(
        (a, b) => (cached.nodeIndexes.get(b) ?? 0) - (cached.nodeIndexes.get(a) ?? 0)
      )
      for (const id of orderedIds) {
        const node = cached.nodesById.get(id)
        if (!node || skipRef.current?.has(id)) continue
        const p = pos[node.id]
        if (!p) continue
        const hh = h[node.id] || rH
        
        let targetX = p.x
        let targetY = p.y
        let targetW = w
        let targetH = hh
        
        if (band === "marker") {
          const scratch = { x: 0, y: 0, w: 0, h: 0 }
          liteNodeMarkerRect(p.x, p.y, w, hh, s, scratch)
          targetX = scratch.x
          targetY = scratch.y
          targetW = scratch.w
          targetH = scratch.h
        }
        
        if (wx >= targetX && wx <= targetX + targetW && wy >= targetY && wy <= targetY + targetH) {
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

    return bindCanvasPointerInteraction(canvas, {
      enabled: () => pointerEnabledRef.current && (allScalesRef.current || viewportStore.get().scale < fullRef.current),
      hitTest: (x, y) => hitTest(x, y)?.id ?? null,
      onNodePointerDown: (id, event) => {
        event.preventDefault()
        onDownRef.current(id, event)
      },
      onBackgroundPointerDown: (event) => onBgDownRef.current?.(event),
    })
  }, [hitTest, viewportStore])

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

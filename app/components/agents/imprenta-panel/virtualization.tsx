import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { readCachedIdsAndGrid, type GridCacheEntry } from "../imprenta-nodes-canvas"
import { worldViewportFromCanvas, bboxIntersects, collectIdsFromGrid, quantizeViewport, type GraphBBox } from "@/app/lib/graph-viewport"
import { type ViewportSnapshot } from "@/app/lib/imprenta-viewport-store"
import { isLargeImprentaGraph } from "../imprenta-detail-mode"
import { InstanceNode } from "@/app/types/instance-nodes"
import { FALLBACK_POS, IMPRENTA_VIEWPORT_CULL_PAD, IMPRENTA_NODE_W, IMPRENTA_ROW_H, IMPRENTA_VIEWPORT_UNMOUNT_PAD, IMPRENTA_LOD_FULL_DETAIL_SCALE, collectImprentaLiteImagePreviewUrls, collectImprentaLiteVideoPreviewUrls } from './preview-helpers'
import type { useImprentaMeasurement } from './measurement'
import type { useImprentaPanelState } from './state'

type ImprentaVirtualizationOptions = Pick<ReturnType<typeof useImprentaMeasurement>, "canvasNodes" | "isDarkMode"> & Pick<ReturnType<typeof useImprentaPanelState>, "positions" | "nodeHeightsRef" | "layoutEpoch" | "viewportInfo" | "setViewportInfo" | "viewportStore" | "viewportStoreRef" | "hoverStore" | "dummyNodes" | "draggingNodeId" | "tempConnection" | "generatingNodeIds" | "nodes">

export function useImprentaVirtualization({
  canvasNodes,
  positions,
  nodeHeightsRef,
  layoutEpoch,
  viewportInfo,
  setViewportInfo,
  viewportStore,
  isDarkMode,
  viewportStoreRef,
  hoverStore,
  dummyNodes,
  draggingNodeId,
  tempConnection,
  generatingNodeIds,
  nodes,
}: ImprentaVirtualizationOptions) {
  const stablePositions = useMemo(() => {
    const r: Record<string, { x: number; y: number }> = {}
    for (const n of canvasNodes) {
      r[n.id] = positions[n.id] || FALLBACK_POS
    }
    return r
  }, [canvasNodes, positions])

  const resolvedPositions = stablePositions

  const resolveNodePosition = useCallback(
    (nodeId: string): { x: number; y: number } => resolvedPositions[nodeId] || FALLBACK_POS,
    [resolvedPositions]
  )

  const nodeHeightsSnapshot = useMemo(
    () => ({ ...nodeHeightsRef.current }),
    [layoutEpoch, positions]
  )

  const panelGridCacheRef = useRef<GridCacheEntry | null>(null)

  const visibleNodeIds = useMemo(() => {
    if (
      !viewportInfo ||
      canvasNodes.length === 0 ||
      viewportInfo.canvasWidth < 2 ||
      viewportInfo.canvasHeight < 2
    ) {
      return null
    }
    const vw = worldViewportFromCanvas(
      viewportInfo.canvasWidth,
      viewportInfo.canvasHeight,
      viewportInfo.scale,
      viewportInfo.position,
      IMPRENTA_VIEWPORT_CULL_PAD
    )
    // Use stable positions so the visible-id set does not churn while the user
    // drags a node. Drag origin is always kept in DOM via `domRenderNodes`.
    const cached = readCachedIdsAndGrid(
      panelGridCacheRef,
      canvasNodes,
      stablePositions,
      nodeHeightsRef.current,
      IMPRENTA_NODE_W,
      IMPRENTA_ROW_H
    )
    const candidates = collectIdsFromGrid(cached.grid, vw)
    const out = new Set<string>()
    candidates.forEach((id) => {
      const p = stablePositions[id]
      if (!p) return
      const h = nodeHeightsRef.current[id] || IMPRENTA_ROW_H
      const bbox: GraphBBox = {
        minX: p.x,
        minY: p.y,
        maxX: p.x + IMPRENTA_NODE_W,
        maxY: p.y + h,
      }
      if (bboxIntersects(bbox, vw)) out.add(id)
    })
    return out
  }, [canvasNodes, viewportInfo, stablePositions, layoutEpoch])

  useEffect(() => {
    const debounceId: ReturnType<typeof setTimeout> | null = null
    let lastKey: string | null = null
    const commit = (snap: ViewportSnapshot) => {
      setViewportInfo({
        scale: snap.scale,
        position: { ...snap.position },
        canvasWidth: snap.canvasWidth,
        canvasHeight: snap.canvasHeight,
      })
    }
    const unsub = viewportStore.subscribe((snap) => {
      if (snap.canvasWidth < 2 || snap.canvasHeight < 2) return
      const world = worldViewportFromCanvas(
        snap.canvasWidth,
        snap.canvasHeight,
        snap.scale,
        snap.position,
        IMPRENTA_VIEWPORT_UNMOUNT_PAD // Use the outer ring to avoid committing too frequently.
      )
      const key = `${quantizeViewport(world)}|${snap.scale >= IMPRENTA_LOD_FULL_DETAIL_SCALE ? "F" : "L"}`
      const crossedBoundary = key !== lastKey
      if (debounceId) clearTimeout(debounceId)
      if (!snap.interacting) {
        lastKey = key
        commit(snap)
        return
      }
      // During interaction, avoid committing React state. The canvas draws 
      // missing nodes in turbo mode.
      if (crossedBoundary) {
        lastKey = key
      }
    })
    return () => {
      unsub()
      if (debounceId) clearTimeout(debounceId)
    }
  }, [viewportStore])

  const parentEdgeStroke = isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)"

  const parentEdgeHoverStroke = isDarkMode ? "rgba(147,197,253,0.92)" : "rgba(37,99,235,0.88)"

  const handleImprentaNodeHover = useCallback((nodeId: string | null) => {
    if (viewportStoreRef.current?.get().interacting) return
    hoverStore.set(nodeId)
  }, [hoverStore])

  const isLargeGraph = isLargeImprentaGraph(canvasNodes.length)

  const showFullNodeDetail =
    !viewportInfo ||
    !isLargeGraph ||
    viewportInfo.scale >= IMPRENTA_LOD_FULL_DETAIL_SCALE

  const domOnlyNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const n of dummyNodes) ids.add(n.id)
    if (draggingNodeId) ids.add(draggingNodeId)
    if (tempConnection?.fromNode) ids.add(tempConnection.fromNode)
    return ids
  }, [dummyNodes, draggingNodeId, tempConnection?.fromNode])

  const domRenderNodes = useMemo(() => {
    const out: InstanceNode[] = []
    const vis = visibleNodeIds
    const all = canvasNodes
    for (let i = 0;i < all.length;i++) {
      const node = all[i]
      const isDummy = node.id.startsWith("dummy-")
      const hasResult = node.result && Object.keys(node.result as Record<string, unknown>).length > 0
      const isEffectivelyDummy =
        isDummy || (!hasResult && generatingNodeIds.has(node.id) && (node.status === "running" || node.status === "pending"))
      const isDragOrigin = draggingNodeId === node.id || tempConnection?.fromNode === node.id
      if (vis !== null && !vis.has(node.id) && !isDragOrigin) continue
      if (!showFullNodeDetail && !isEffectivelyDummy && !isDragOrigin) continue
      out.push(node)
    }

    // Sort by distance to center to prioritize mounting visible nodes
    if (viewportInfo && out.length > 12) {
      const worldCx = -viewportInfo.position.x / viewportInfo.scale + viewportInfo.canvasWidth / (2 * viewportInfo.scale)
      const worldCy = -viewportInfo.position.y / viewportInfo.scale + viewportInfo.canvasHeight / (2 * viewportInfo.scale)

      out.sort((a, b) => {
        const pA = stablePositions[a.id]
        const pB = stablePositions[b.id]
        if (!pA || !pB) return 0
        const dA = (pA.x + IMPRENTA_NODE_W / 2 - worldCx) ** 2 + (pA.y + IMPRENTA_ROW_H / 2 - worldCy) ** 2
        const dB = (pB.x + IMPRENTA_NODE_W / 2 - worldCx) ** 2 + (pB.y + IMPRENTA_ROW_H / 2 - worldCy) ** 2
        return dA - dB
      })
    }

    return out
  }, [
    canvasNodes,
    visibleNodeIds,
    showFullNodeDetail,
    draggingNodeId,
    tempConnection?.fromNode,
    generatingNodeIds,
    viewportInfo,
    stablePositions,
  ])

  const [mountedCount, setMountedCount] = useState(0)

  useEffect(() => {
    if (domRenderNodes.length > mountedCount) {
      const id = requestAnimationFrame(() => {
        // Mount 12 cards per frame to avoid blocking the main thread
        setMountedCount(c => Math.min(c + 12, domRenderNodes.length))
      })
      return () => cancelAnimationFrame(id)
    } else if (domRenderNodes.length < mountedCount) {
      setMountedCount(domRenderNodes.length)
    }
  }, [domRenderNodes.length, mountedCount])

  const slicedRenderNodes = useMemo(() => {
    return domRenderNodes.slice(0, mountedCount)
  }, [domRenderNodes, mountedCount])

  const mountedNodeIds = useMemo(() => {
    const ids = new Set<string>(domOnlyNodeIds)
    for (let i = 0;i < slicedRenderNodes.length;i++) {
      ids.add(slicedRenderNodes[i].id)
    }
    return ids
  }, [slicedRenderNodes, domOnlyNodeIds])

  const canvasGetImages = useCallback(
    (node: InstanceNode) => collectImprentaLiteImagePreviewUrls(node, 4),
    []
  )

  const canvasGetVideos = useCallback(
    (node: InstanceNode) => collectImprentaLiteVideoPreviewUrls(node, 2),
    []
  )

  const loadingNodeIds = useMemo(() => {
    const set = new Set<string>()
    for (const n of dummyNodes) set.add(n.id)
    for (const n of nodes) {
      if (n.id.startsWith("dummy-")) {
        set.add(n.id)
        continue
      }
      const hasResult =
        n.result && Object.keys(n.result as Record<string, unknown>).length > 0
      if (
        !hasResult &&
        generatingNodeIds.has(n.id) &&
        (n.status === "running" || n.status === "pending")
      ) {
        set.add(n.id)
      }
    }
    return set
  }, [nodes, dummyNodes, generatingNodeIds])

  const actionNodeIds = useMemo(() => {
    if (loadingNodeIds.size === 0) return new Set<string>()
    const out = new Set<string>()
    for (const n of canvasNodes) {
      if (!loadingNodeIds.has(n.id)) continue
      const parentId = n.parent_node_id
      if (!parentId) continue
      if (loadingNodeIds.has(parentId)) continue
      out.add(parentId)
    }
    return out
  }, [canvasNodes, loadingNodeIds])

  const nodesById = useMemo(() => {
    const map = new Map<string, InstanceNode>()
    for (const n of canvasNodes) map.set(n.id, n)
    return map
  }, [canvasNodes])

  const loadingRouteEdges = useMemo<Array<{ parentId: string; childId: string }>>(() => {
    if (loadingNodeIds.size === 0) return []
    const seen = new Set<string>()
    const edges: Array<{ parentId: string; childId: string }> = []
    loadingNodeIds.forEach((startId) => {
      let current = nodesById.get(startId)
      while (current) {
        const parentId = current.parent_node_id
        if (!parentId) break
        const key = `${parentId}->${current.id}`
        if (seen.has(key)) break
        seen.add(key)
        edges.push({ parentId, childId: current.id })
        current = nodesById.get(parentId)
      }
    })
    return edges
  }, [nodesById, loadingNodeIds])

  return {
    stablePositions,
    resolvedPositions,
    resolveNodePosition,
    nodeHeightsSnapshot,
    panelGridCacheRef,
    visibleNodeIds,
    parentEdgeStroke,
    parentEdgeHoverStroke,
    handleImprentaNodeHover,
    isLargeGraph,
    showFullNodeDetail,
    domOnlyNodeIds,
    domRenderNodes,
    mountedCount,
    setMountedCount,
    slicedRenderNodes,
    mountedNodeIds,
    canvasGetImages,
    canvasGetVideos,
    loadingNodeIds,
    actionNodeIds,
    nodesById,
    loadingRouteEdges,
  }
}

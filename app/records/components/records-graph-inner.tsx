"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ForceGraph2D from "react-force-graph-2d"
import { useTheme } from "@/app/context/ThemeContext"
import { Waypoints } from "@/app/components/ui/icons"
import type { GraphData, GraphNode, GraphEdge } from "./records-graph-model"
import { formatEntityTypeLabel } from "./records-graph-model"

export type RecordsGraphApi = {
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
}

interface RecordsGraphInnerProps {
  graphData: GraphData
  onNodeClick?: (node: GraphNode) => void
  onReady?: (api: RecordsGraphApi) => void
}

export function RecordsGraphInner({ graphData, onNodeClick, onReady }: RecordsGraphInnerProps) {
  const fgRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { isDarkMode: isDark } = useTheme()
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [hoverNode, setHoverNode] = useState<any>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const hoverNodeRef = useRef<any>(null)
  const rafRef = useRef(0)

  const updateHoverPos = useCallback((node: any | null) => {
    if (!node || node.x == null || node.y == null || !fgRef.current?.graph2ScreenCoords) {
      setHoverPos(null)
      return
    }
    const coords = fgRef.current.graph2ScreenCoords(node.x, node.y)
    setHoverPos((prev) => {
      if (prev && Math.abs(prev.x - coords.x) < 1 && Math.abs(prev.y - coords.y) < 1) return prev
      return { x: coords.x, y: coords.y }
    })
  }, [])

  const syncHoverPos = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      updateHoverPos(hoverNodeRef.current)
    })
  }, [updateHoverPos])
  
  // Compute neighbors for hover highlighting
  const { neighbors, linksByNode } = useMemo(() => {
    const n = new Map<string, Set<string>>()
    const l = new Map<string, Set<GraphEdge>>()
    
    graphData.nodes.forEach(node => {
      n.set(node.id, new Set())
      l.set(node.id, new Set())
    })

    graphData.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target
      
      n.get(sourceId)?.add(targetId)
      n.get(targetId)?.add(sourceId)
      l.get(sourceId)?.add(link)
      l.get(targetId)?.add(link)
    })
    return { neighbors: n, linksByNode: l }
  }, [graphData])

  const highlightNodes = useMemo(() => {
    const s = new Set<string>()
    if (hoverNode) {
      s.add(hoverNode.id)
      neighbors.get(hoverNode.id)?.forEach(id => s.add(id))
    }
    return s
  }, [hoverNode, neighbors])

  const highlightLinks = useMemo(() => {
    if (hoverNode) return linksByNode.get(hoverNode.id) || new Set<GraphEdge>()
    return new Set<GraphEdge>()
  }, [hoverNode, linksByNode])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = () => {
      const width = el.clientWidth
      const height = el.clientHeight
      if (width > 0 && height > 0) setDimensions({ width, height })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force?.("link")?.distance(220)
    fg.d3Force?.("charge")?.strength(-420)
    fg.d3Force?.("center")?.(dimensions.width / 2, dimensions.height / 2)
  }, [dimensions.width, dimensions.height, graphData.nodes.length])

  useEffect(() => {
    if (!fgRef.current || graphData.nodes.length === 0) return
    const timer = setTimeout(() => fgRef.current?.zoomToFit?.(400, 80), 350)
    return () => clearTimeout(timer)
  }, [graphData.nodes.length, graphData.links.length, dimensions.width, dimensions.height])

  useEffect(() => {
    if (!onReady) return
    onReady({
      zoomIn: () => {
        const fg = fgRef.current
        if (!fg?.zoom) return
        fg.zoom(fg.zoom() * 1.25, 250)
      },
      zoomOut: () => {
        const fg = fgRef.current
        if (!fg?.zoom) return
        fg.zoom(fg.zoom() / 1.25, 250)
      },
      fit: () => fgRef.current?.zoomToFit?.(400, 80),
    })
  }, [onReady, dimensions.width, dimensions.height])

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (node.x == null || node.y == null) return

    const isHovered = hoverNode?.id === node.id
    const isHighlighted = hoverNode ? highlightNodes.has(node.id) : false
    // Fade out nodes that are not highlighted when something is hovered
    const opacity = hoverNode ? (isHighlighted ? 1 : 0.1) : 1

    ctx.globalAlpha = opacity

    // Base circle for all nodes (Obsidian style)
    const r = Math.max(3, Math.sqrt(node.val || 10) * 1.5)
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
    ctx.fillStyle = node.color || "#64748b"
    ctx.fill()
    
    // Add border
    ctx.lineWidth = (node.isCurrent || isHovered ? 2 : 1) / globalScale
    ctx.strokeStyle = node.isCurrent || isHovered
      ? (isDark ? "#ffffff" : "#0f172a")
      : (isDark ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.4)")
    ctx.stroke()

    if ((globalScale > 0.6 || isHighlighted) && !isHovered) {
      const label = String(node.label || "Untitled")
      const fontSize = Math.max(10 / globalScale, 4)
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      const textY = node.y + r + 4
      
      if (isDark) {
        ctx.fillStyle = "rgba(226, 232, 240, 0.9)"
      } else {
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)"
      }
      ctx.fillText(label, node.x, textY)
    }

    ctx.globalAlpha = 1
  }, [isDark, hoverNode, highlightNodes])

  const paintPointer = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    if (node.x == null || node.y == null) return
    const r = Math.max(8, Math.sqrt(node.val || 10) * 2)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
    ctx.fill()
  }, [])

  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source
    const end = link.target
    if (typeof start !== "object" || typeof end !== "object") return
    if (start.x == null || start.y == null || end.x == null || end.y == null) return

    const isHighlighted = hoverNode ? highlightLinks.has(link) : false
    const opacity = hoverNode ? (isHighlighted ? 1 : 0.05) : (link.type === "similarity" ? 0.6 : 0.8)

    ctx.globalAlpha = opacity
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.setLineDash(link.type === "similarity" ? [4, 4] : [])
    
    // Highlighted links are thicker
    const baseWidth = link.type === "similarity" ? 1.2 : 0.8
    ctx.lineWidth = isHighlighted ? baseWidth * 2 : baseWidth
    
    ctx.strokeStyle = link.color || (isDark ? "#94a3b8" : "#64748b")
    ctx.stroke()
    ctx.setLineDash([])

    // Draw label ONLY if highlighted
    if (isHighlighted) {
      const label = link.label || (link.type === "similarity" ? `${Math.round((link.similarity || 0) * 100)}%` : "")
      if (!label) {
        ctx.globalAlpha = 1
        return
      }

      const midX = (start.x + end.x) / 2
      const midY = (start.y + end.y) / 2
      const fontSize = Math.max(10 / globalScale, 9)
      ctx.font = `${fontSize}px sans-serif`
      const labelWidth = ctx.measureText(label).width
      
      // bg
      ctx.fillStyle = isDark ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.95)"
      ctx.fillRect(midX - labelWidth / 2 - 4, midY - fontSize / 2 - 4, labelWidth + 8, fontSize + 8)
      
      // text
      ctx.fillStyle = isDark ? "#cbd5e1" : "#334155"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(label, midX, midY)
    }

    ctx.globalAlpha = 1
  }, [isDark, hoverNode, highlightLinks])

  return (
    <div ref={containerRef} className="absolute inset-0 [&_.graph-tooltip]:hidden">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeId="id"
          nodeVal="val"
          nodeLabel={() => ""}
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => "replace"}
          nodePointerAreaPaint={paintPointer}
          linkCanvasObject={paintLink}
          linkCanvasObjectMode={() => "replace"}
          backgroundColor="rgba(0,0,0,0)"
          onNodeHover={(node) => {
            hoverNodeRef.current = node || null
            setHoverNode(node || null)
            updateHoverPos(node || null)
          }}
          onZoom={syncHoverPos}
          onEngineTick={syncHoverPos}
          onNodeClick={(node: any) => {
            if (node.type === "record" && onNodeClick) onNodeClick(node as GraphNode)
          }}
          cooldownTicks={80}
          d3VelocityDecay={0.28}
          d3AlphaDecay={0.022}
        />
      )}

      {hoverNode && hoverPos && (
        <div
          className="pointer-events-none absolute z-20 w-[260px] rounded-lg border border-border bg-background/95 px-3.5 py-3 shadow-lg backdrop-blur-sm"
          style={{
            left: Math.min(hoverPos.x + 28, dimensions.width - 276),
            top: Math.max(12, Math.min(hoverPos.y - 40, dimensions.height - 168)),
          }}
        >
          <div className="mb-2.5 flex items-center gap-2">
            <Waypoints className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate text-[11px] text-muted-foreground">
              {hoverNode.type === "entity"
                ? formatEntityTypeLabel(hoverNode.entityType || hoverNode.categoryName)
                : (hoverNode.categoryName || "Record")}
            </span>
          </div>
          <div className="text-sm font-medium leading-snug">
            {hoverNode.label || "Untitled"}
          </div>
          {hoverNode.previewFields?.length ? (
            <div className="mt-3 space-y-2">
              {hoverNode.previewFields.slice(0, 4).map((field: { label: string; value: string }) => (
                <div key={field.label} className="flex items-start justify-between gap-4 text-xs">
                  <span className="shrink-0 text-muted-foreground">{field.label}</span>
                  <span className="min-w-0 text-right leading-snug">{field.value}</span>
                </div>
              ))}
            </div>
          ) : hoverNode.summary ? (
            <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {hoverNode.summary}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}

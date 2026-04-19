"use client"

import { useEffect, useRef } from "react"
import type { InstanceNode } from "@/app/types/instance-nodes"

export interface ImprentaParentEdgesCanvasProps {
  width: number
  height: number
  nodes: InstanceNode[]
  positions: Record<string, { x: number; y: number }>
  nodeHeights: Record<string, number>
  nodeW: number
  rowH: number
  strokeStyle: string
}

/**
 * Draws parent→child Bezier edges in one canvas (cheaper than many SVG paths at scale).
 */
export function ImprentaParentEdgesCanvas({
  width,
  height,
  nodes,
  positions,
  nodeHeights,
  nodeW,
  rowH,
  strokeStyle,
}: ImprentaParentEdgesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0 || height <= 0) return

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2)
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = 2
    ctx.lineCap = "round"

    for (const node of nodes) {
      if (!node.parent_node_id || !positions[node.id] || !positions[node.parent_node_id]) continue
      const start = positions[node.parent_node_id]
      const end = positions[node.id]
      const startCy = (nodeHeights[node.parent_node_id] || rowH) / 2
      const endCy = (nodeHeights[node.id] || rowH) / 2
      const x1 = start.x + nodeW
      const y1 = start.y + startCy
      const x2 = end.x
      const y2 = end.y + endCy
      const cx1 = x1 + 50
      const cy1 = y1
      const cx2 = x2 - 50
      const cy2 = y2
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2)
      ctx.stroke()
    }
  }, [width, height, nodes, positions, nodeHeights, nodeW, rowH, strokeStyle])

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden
    />
  )
}

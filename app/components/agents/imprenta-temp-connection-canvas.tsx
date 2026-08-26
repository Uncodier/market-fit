"use client"

import { useEffect, useRef } from "react"
import type { ViewportStore, ViewportSnapshot } from "@/app/lib/imprenta-viewport-store"
import type { ImprentaConnectionStore } from "@/app/lib/imprenta-connection-store"
import { worldConnectionBezier } from "@/app/lib/imprenta-world-svg"

type ImprentaTempConnectionCanvasProps = {
  connectionStore: ImprentaConnectionStore
  viewportStore: ViewportStore
  positions: Record<string, { x: number; y: number }>
  nodeHeights: Record<string, number>
  nodeW: number
  rowH: number
  strokeStyle: string
}

/**
 * Screen-space rubber-band for an in-progress node connection.
 *
 * Drawn on a viewport-sized canvas (not world SVG) so Safari icon CSS
 * (`svg { width: auto; transform: translateZ(0) }`) cannot collapse the stroke,
 * and so pointer moves update via rAF instead of reconciling the graph tree.
 */
export function ImprentaTempConnectionCanvas({
  connectionStore,
  viewportStore,
  positions,
  nodeHeights,
  nodeW,
  rowH,
  strokeStyle,
}: ImprentaTempConnectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
  const scheduleRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let rafId: number | null = null
    let lastSnapshot: ViewportSnapshot = viewportStore.get()

    const resizeToViewport = (snap: ViewportSnapshot) => {
      const maxDpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2)
      const dpr = snap.interacting ? 1 : maxDpr
      const parent = canvas.parentElement
      const w = Math.max(
        0,
        Math.floor(snap.canvasWidth || parent?.clientWidth || 0)
      )
      const h = Math.max(
        0,
        Math.floor(snap.canvasHeight || parent?.clientHeight || 0)
      )
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
      const ctx = canvas.getContext("2d", { alpha: true })
      if (!ctx) return

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const preview = connectionStore.get()
      if (!preview) return

      const from = positionsRef.current[preview.fromNode]
      if (!from) return

      const dpr = resizeToViewport(snap)
      const s = snap.scale || 1
      const originX = snap.position.x
      const originY = snap.position.y
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * originX, dpr * originY)

      const fromY = from.y + (heightsRef.current[preview.fromNode] || rowHRef.current) / 2
      const curve = worldConnectionBezier(
        from.x + nodeWRef.current,
        fromY,
        preview.toX,
        preview.toY
      )

      ctx.strokeStyle = strokeRef.current
      ctx.fillStyle = strokeRef.current
      ctx.lineWidth = Math.max(1.5, 2.5 / s)
      ctx.lineCap = "round"
      ctx.setLineDash([8 / s, 6 / s])
      ctx.beginPath()
      ctx.moveTo(curve.x1, curve.y1)
      ctx.bezierCurveTo(curve.cx1, curve.cy1, curve.cx2, curve.cy2, curve.x2, curve.y2)
      ctx.stroke()
      ctx.setLineDash([])

      const r = Math.max(3.5, 5 / s)
      ctx.beginPath()
      ctx.arc(curve.x2, curve.y2, r, 0, Math.PI * 2)
      ctx.fill()
    }

    const schedule = () => {
      if (rafId != null) return
      rafId = window.requestAnimationFrame(draw)
    }
    scheduleRef.current = schedule

    const unsubViewport = viewportStore.subscribe((snap) => {
      lastSnapshot = snap
      schedule()
    })
    const unsubConnection = connectionStore.subscribe(() => schedule())
    schedule()

    return () => {
      unsubViewport()
      unsubConnection()
      scheduleRef.current = null
      if (rafId != null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
    }
  }, [connectionStore, viewportStore])

  useEffect(() => {
    scheduleRef.current?.()
  }, [positions, nodeHeights, nodeW, rowH, strokeStyle])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5, width: "100%", height: "100%" }}
      aria-hidden
    />
  )
}

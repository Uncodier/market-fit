"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"

type Props = {
  disabled?: boolean
  onChange: (dataUrl: string | null) => void
}

type Point = { x: number; y: number; t: number }

const PAD_HEIGHT = 200
const MIN_WIDTH = 1.25
const MAX_WIDTH = 3.6

function distance(a: Point, b: Point) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function strokeWidth(prev: Point, next: Point) {
  const dt = Math.max(next.t - prev.t, 1)
  const velocity = distance(prev, next) / dt
  const width = MAX_WIDTH - velocity * 2.4
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width))
}

function configureContext(ctx: CanvasRenderingContext2D, ratio: number) {
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.strokeStyle = "#111827"
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
}

function paintBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.beginPath()
  ctx.strokeStyle = "rgba(17, 24, 39, 0.12)"
  ctx.lineWidth = 1
  ctx.setLineDash([6, 6])
  ctx.moveTo(16, height * 0.72)
  ctx.lineTo(width - 16, height * 0.72)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.strokeStyle = "#111827"
}

export function SignaturePad({ disabled, onChange }: Props) {
  const { t } = useLocalization()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<Point | null>(null)
  const lastMid = useRef<Point | null>(null)
  const hasStrokeRef = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const ratio = Math.max(window.devicePixelRatio || 1, 2)
      const width = parent.clientWidth
      const height = PAD_HEIGHT
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      configureContext(ctx, ratio)
      paintBackground(ctx, width, height)
      hasStrokeRef.current = false
      setHasStroke(false)
      onChange(null)
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: performance.now(),
    }
  }

  const emit = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokeRef.current) {
      onChange(null)
      return
    }
    onChange(canvas.toDataURL("image/png"))
  }

  const markStroke = () => {
    if (hasStrokeRef.current) return
    hasStrokeRef.current = true
    setHasStroke(true)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    e.preventDefault()
    drawing.current = true
    canvas.setPointerCapture(e.pointerId)
    const p = getPoint(e)
    lastPoint.current = p
    lastMid.current = null
    ctx.beginPath()
    ctx.fillStyle = "#111827"
    ctx.arc(p.x, p.y, MAX_WIDTH * 0.45, 0, Math.PI * 2)
    ctx.fill()
    markStroke()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return
    const ctx = canvasRef.current?.getContext("2d")
    const prev = lastPoint.current
    if (!ctx || !prev) return
    e.preventDefault()

    const next = getPoint(e)
    if (distance(prev, next) < 0.8) return

    const mid: Point = {
      x: (prev.x + next.x) / 2,
      y: (prev.y + next.y) / 2,
      t: next.t,
    }

    ctx.beginPath()
    ctx.lineWidth = strokeWidth(prev, next)
    ctx.strokeStyle = "#111827"

    if (lastMid.current) {
      ctx.moveTo(lastMid.current.x, lastMid.current.y)
      ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y)
    } else {
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(mid.x, mid.y)
    }
    ctx.stroke()

    lastMid.current = mid
    lastPoint.current = next
    markStroke()
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext("2d")
    const prev = lastPoint.current
    const mid = lastMid.current
    if (ctx && prev && mid) {
      ctx.beginPath()
      ctx.lineWidth = MIN_WIDTH + 0.4
      ctx.strokeStyle = "#111827"
      ctx.moveTo(mid.x, mid.y)
      ctx.lineTo(prev.x, prev.y)
      ctx.stroke()
    }
    drawing.current = false
    lastPoint.current = null
    lastMid.current = null
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      // already released
    }
    emit()
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    paintBackground(ctx, canvas.clientWidth, canvas.clientHeight)
    hasStrokeRef.current = false
    setHasStroke(false)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-white overflow-hidden touch-none shadow-inner">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">{t("visits.signature.hint")}</p>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={disabled || !hasStroke}>
          {t("visits.signature.clear")}
        </Button>
      </div>
    </div>
  )
}

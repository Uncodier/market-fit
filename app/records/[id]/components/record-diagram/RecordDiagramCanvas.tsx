"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { Button } from "@/app/components/ui/button"
import { LayoutGrid, Maximize, ZoomIn, ZoomOut } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import type {
  RecordDiagramBackground,
  RecordDiagramViewport,
} from "@/app/records/lib/record-diagram"

type RecordDiagramCanvasProps = {
  children: ReactNode
  className?: string
  bounds: { width: number; height: number; offsetX?: number; offsetY?: number }
  initialViewport: RecordDiagramViewport
  background?: RecordDiagramBackground
  enabled?: boolean
  selectionBounds?: { x: number; y: number; width: number; height: number } | null
  extraControls?: ReactNode
  floatingPanel?: ReactNode
  onSort: () => void
  onViewportChange: (viewport: RecordDiagramViewport) => void
  onWorldPointerMove?: (point: { x: number; y: number }) => void
}

const MIN_ZOOM = 0.2
const MAX_ZOOM = 4

export function RecordDiagramCanvas({
  children,
  className,
  bounds,
  initialViewport,
  background = "dots",
  enabled = true,
  selectionBounds,
  extraControls,
  floatingPanel,
  onSort,
  onViewportChange,
  onWorldPointerMove,
}: RecordDiagramCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef(initialViewport)
  const dragRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
  } | null>(null)
  const [viewport, setViewport] = useState(initialViewport)
  const [isPanning, setIsPanning] = useState(false)

  const commitViewport = useCallback((next: RecordDiagramViewport) => {
    viewportRef.current = next
    setViewport(next)
    onViewportChange(next)
  }, [onViewportChange])

  const fit = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const padding = 64
    const zoom = clamp(Math.min(
      (rect.width - padding * 2) / Math.max(bounds.width, 1),
      (rect.height - padding * 2) / Math.max(bounds.height, 1),
      1
    ))
    commitViewport({
      ...viewportRef.current,
      zoom,
      x: (rect.width - bounds.width * zoom) / 2 - (bounds.offsetX || 0) * zoom,
      y: (rect.height - bounds.height * zoom) / 2 - (bounds.offsetY || 0) * zoom,
    })
  }, [bounds.height, bounds.offsetX, bounds.offsetY, bounds.width, commitViewport])

  const fitSelection = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !selectionBounds) return
    const rect = canvas.getBoundingClientRect()
    const padding = 96
    const zoom = clamp(Math.min(
      (rect.width - padding * 2) / Math.max(selectionBounds.width, 1),
      (rect.height - padding * 2) / Math.max(selectionBounds.height, 1),
      2,
    ))
    commitViewport({
      ...viewportRef.current,
      zoom,
      x: (rect.width - selectionBounds.width * zoom) / 2 - selectionBounds.x * zoom,
      y: (rect.height - selectionBounds.height * zoom) / 2 - selectionBounds.y * zoom,
    })
  }, [commitViewport, selectionBounds])

  const zoomAtCenter = useCallback((factor: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const current = viewportRef.current
    const zoom = clamp(current.zoom * factor)
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const ratio = zoom / current.zoom
    commitViewport({
      ...current,
      zoom,
      x: centerX - (centerX - current.x) * ratio,
      y: centerY - (centerY - current.y) * ratio,
    })
  }, [commitViewport])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!(event.target as HTMLElement).closest("input, textarea, select, [contenteditable='true']")) {
      event.currentTarget.focus({ preventScroll: true })
    }
    if (
      event.button !== 0
      || (event.target as HTMLElement).closest(
        "button, input, textarea, select, [role='button'], [data-diagram-node]"
      )
    ) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    }
    setIsPanning(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const current = viewportRef.current
    if (rect && onWorldPointerMove) {
      onWorldPointerMove({
        x: (event.clientX - rect.left - current.x) / current.zoom,
        y: (event.clientY - rect.top - current.y) / current.zoom,
      })
    }

    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const next = {
      ...current,
      x: current.x + event.clientX - drag.clientX,
      y: current.y + event.clientY - drag.clientY,
    }
    drag.clientX = event.clientX
    drag.clientY = event.clientY
    commitViewport(next)
  }

  const endPointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setIsPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const current = viewportRef.current
      if (event.ctrlKey || event.metaKey) {
        const rect = canvas.getBoundingClientRect()
        const pointerX = event.clientX - rect.left
        const pointerY = event.clientY - rect.top
        const delta = Math.max(-20, Math.min(20, event.deltaY))
        const zoom = clamp(current.zoom * Math.exp(-delta * 0.005))
        const ratio = zoom / current.zoom
        commitViewport({
          ...current,
          zoom,
          x: pointerX - (pointerX - current.x) * ratio,
          y: pointerY - (pointerY - current.y) * ratio,
        })
        return
      }

      const horizontalDelta = event.shiftKey && event.deltaX === 0
        ? event.deltaY
        : event.deltaX
      const verticalDelta = event.shiftKey && event.deltaX === 0 ? 0 : event.deltaY
      commitViewport({
        ...current,
        x: current.x - horizontalDelta,
        y: current.y - verticalDelta,
      })
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", handleWheel)
  }, [commitViewport])

  useEffect(() => {
    if (!enabled) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === "+" || event.key === "=") {
        event.preventDefault()
        zoomAtCenter(1.15)
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault()
        zoomAtCenter(0.85)
      } else if (event.key === "1" && !event.shiftKey) {
        event.preventDefault()
        fit()
      } else if (event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault()
        onSort()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enabled, fit, onSort, zoomAtCenter])

  return (
    <div className={cn("relative h-full min-h-0 overflow-hidden", className)}>
      {floatingPanel && (
        <div
          className="absolute right-4 top-4 z-40"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {floatingPanel}
        </div>
      )}
      <div
        className="absolute bottom-4 left-4 z-30 flex items-center gap-1.5 rounded-lg border border-black/5 bg-background/95 p-1.5 shadow-md backdrop-blur-sm dark:border-white/5"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <CanvasButton label="Zoom in" onClick={() => zoomAtCenter(1.15)}>
          <ZoomIn className="h-4 w-4" />
        </CanvasButton>
        <CanvasButton label="Zoom out" onClick={() => zoomAtCenter(0.85)}>
          <ZoomOut className="h-4 w-4" />
        </CanvasButton>
        <CanvasButton label="Fit diagram" onClick={fit}>
          <Maximize className="h-4 w-4" />
        </CanvasButton>
        <CanvasButton
          label="Fit selection"
          disabled={!selectionBounds}
          onClick={fitSelection}
        >
          <Maximize className="h-3.5 w-3.5" />
        </CanvasButton>
        <CanvasButton label="Arrange nodes" onClick={onSort}>
          <LayoutGrid className="h-4 w-4" />
        </CanvasButton>
        {extraControls && (
          <div className="ml-1 flex items-center border-l border-border pl-1.5">
            {extraControls}
          </div>
        )}
      </div>

      <div
        ref={canvasRef}
        data-testid="record-diagram-canvas"
        tabIndex={0}
        aria-label="Record diagram canvas"
        className={cn(
          "h-full w-full touch-none select-none overflow-hidden",
          isPanning ? "cursor-grabbing" : "cursor-grab"
        )}
        style={getCanvasBackgroundStyle(background, viewport)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerDrag}
        onPointerCancel={endPointerDrag}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: bounds.width,
            height: bounds.height,
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function getCanvasBackgroundStyle(
  background: RecordDiagramBackground,
  viewport: RecordDiagramViewport,
): CSSProperties {
  const position = `${viewport.x}px ${viewport.y}px`
  if (background === "plain") return {}
  if (background === "dots") {
    return {
      backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
      backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
      backgroundPosition: position,
    }
  }
  if (background === "grid") {
    return {
      backgroundImage: [
        "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)",
        "linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)",
      ].join(", "),
      backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
      backgroundPosition: position,
    }
  }
  const vertical = background === "columns"
  const spacing = (vertical ? 320 : 240) * viewport.zoom
  return {
    backgroundImage: vertical
      ? "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)"
      : "linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)",
    backgroundSize: vertical ? `${spacing}px 100%` : `100% ${spacing}px`,
    backgroundPosition: position,
  }
}

function CanvasButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  )
}

function clamp(value: number) {
  return Math.max(MIN_ZOOM, Math.min(value, MAX_ZOOM))
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || target.tagName === "INPUT"
    || target.tagName === "TEXTAREA"
    || target.tagName === "SELECT"
  )
}

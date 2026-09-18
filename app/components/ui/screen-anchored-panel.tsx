"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

type ScreenPoint = { x: number; y: number }

export function ScreenAnchoredPanel({
  anchor,
  alignY = "after",
  children,
}: {
  anchor: ScreenPoint
  alignY?: "after" | "center"
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(anchor)

  useLayoutEffect(() => {
    const updatePosition = () => {
      const panel = panelRef.current
      if (!panel) return
      const rect = panel.getBoundingClientRect()
      const gap = 10
      const margin = 8
      const preferredX = anchor.x + gap
      const preferredY = alignY === "center"
        ? anchor.y - rect.height / 2
        : anchor.y + gap
      setPosition({
        x: Math.max(
          margin,
          Math.min(
            preferredX + rect.width > window.innerWidth - margin
              ? anchor.x - rect.width - gap
              : preferredX,
            window.innerWidth - rect.width - margin,
          ),
        ),
        y: Math.max(
          margin,
          Math.min(
            alignY === "after" && preferredY + rect.height > window.innerHeight - margin
              ? anchor.y - rect.height - gap
              : preferredY,
            window.innerHeight - rect.height - margin,
          ),
        ),
      })
    }
    updatePosition()
    window.addEventListener("resize", updatePosition)
    return () => window.removeEventListener("resize", updatePosition)
  }, [alignY, anchor])

  if (typeof document === "undefined") return null
  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[100] pointer-events-auto"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

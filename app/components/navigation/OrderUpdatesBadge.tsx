"use client"

import {
  useLayoutEffect,
  useState,
  type RefObject,
} from "react"

export function OrderUpdatesBadge({
  count,
  anchorRef,
  containerRef,
}: {
  count: number
  anchorRef: RefObject<HTMLElement | null>
  containerRef: RefObject<HTMLElement | null>
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  )

  useLayoutEffect(() => {
    if (count <= 0) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      const anchor = anchorRef.current
      const container = containerRef.current
      if (!anchor || !container) return
      const anchorRect = anchor.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      setPosition({
        left:
          anchorRect.left -
          containerRect.left +
          (anchorRect.width - 16) / 2 -
          10,
        top: anchorRect.top - containerRect.top - 7,
      })
    }

    updatePosition()
    const frame = window.requestAnimationFrame(updatePosition)
    const observer = new ResizeObserver(updatePosition)
    if (anchorRef.current) observer.observe(anchorRef.current)
    if (containerRef.current) observer.observe(containerRef.current)
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [anchorRef, containerRef, count])

  if (count <= 0 || !position) return null

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute z-20 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-1 ring-background"
      style={{ left: position.left, top: position.top }}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

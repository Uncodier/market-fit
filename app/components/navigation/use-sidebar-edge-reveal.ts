import { useCallback, useEffect, useRef, useState } from "react"
import { WORKSPACE_SIDEBAR_WIDTH } from "./workspace-sidebar-mode"

const REVEAL_EDGE_WIDTH = 8

export function useSidebarEdgeReveal(enabled: boolean, route: string) {
  const [revealed, setRevealed] = useState(false)
  const dismissRef = useRef<(() => void) | null>(null)
  const dismiss = useCallback(() => dismissRef.current?.(), [])

  useEffect(() => {
    if (!enabled) return
    let isRevealed = false
    let pointerAtEdge = false
    let requireEdgeReentry = false
    const update = (next: boolean) => {
      if (next === isRevealed) return
      isRevealed = next
      setRevealed(next)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.buttons !== 0) return
      pointerAtEdge = event.clientX >= 0 && event.clientX < REVEAL_EDGE_WIDTH
      if (requireEdgeReentry) {
        if (!pointerAtEdge) requireEdgeReentry = false
        return
      }
      const boundary = isRevealed ? WORKSPACE_SIDEBAR_WIDTH.compact : REVEAL_EDGE_WIDTH
      update(event.clientX >= 0 && event.clientX < boundary)
    }
    const reset = () => {
      pointerAtEdge = false
      requireEdgeReentry = false
      update(false)
    }
    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) reset()
    }
    dismissRef.current = () => {
      if (!isRevealed) return
      requireEdgeReentry = pointerAtEdge
      update(false)
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true, capture: true })
    window.addEventListener("pointerout", onPointerOut)
    window.addEventListener("blur", reset)
    return () => {
      window.removeEventListener("pointermove", onPointerMove, true)
      window.removeEventListener("pointerout", onPointerOut)
      window.removeEventListener("blur", reset)
      dismissRef.current = null
      reset()
    }
  }, [enabled])

  useEffect(() => { dismiss() }, [route, dismiss])

  return { revealed: enabled && revealed, dismiss }
}
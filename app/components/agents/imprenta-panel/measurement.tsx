import { useEffect, useMemo, useCallback } from "react"
import { useTheme } from "@/app/context/ThemeContext"

import type { useImprentaPanelState } from './state'
import type { useImprentaLayout } from "./graph-layout"

type ImprentaMeasurementOptions = Pick<ReturnType<typeof useImprentaPanelState>, "nodeElementsRef" | "resizeObserverRef" | "nodeHeightsRef" | "resizeObserverRafRef" | "setLayoutEpoch" | "setPositions" | "nodesRef" | "nodes" | "dummyNodes" | "positionsRef" | "positions"> & Pick<ReturnType<typeof useImprentaLayout>, "getLayoutPositions">

export function useImprentaMeasurement({
  nodeElementsRef,
  resizeObserverRef,
  nodeHeightsRef,
  resizeObserverRafRef,
  setLayoutEpoch,
  setPositions,
  getLayoutPositions,
  nodesRef,
  nodes,
  dummyNodes,
  positionsRef,
  positions,
}: ImprentaMeasurementOptions) {
  const registerNodeRef = useCallback((nodeId: string, el: HTMLDivElement | null, observeForLayout = true) => {
    if (el) {
      nodeElementsRef.current[nodeId] = el
      if (observeForLayout) resizeObserverRef.current?.observe(el)
    } else {
      const prev = nodeElementsRef.current[nodeId]
      if (prev) {
        try {
          resizeObserverRef.current?.unobserve(prev)
        } catch {
          /* already unobserved */
        }
        delete nodeElementsRef.current[nodeId]
      }
    }
  }, [])

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      let changed = false
      for (const entry of entries) {
        const el = entry.target as HTMLDivElement
        if (el.dataset.imprentaLite === "1") continue
        const nodeId = el.dataset.nodeId
        if (!nodeId) continue
        const h = Math.ceil(entry.contentRect.height)
        if (nodeHeightsRef.current[nodeId] !== h) {
          nodeHeightsRef.current[nodeId] = h
          changed = true
        }
      }
      if (changed) {
        if (resizeObserverRafRef.current != null) return
        resizeObserverRafRef.current = requestAnimationFrame(() => {
          resizeObserverRafRef.current = null
          setLayoutEpoch((e) => e + 1)
          setPositions((prev) =>
            getLayoutPositions(nodesRef.current, prev, nodeHeightsRef.current)
          )
        })
      }
    })
    resizeObserverRef.current = ro
    return () => {
      if (resizeObserverRafRef.current != null) {
        cancelAnimationFrame(resizeObserverRafRef.current)
        resizeObserverRafRef.current = null
      }
      ro.disconnect()
    }
  }, [])

  const canvasNodes = useMemo(() => [...nodes, ...dummyNodes], [nodes, dummyNodes])

  positionsRef.current = positions;

  nodesRef.current = canvasNodes;

  const { isDarkMode } = useTheme()

  return { registerNodeRef, canvasNodes, isDarkMode }
}

import { useEffect, useMemo, useState } from 'react'
import type { InstanceNode } from '@/app/types/instance-nodes'
import type { ViewportStore } from '@/app/lib/imprenta-viewport-store'
import type { ZoomableViewportInfo } from '../zoomable-canvas'
import { IMPRENTA_NODE_W, IMPRENTA_ROW_H } from './preview-helpers'

export const AUTO_EDITOR_ENTER_SCALE = 0.85
export const AUTO_EDITOR_EXIT_SCALE = 0.65
export const AUTO_EDITOR_LIMIT = 8
export const AUTO_EDITOR_BATCH = 2

export function closeEditorZoom(previous: boolean, scale: number) {
  return Number.isFinite(scale) && (previous ? scale >= AUTO_EDITOR_EXIT_SCALE : scale >= AUTO_EDITOR_ENTER_SCALE)
}

/** No overscan for automatic forms: the expensive DOM is only useful on screen. */
export function nearbyEditorIds(nodes: InstanceNode[], positions: Record<string, { x: number; y: number }>,
  heights: Record<string, number>, view: ZoomableViewportInfo | null): string[] {
  if (!view || view.canvasWidth < 2 || view.canvasHeight < 2 || !(view.scale > 0)) return []
  const left = -view.position.x / view.scale, top = -view.position.y / view.scale
  const right = left + view.canvasWidth / view.scale, bottom = top + view.canvasHeight / view.scale
  const centerX = (left + right) / 2, centerY = (top + bottom) / 2
  return nodes.filter(node => {
    if (node.id.startsWith('dummy-')) return false
    const p = positions[node.id]
    return p && p.x < right && p.x + IMPRENTA_NODE_W > left && p.y < bottom
      && p.y + (heights[node.id] || IMPRENTA_ROW_H) > top
  }).map(node => {
    const p = positions[node.id]
    return { id: node.id, distance: (p.x + IMPRENTA_NODE_W / 2 - centerX) ** 2
      + (p.y + (heights[node.id] || IMPRENTA_ROW_H) / 2 - centerY) ** 2 }
  }).sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
    .slice(0, AUTO_EDITOR_LIMIT).map(node => node.id)
}

export function useAutomaticEditors({ enabled, scope, nodes, positions, heights, viewport, store }: {
  enabled: boolean
  scope?: string
  nodes: InstanceNode[]
  positions: Record<string, { x: number; y: number }>
  heights: Record<string, number>
  viewport: ZoomableViewportInfo | null
  store: ViewportStore
}) {
  // viewport is the settled React snapshot, not the per-frame camera position.
  const [mode, setMode] = useState({ scope, viewport, enabled, near: enabled && closeEditorZoom(false, viewport?.scale ?? 0) })
  if (mode.scope !== scope || mode.viewport !== viewport || mode.enabled !== enabled) {
    setMode({ scope, viewport, enabled, near: enabled && closeEditorZoom(mode.scope === scope && mode.near, viewport?.scale ?? 0) })
  }
  const near = enabled && mode.scope === scope && mode.near
  const desired = useMemo(() => near ? nearbyEditorIds(nodes, positions, heights, viewport) : [],
    [near, nodes, positions, heights, viewport])
  const desiredKey = JSON.stringify(desired)
  const [mounted, setMounted] = useState<{ scope?: string; ids: string[] }>({ scope, ids: [] })

  useEffect(() => {
    // A zoom-out releases automatic cards at the crossing, not after every wheel
    // event or after a long gesture. Entering waits for the settled snapshot.
    return store.subscribe(snapshot => {
      if (snapshot.scale < AUTO_EDITOR_EXIT_SCALE) {
        setMode(previous => previous.near ? { ...previous, near: false } : previous)
      }
    })
  }, [store])

  useEffect(() => {
    let frame: number | null = null
    const wanted: string[] = JSON.parse(desiredKey)
    const advance = () => {
      if (frame !== null || (wanted.length && store.get().interacting)) return
      frame = requestAnimationFrame(() => {
        frame = null
        // Never mount forms while the camera is still moving.
        if (wanted.length && (store.get().interacting || store.get().scale < AUTO_EDITOR_EXIT_SCALE)) return
        setMounted(previous => {
          const retained = previous.scope === scope ? previous.ids.filter(id => wanted.includes(id)) : []
          const missing = wanted.filter(id => !retained.includes(id))
          const ids = [...retained, ...missing.slice(0, AUTO_EDITOR_BATCH)]
          return { scope, ids }
        })
      })
    }
    const current = mounted.scope === scope ? mounted.ids : []
    const needsUpdate = current.length !== wanted.length || wanted.some(id => !current.includes(id))
    if (needsUpdate) advance()
    const unsubscribe = needsUpdate ? store.subscribe(snapshot => {
      if (!snapshot.interacting) advance()
    }) : () => {}
    return () => { unsubscribe(); if (frame !== null) cancelAnimationFrame(frame) }
  }, [desiredKey, mounted, scope, store])

  return useMemo(() => new Set(mounted.scope === scope ? mounted.ids.filter(id => desired.includes(id)) : []),
    [mounted, scope, desired])
}
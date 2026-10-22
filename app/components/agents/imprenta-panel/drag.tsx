import { useCallback } from "react"

import type { useImprentaPanelState } from './state'

type ImprentaDraggingOptions = Pick<ReturnType<typeof useImprentaPanelState>, "draggingNodeRef" | "nodeDragMovedRef" | "dragStartPosRef" | "viewportStore" | "dragStartNodePosRef" | "lastNodeDragPosRef" | "nodeElementsRef" | "nodeDragRafRef" | "dragStore" | "setDraggingNodeId" | "setPositions" | "nodesRef" | "setNodes" | "supabase" | "positionsRef">

export function useImprentaDragging({
  draggingNodeRef,
  nodeDragMovedRef,
  dragStartPosRef,
  viewportStore,
  dragStartNodePosRef,
  lastNodeDragPosRef,
  nodeElementsRef,
  nodeDragRafRef,
  dragStore,
  setDraggingNodeId,
  setPositions,
  nodesRef,
  setNodes,
  supabase,
  positionsRef,
}: ImprentaDraggingOptions) {
  const handleWindowMouseMove = useCallback((e: MouseEvent) => {
    const nodeId = draggingNodeRef.current
    if (!nodeId) return

    if (!nodeDragMovedRef.current) {
      if (Math.abs(e.clientX - dragStartPosRef.current.x) > 5 || Math.abs(e.clientY - dragStartPosRef.current.y) > 5) {
        nodeDragMovedRef.current = true
      }
    }

    // Prevent text selection while dragging the card.
    e.preventDefault()
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges()
    }

    let scale = 1
    const snap = viewportStore.get()
    if (snap) {
      scale = snap.scale
    }

    const dx = (e.clientX - dragStartPosRef.current.x) / scale
    const dy = (e.clientY - dragStartPosRef.current.y) / scale

    const nx = dragStartNodePosRef.current.x + dx
    const ny = dragStartNodePosRef.current.y + dy
    lastNodeDragPosRef.current = { x: nx, y: ny }

    const el = nodeElementsRef.current[nodeId]
    if (el) {
      el.style.transform = `translate3d(${nx}px, ${ny}px, 0)`
    }

    if (nodeDragRafRef.current == null) {
      nodeDragRafRef.current = requestAnimationFrame(() => {
        nodeDragRafRef.current = null
        const id = draggingNodeRef.current
        const last = lastNodeDragPosRef.current
        if (id && last) {
          dragStore.set({ id, x: last.x, y: last.y })
        }
      })
    }
  }, [])

  const handleWindowMouseUp = useCallback(async function handleWindowMouseUp() {
    const nodeId = draggingNodeRef.current
    if (!nodeId) return

    const newPos = lastNodeDragPosRef.current
    const didMove = nodeDragMovedRef.current
    if (nodeDragRafRef.current != null) {
      cancelAnimationFrame(nodeDragRafRef.current)
      nodeDragRafRef.current = null
    }

    // Finish the drag immediately before awaiting persistence.
    draggingNodeRef.current = null
    window.removeEventListener('pointermove', handleWindowMouseMove)
    window.removeEventListener('pointerup', handleWindowMouseUp)

    if (nodeDragMovedRef.current) {
      const suppressClick = (ev: MouseEvent) => {
        ev.stopPropagation()
        ev.preventDefault()
        window.removeEventListener('click', suppressClick, { capture: true })
      }
      window.addEventListener('click', suppressClick, { capture: true })
      setTimeout(() => window.removeEventListener('click', suppressClick, { capture: true }), 0)
    }

    dragStore.set(null)
    setDraggingNodeId(null)
    nodeDragMovedRef.current = false

    // A click or double click is not a drag. Avoid a no-op database update,
    // which otherwise produces a realtime UPDATE capable of changing how a
    // response node is normalized and rendered.
    if (!didMove) {
      lastNodeDragPosRef.current = null
      return
    }

    if (newPos) {
      setPositions((prev) => ({ ...prev, [nodeId]: newPos }))
    }

    const nodeToUpdate = nodesRef.current.find(n => n.id === nodeId)
    if (nodeToUpdate && newPos) {
      const updatedSettings = { ...((nodeToUpdate.settings) || {}), ui_position: newPos }
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, settings: updatedSettings } : n));
      try {
        await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', nodeId)
      } catch (err) {
        console.error("Failed to update node position", err)
      }
    }
  }, [handleWindowMouseMove])

  const beginNodeDrag = useCallback((nodeId: string, clientX: number, clientY: number) => {
    nodeDragMovedRef.current = false
    draggingNodeRef.current = nodeId
    dragStartPosRef.current = { x: clientX, y: clientY }
    dragStartNodePosRef.current = {
      x: positionsRef.current[nodeId]?.x || 0,
      y: positionsRef.current[nodeId]?.y || 0,
    }
    lastNodeDragPosRef.current = {
      x: dragStartNodePosRef.current.x,
      y: dragStartNodePosRef.current.y,
    }
    dragStore.set({
      id: nodeId,
      x: dragStartNodePosRef.current.x,
      y: dragStartNodePosRef.current.y,
    })
    setDraggingNodeId(nodeId)

    // Ensure we don't attach multiple times if somehow called twice
    window.removeEventListener('pointermove', handleWindowMouseMove)
    window.removeEventListener('pointerup', handleWindowMouseUp)

    window.addEventListener('pointermove', handleWindowMouseMove)
    window.addEventListener('pointerup', handleWindowMouseUp)
  }, [handleWindowMouseMove, handleWindowMouseUp])

  const handleCanvasNodePointerDown = useCallback((nodeId: string, ev: PointerEvent) => {
    if (ev.button !== 0) return
    const target = ev.target as HTMLElement
    if (target && (target.closest('button') || target.closest('textarea') || target.closest('input') || target.closest('a') || target.closest('[role="button"]') || target.closest('[role="menuitem"]') || target.closest('[role="menu"]') || target.closest('[role="dialog"]') || target.closest('[role="listbox"]') || target.closest('[role="option"]') || target.closest('[role="combobox"]') || target.closest('[role="tab"]') || target.closest('[role="tabpanel"]'))) {
      return;
    }

    ev.stopPropagation()
    ev.preventDefault()
    beginNodeDrag(nodeId, ev.clientX, ev.clientY)
  }, [beginNodeDrag])

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return // Only left click
    if (e.detail > 1) {
      e.stopPropagation()
      e.preventDefault()
      return
    }
    const target = e.target as HTMLElement
    // Prevent dragging if clicking on an input/button or an SVG icon inside a button
    if (target.closest('button') || target.closest('textarea') || target.closest('input') || target.closest('a') || target.closest('[role="button"]') || target.closest('[role="menuitem"]') || target.closest('[role="menu"]') || target.closest('[role="dialog"]') || target.closest('[role="listbox"]') || target.closest('[role="option"]') || target.closest('[role="combobox"]') || target.closest('[role="tab"]') || target.closest('[role="tabpanel"]')) {
      return;
    }

    e.stopPropagation()
    // Explicitly prevent native dragging of images and elements.
    e.preventDefault();

    beginNodeDrag(nodeId, e.clientX, e.clientY)
  }

  return { handleWindowMouseMove, handleWindowMouseUp, beginNodeDrag, handleCanvasNodePointerDown, handleNodeMouseDown }
}

"use client"

import { useEffect } from "react"

type RecordDiagramShortcutActions = {
  active: boolean
  nodeIds: string[]
  selectedNodeCount: number
  selectedEdgeId: string | null
  undo: () => void
  redo: () => void
  copy: () => void
  paste: () => void
  duplicate: () => void
  selectAll: (ids: string[]) => void
  deleteNodes: () => void
  deleteEdge: (id: string) => void
  clearSelection: () => void
  clearEdgeSelection: () => void
  cancelConnection: () => void
}

export function useRecordDiagramShortcuts(actions: RecordDiagramShortcutActions) {
  useEffect(() => {
    if (!actions.active) return
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const focusedElement = document.activeElement
      if (
        !(focusedElement instanceof HTMLElement)
        || !focusedElement.closest("[data-record-diagram-editor]")
      ) return
      if (
        target instanceof HTMLElement
        && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) return

      const command = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (command && key === "z") {
        event.preventDefault()
        if (event.shiftKey) actions.redo()
        else actions.undo()
      } else if (command && key === "y") {
        event.preventDefault()
        actions.redo()
      } else if (command && key === "c" && actions.selectedNodeCount > 0) {
        event.preventDefault()
        actions.copy()
      } else if (command && key === "v") {
        event.preventDefault()
        actions.paste()
      } else if (command && key === "d" && actions.selectedNodeCount > 0) {
        event.preventDefault()
        actions.duplicate()
      } else if (command && key === "a") {
        event.preventDefault()
        actions.selectAll(actions.nodeIds)
        actions.clearEdgeSelection()
      } else if (event.key === "Backspace" || event.key === "Delete") {
        if (actions.selectedNodeCount === 0 && !actions.selectedEdgeId) return
        event.preventDefault()
        if (actions.selectedNodeCount > 0) actions.deleteNodes()
        else if (actions.selectedEdgeId) actions.deleteEdge(actions.selectedEdgeId)
      } else if (event.key === "Escape") {
        actions.clearSelection()
        actions.clearEdgeSelection()
        actions.cancelConnection()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [actions])
}

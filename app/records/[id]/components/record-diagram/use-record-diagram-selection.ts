"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
} from "react"
import type {
  RecordDiagramDraft,
  RecordDiagramEdge,
  RecordDiagramNode,
  RecordDiagramViewport,
} from "@/app/records/lib/record-diagram"
import { isDiagramInteractiveTarget } from "./record-diagram-layout"

type CommitDiagram = (
  next: RecordDiagramDraft,
  options?: { group?: string },
) => void

type DiagramClipboard = {
  nodes: RecordDiagramNode[]
  edges: RecordDiagramEdge[]
}

export function useRecordDiagramSelection({
  diagram,
  commit,
  viewportRef,
  nodeElementsRef,
}: {
  diagram: RecordDiagramDraft
  commit: CommitDiagram
  viewportRef: MutableRefObject<RecordDiagramViewport>
  nodeElementsRef: MutableRefObject<Record<string, HTMLDivElement | null>>
}) {
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [clipboard, setClipboard] = useState<DiagramClipboard | null>(null)
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }> | null>(null)
  const pasteCountRef = useRef(0)
  const dragCleanupRef = useRef<(() => void) | null>(null)
  const selectedSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds])
  const primaryNodeId = selectedNodeIds.at(-1) || null

  useEffect(() => {
    const validIds = new Set(diagram.nodes.map((node) => node.id))
    setSelectedNodeIds((current) => current.filter((id) => validIds.has(id)))
  }, [diagram.nodes])

  useEffect(() => () => dragCleanupRef.current?.(), [])

  const selectNode = useCallback((id: string, additive = false) => {
    setSelectedNodeIds((current) => {
      if (!additive) return current.includes(id) && current.length > 1 ? current : [id]
      return current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedNodeIds([]), [])

  const deleteSelected = useCallback(() => {
    if (selectedNodeIds.length === 0) return
    const deleting = new Set(selectedNodeIds)
    commit({
      ...diagram,
      nodes: diagram.nodes.filter((node) => !deleting.has(node.id)),
      edges: diagram.edges.filter(
        (edge) => !deleting.has(edge.source) && !deleting.has(edge.target)
      ),
    })
    clearSelection()
  }, [clearSelection, commit, diagram, selectedNodeIds])

  const copySelected = useCallback(() => {
    if (selectedNodeIds.length === 0) return
    const copiedIds = new Set(selectedNodeIds)
    setClipboard({
      nodes: diagram.nodes.filter((node) => copiedIds.has(node.id)),
      edges: diagram.edges.filter(
        (edge) => copiedIds.has(edge.source) && copiedIds.has(edge.target)
      ),
    })
    pasteCountRef.current = 0
  }, [diagram.edges, diagram.nodes, selectedNodeIds])

  const insertClipboard = useCallback((source: DiagramClipboard) => {
    if (
      source.nodes.length === 0
      || diagram.nodes.length + source.nodes.length > 200
      || diagram.edges.length + source.edges.length > 500
    ) return
    pasteCountRef.current += 1
    const offset = 40 * pasteCountRef.current
    const idMap = new Map(source.nodes.map((node) => [node.id, crypto.randomUUID()]))
    const nodes = source.nodes.map((sourceNode) => {
      const node = {
        ...sourceNode,
        metadata: {
          ...sourceNode.metadata,
          visual: sourceNode.metadata.visual ? { ...sourceNode.metadata.visual } : undefined,
          attachments: sourceNode.metadata.attachments?.map((attachment) => ({ ...attachment })),
        },
      }
      return {
        ...node,
        id: idMap.get(node.id)!,
        title: `${node.title} copy`,
        position: {
          x: node.position.x + offset,
          y: node.position.y + offset,
        },
      }
    })
    const edges = source.edges.map((sourceEdge) => {
      const edge = { ...sourceEdge, metadata: { ...sourceEdge.metadata } }
      return {
        ...edge,
        id: crypto.randomUUID(),
        source: idMap.get(edge.source)!,
        target: idMap.get(edge.target)!,
      }
    })
    commit({
      ...diagram,
      nodes: [...diagram.nodes, ...nodes],
      edges: [...diagram.edges, ...edges],
    })
    setSelectedNodeIds(nodes.map((node) => node.id))
  }, [commit, diagram])

  const paste = useCallback(() => {
    if (clipboard) insertClipboard(clipboard)
  }, [clipboard, insertClipboard])

  const duplicateSelected = useCallback(() => {
    if (selectedNodeIds.length === 0) return
    const selected = new Set(selectedNodeIds)
    insertClipboard({
      nodes: diagram.nodes.filter((node) => selected.has(node.id)),
      edges: diagram.edges.filter(
        (edge) => selected.has(edge.source) && selected.has(edge.target)
      ),
    })
  }, [diagram.edges, diagram.nodes, insertClipboard, selectedNodeIds])

  const beginNodeDrag = useCallback((node: RecordDiagramNode, event: ReactMouseEvent) => {
    if (
      event.button !== 0
      || event.shiftKey
      || event.metaKey
      || event.ctrlKey
      || isDiagramInteractiveTarget(event.target)
    ) return
    event.preventDefault()
    event.stopPropagation()
    const dragIds = selectedSet.has(node.id) ? [...selectedNodeIds] : [node.id]
    if (!selectedSet.has(node.id)) setSelectedNodeIds([node.id])
    const origins = new Map(
      diagram.nodes
        .filter((candidate) => dragIds.includes(candidate.id))
        .map((candidate) => [candidate.id, candidate.position])
    )
    const scale = viewportRef.current.zoom || 1
    const start = { x: event.clientX, y: event.clientY }
    let delta = { x: 0, y: 0 }

    const move = (moveEvent: MouseEvent) => {
      delta = {
        x: (moveEvent.clientX - start.x) / scale,
        y: (moveEvent.clientY - start.y) / scale,
      }
      const nextPositions: Record<string, { x: number; y: number }> = {}
      for (const id of dragIds) {
        const origin = origins.get(id)
        const element = nodeElementsRef.current[id]
        if (origin && element) {
          const position = { x: origin.x + delta.x, y: origin.y + delta.y }
          nextPositions[id] = position
          element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`
        }
      }
      setDragPositions(nextPositions)
    }
    const finish = () => {
      if (delta.x !== 0 || delta.y !== 0) {
        commit({
          ...diagram,
          nodes: diagram.nodes.map((candidate) => {
            const origin = origins.get(candidate.id)
            return origin ? {
              ...candidate,
              position: { x: origin.x + delta.x, y: origin.y + delta.y },
            } : candidate
          }),
        })
      }
      setDragPositions(null)
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mouseup", finish)
      dragCleanupRef.current = null
    }
    dragCleanupRef.current = finish
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", finish)
  }, [
    commit,
    diagram,
    nodeElementsRef,
    selectedNodeIds,
    selectedSet,
    viewportRef,
  ])

  return {
    selectedNodeIds,
    selectedSet,
    primaryNodeId,
    clipboard,
    dragPositions,
    selectNode,
    clearSelection,
    setSelectedNodeIds,
    deleteSelected,
    copySelected,
    paste,
    duplicateSelected,
    beginNodeDrag,
  }
}

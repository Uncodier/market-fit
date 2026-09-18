"use client"

import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from "react"
import { Button } from "@/app/components/ui/button"
import { Plus, X } from "@/app/components/ui/icons"
import { ScreenAnchoredPanel } from "@/app/components/ui/screen-anchored-panel"
import type {
  RecordDiagramDraft, RecordDiagramBackground, RecordDiagramEdge, RecordDiagramNode,
  RecordDiagramViewport, RecordNodeAttachment, RecordNodePort,
} from "@/app/records/lib/record-diagram"
import { RecordDiagramEdges } from "./RecordDiagramEdges"
import { RecordDiagramEdgeEditor } from "./RecordDiagramEdgeEditor"
import { RecordDiagramCanvas } from "./RecordDiagramCanvas"
import { RecordDiagramNodeCard } from "./RecordDiagramNodeCard"
import { RecordDiagramUploadControls } from "./RecordDiagramUploadControls"
import { useRecordDiagramHistory } from "./use-record-diagram-history"
import { useRecordDiagramSelection } from "./use-record-diagram-selection"
import { useRecordDiagramShortcuts } from "./use-record-diagram-shortcuts"
import { useRecordNodeMarkdownEditor, type RecordNodeMarkdownCommand } from "./use-record-node-markdown-editor"
import { createAttachmentDiagramNode, createRecordDiagramNode } from "./record-diagram-node-factory"
import {
  computeRecordDiagramBounds,
  getRecordDiagramNodesBounds,
  getRecordDiagramNodeSize,
  getRecordNodePortPoint,
  layoutSelectedRecordDiagram,
  type RecordDiagramLayout,
} from "./record-diagram-layout"

interface RecordDiagramViewProps {
  diagram: RecordDiagramDraft
  onChange: (diagram: RecordDiagramDraft) => void
  active?: boolean
  onViewportChange?: (viewport: RecordDiagramViewport) => void
  onViewportCommit?: (viewport: RecordDiagramViewport) => void
  onEditStateChange?: (state: RecordDiagramEditState) => void
}
export type RecordDiagramEditState = {
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  canPaste: boolean
  isEditingNodeContent: boolean
}
export type RecordDiagramEditorHandle = {
  undo: () => void
  redo: () => void
  copy: () => void; paste: () => void
  duplicate: () => void
  deleteSelection: () => void
  applyLayout: (layout: RecordDiagramLayout) => void
  setBackground: (background: RecordDiagramBackground) => void
  formatNodeContent: (command: RecordNodeMarkdownCommand) => void
}

export const RecordDiagramView = forwardRef<RecordDiagramEditorHandle, RecordDiagramViewProps>(function RecordDiagramView({
  diagram,
  onChange,
  active = true,
  onViewportChange,
  onViewportCommit,
  onEditStateChange,
}, ref) {
  const initialViewportRef = useRef(diagram.viewport)
  const initialViewport = initialViewportRef.current
  const currentViewportRef = useRef(initialViewport)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [edgeEditorAnchor, setEdgeEditorAnchor] = useState<{ x: number; y: number } | null>(null)
  const [connectionSource, setConnectionSource] = useState<{
    nodeId: string
    port: RecordNodePort
  } | null>(null)
  const [connectionPoint, setConnectionPoint] = useState<{ x: number; y: number } | null>(null)
  const nodeElementsRef = useRef<Record<string, HTMLDivElement | null>>({})
  const diagramRef = useRef(diagram)
  const initializedFirstNodeRef = useRef(false)
  const viewportCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  diagramRef.current = diagram
  const graphBounds = useMemo(() => computeRecordDiagramBounds(diagram.nodes), [diagram.nodes])
  const selectedEdge = diagram.edges.find((edge) => edge.id === selectedEdgeId) || null
  const history = useRecordDiagramHistory(diagram, onChange)
  const selection = useRecordDiagramSelection({
    diagram,
    commit: history.commit,
    viewportRef: currentViewportRef,
    nodeElementsRef,
  })
  const selectedNodesBounds = useMemo(
    () => getRecordDiagramNodesBounds(diagram.nodes, selection.selectedSet),
    [diagram.nodes, selection.selectedSet],
  )
  const displayNodes = useMemo(() => (
    selection.dragPositions
      ? diagram.nodes.map((node) => ({
          ...node,
          position: selection.dragPositions?.[node.id] || node.position,
        }))
      : diagram.nodes
  ), [diagram.nodes, selection.dragPositions])
  const updateNodeContent = useCallback((id: string, content: string) => {
    history.commit(
      {
        ...diagram,
        nodes: diagram.nodes.map((node) => node.id === id ? { ...node, content } : node),
      },
      { group: `node:${id}:content` },
    )
  }, [diagram, history.commit])
  const markdownEditor = useRecordNodeMarkdownEditor(updateNodeContent)

  useImperativeHandle(ref, () => ({
    undo: history.undo,
    redo: history.redo,
    copy: selection.copySelected,
    paste: selection.paste,
    duplicate: selection.duplicateSelected,
    deleteSelection: selection.deleteSelected,
    applyLayout: (layout) => history.commit({
      ...diagram,
      nodes: layoutSelectedRecordDiagram(
        diagram.nodes,
        diagram.edges,
        selection.selectedSet,
        layout,
      ),
    }),
    setBackground: (background) => {
      if ((currentViewportRef.current.background || "dots") === background) return
      const viewport = { ...currentViewportRef.current, background }
      currentViewportRef.current = viewport
      onViewportChange?.(viewport)
      if (onViewportCommit) onViewportCommit(viewport)
      else onChange({ ...diagram, viewport })
    },
    formatNodeContent: markdownEditor.format,
  }), [
    history.redo,
    history.undo,
    selection.copySelected,
    selection.deleteSelected,
    selection.duplicateSelected,
    selection.paste,
    selection.selectedSet,
    diagram,
    markdownEditor.format,
    onChange,
    onViewportChange,
    onViewportCommit,
  ])

  useEffect(() => {
    onEditStateChange?.({
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      hasSelection: selection.selectedNodeIds.length > 0,
      canPaste: Boolean(selection.clipboard),
      isEditingNodeContent: Boolean(markdownEditor.activeNodeId),
    })
  }, [
    history.canRedo,
    history.canUndo,
    onEditStateChange,
    selection.clipboard,
    selection.selectedNodeIds.length,
    markdownEditor.activeNodeId,
  ])

  useEffect(() => {
    if (selectedEdgeId && !diagram.edges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(null)
      setEdgeEditorAnchor(null)
    }
  }, [diagram.edges, selectedEdgeId])

  const commitViewport = useCallback((next: RecordDiagramViewport) => {
    currentViewportRef.current = next
    const current = diagramRef.current.viewport
    if (
      Math.abs(current.x - next.x) < 0.01
      && Math.abs(current.y - next.y) < 0.01
      && Math.abs(current.zoom - next.zoom) < 0.001
    ) return

    onViewportChange?.(next)
    if (viewportCommitTimerRef.current) clearTimeout(viewportCommitTimerRef.current)
    viewportCommitTimerRef.current = setTimeout(() => {
      viewportCommitTimerRef.current = null
      if (onViewportCommit) onViewportCommit(next)
      else onChange({ ...diagramRef.current, viewport: next })
    }, 180)
  }, [onChange, onViewportChange, onViewportCommit])

  useEffect(() => () => {
    if (viewportCommitTimerRef.current) clearTimeout(viewportCommitTimerRef.current)
  }, [])

  const updateNodes = (nodes: RecordDiagramNode[]) => {
    history.commit({ ...diagram, nodes })
  }

  useEffect(() => {
    if (diagram.nodes.length > 0 || initializedFirstNodeRef.current) return
    initializedFirstNodeRef.current = true
    const { node } = createRecordDiagramNode([], null)
    onChange({
      ...diagram,
      nodes: [node],
    })
    selection.setSelectedNodeIds([node.id])
  }, [diagram, onChange, selection])

  const addNode = () => {
    if (diagram.nodes.length >= 200) return
    const parent = diagram.nodes.find((node) => node.id === selection.primaryNodeId) || null
    const { node, edge } = createRecordDiagramNode(diagram.nodes, parent)
    history.commit({
      ...diagram,
      nodes: [...diagram.nodes, node],
      edges: edge ? [...diagram.edges, edge] : diagram.edges,
    })
    selection.setSelectedNodeIds([node.id])
    setSelectedEdgeId(null)
  }

  const addAttachmentNode = (attachment: RecordNodeAttachment) => {
    if (diagram.nodes.length >= 200) return
    const parent = diagram.nodes.find((node) => node.id === selection.primaryNodeId) || null
    const { node, edge } = createAttachmentDiagramNode(diagram.nodes, parent, attachment)
    history.commit({
      ...diagram,
      nodes: [...diagram.nodes, node],
      edges: edge ? [...diagram.edges, edge] : diagram.edges,
    })
    selection.setSelectedNodeIds([node.id])
    setSelectedEdgeId(null)
  }

  const updateNode = (id: string, patch: Partial<RecordDiagramNode>) => {
    history.commit(
      {
        ...diagram,
        nodes: diagram.nodes.map((node) => node.id === id ? { ...node, ...patch } : node),
      },
      { group: `node:${id}:${Object.keys(patch).sort().join(",")}` },
    )
  }

  const deleteNode = (id: string) => {
    history.commit({
      ...diagram,
      nodes: diagram.nodes.filter((node) => node.id !== id),
      edges: diagram.edges.filter((edge) => edge.source !== id && edge.target !== id),
    })
    selection.setSelectedNodeIds(selection.selectedNodeIds.filter((nodeId) => nodeId !== id))
    if (connectionSource?.nodeId === id) {
      setConnectionSource(null)
      setConnectionPoint(null)
    }
  }

  const cancelConnection = useCallback(() => {
    setConnectionSource(null)
    setConnectionPoint(null)
  }, [])

  useEffect(() => {
    if (!connectionSource) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      cancelConnection()
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [cancelConnection, connectionSource])

  const startConnection = (node: RecordDiagramNode, port: RecordNodePort) => {
    if (connectionSource?.nodeId === node.id && connectionSource.port === port) {
      cancelConnection()
      return
    }
    setConnectionSource({ nodeId: node.id, port })
    setConnectionPoint(getRecordNodePortPoint(node, port))
    selection.setSelectedNodeIds([node.id])
    setSelectedEdgeId(null)
  }

  const completeConnection = (targetId: string, targetPort: RecordNodePort) => {
    if (!connectionSource) return
    if (connectionSource.nodeId === targetId || diagram.edges.length >= 500) {
      cancelConnection()
      return
    }
    const exists = diagram.edges.some(
      (edge) => edge.source === connectionSource.nodeId && edge.target === targetId
    )
    if (!exists) {
      history.commit({
        ...diagram,
        edges: [...diagram.edges, {
          id: crypto.randomUUID(),
          source: connectionSource.nodeId,
          target: targetId,
          type: "relates_to",
          metadata: {
            sourcePort: connectionSource.port,
            targetPort,
          },
        }],
      })
    }
    cancelConnection()
  }

  const updateEdge = (id: string, patch: Partial<RecordDiagramEdge>) => {
    history.commit(
      {
        ...diagram,
        edges: diagram.edges.map((edge) => edge.id === id ? { ...edge, ...patch } : edge),
      },
      { group: `edge:${id}:${Object.keys(patch).sort().join(",")}` },
    )
  }

  const deleteEdge = (id: string) => {
    history.commit({ ...diagram, edges: diagram.edges.filter((edge) => edge.id !== id) })
    closeEdgeEditor()
  }

  function closeEdgeEditor() {
    setSelectedEdgeId(null)
    setEdgeEditorAnchor(null)
  }

  useRecordDiagramShortcuts({
    active,
    nodeIds: diagram.nodes.map((node) => node.id),
    selectedNodeCount: selection.selectedNodeIds.length,
    selectedEdgeId,
    undo: history.undo,
    redo: history.redo,
    copy: selection.copySelected,
    paste: selection.paste,
    duplicate: selection.duplicateSelected,
    selectAll: selection.setSelectedNodeIds,
    deleteNodes: selection.deleteSelected,
    deleteEdge,
    clearSelection: selection.clearSelection,
    clearEdgeSelection: closeEdgeEditor,
    cancelConnection,
  })

  return (
    <div
      data-record-diagram-editor
      className="relative h-full min-h-0 overflow-hidden"
      onClick={() => {
        selection.clearSelection()
        closeEdgeEditor()
      }}
    >
      {selectedEdge && edgeEditorAnchor && (
        <ScreenAnchoredPanel anchor={edgeEditorAnchor}>
          <RecordDiagramEdgeEditor
            edge={selectedEdge}
            onChange={(patch) => updateEdge(selectedEdge.id, patch)}
            onClose={closeEdgeEditor}
            onDelete={() => deleteEdge(selectedEdge.id)}
          />
        </ScreenAnchoredPanel>
      )}
      {diagram.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-lg border bg-background/95 px-5 py-4 text-center">
            <p className="text-sm font-medium">No nodes yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Create a node to start the diagram.</p>
          </div>
        </div>
      )}

      <RecordDiagramCanvas
        className="h-full min-h-0"
        bounds={graphBounds}
        initialViewport={initialViewport}
        background={diagram.viewport.background || "dots"}
        enabled={active}
        selectionBounds={selectedNodesBounds}
        onViewportChange={commitViewport}
        onWorldPointerMove={connectionSource ? setConnectionPoint : undefined}
        onSort={() => updateNodes(layoutSelectedRecordDiagram(
          diagram.nodes,
          diagram.edges,
          selection.selectedSet,
          "hierarchy",
        ))}
        extraControls={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={addNode}
              disabled={diagram.nodes.length >= 200}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New node
            </Button>
            <RecordDiagramUploadControls
              disabled={diagram.nodes.length >= 200}
              onUploaded={addAttachmentNode}
            />
            {connectionSource && (
              <>
                <div className="mx-1 h-4 w-px bg-border" />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 px-2.5 text-xs font-medium"
                  onClick={cancelConnection}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Cancel relation
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="relative" style={{ width: graphBounds.width, height: graphBounds.height }}>
          <RecordDiagramEdges
            nodes={displayNodes}
            edges={diagram.edges}
            selectedEdgeId={selectedEdgeId}
            connectionPreview={connectionSource && connectionPoint ? {
              sourceNodeId: connectionSource.nodeId,
              sourcePort: connectionSource.port,
              to: connectionPoint,
            } : null}
            onSelectEdge={(edgeId, anchor) => {
              setSelectedEdgeId(edgeId)
              setEdgeEditorAnchor(anchor)
              selection.clearSelection()
            }}
          />
          {diagram.nodes.map((node) => (
            <div
              key={node.id}
              data-diagram-node
              ref={(element) => {
                nodeElementsRef.current[node.id] = element
              }}
              className={selection.selectedSet.has(node.id) ? "absolute z-30" : "absolute z-10"}
              style={{
                left: 0,
                top: 0,
                width: getRecordDiagramNodeSize(node).width,
                transform: `translate3d(${
                  selection.dragPositions?.[node.id]?.x ?? node.position.x
                }px, ${
                  selection.dragPositions?.[node.id]?.y ?? node.position.y
                }px, 0)`,
              }}
            >
              <RecordDiagramNodeCard
                node={node}
                selected={selection.selectedSet.has(node.id)}
                connecting={connectionSource?.nodeId === node.id}
                activeConnectionPort={
                  connectionSource?.nodeId === node.id ? connectionSource.port : null
                }
                onSelect={(additive) => {
                  selection.selectNode(node.id, additive)
                  closeEdgeEditor()
                }}
                onMouseDown={(event) => selection.beginNodeDrag(node, event)}
                onChange={(patch) => updateNode(node.id, patch)}
                onContentFocus={(element) => markdownEditor.focus(node.id, element)}
                onContentBlur={markdownEditor.blur}
                onDelete={() => deleteNode(node.id)}
                onConnector={(port) => {
                  if (connectionSource && connectionSource.nodeId !== node.id) {
                    completeConnection(node.id, port)
                  } else {
                    startConnection(node, port)
                  }
                }}
              />
            </div>
          ))}
        </div>
      </RecordDiagramCanvas>
    </div>
  )
})

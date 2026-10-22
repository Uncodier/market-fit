import { useEffect, useRef, useMemo, useCallback } from "react"
import { InstanceNode } from "@/app/types/instance-nodes"
import { positionsNearlyEqual, isImprentaWorkflowActionNode } from './node-helpers'
import type { useImprentaPanelState } from './state'
import type { useImprentaLayout } from "./graph-layout"
import type { useImprentaDragging } from './drag'
import type { useImprentaNodeActions } from './node-actions'
import type { useImprentaConnections } from './connections'
import type { useImprentaExecution } from './execution'
import type { useImprentaVirtualization } from './virtualization'

type ImprentaLayoutEffectsOptions = Pick<ReturnType<typeof useImprentaPanelState>, "setPositions" | "nodes" | "dummyNodes" | "draggingNodeRef" | "nodeHeightsRef" | "positions" | "persistenceBarrier" | "setNodes" | "setZoomedMedia"> & Pick<ReturnType<typeof useImprentaLayout>, "getLayoutPositions" | "ROW_H" | "NODE_W"> & Pick<ReturnType<typeof useImprentaDragging>, "handleNodeMouseDown"> & Pick<ReturnType<typeof useImprentaNodeActions>, "handleDeleteNode" | "handleDuplicateNode" | "handleCreateActionFromContext"> & Pick<ReturnType<typeof useImprentaConnections>, "handleConnectionDrop" | "handleConnectionStart"> & Pick<ReturnType<typeof useImprentaExecution>, "handleExecuteNode"> & Pick<ReturnType<typeof useImprentaVirtualization>, "handleImprentaNodeHover">

export function useImprentaLayoutEffects({
  setPositions,
  nodes,
  dummyNodes,
  draggingNodeRef,
  getLayoutPositions,
  nodeHeightsRef,
  positions,
  ROW_H,
  NODE_W,
  persistenceBarrier,
  handleNodeMouseDown,
  handleDeleteNode,
  handleDuplicateNode,
  handleConnectionDrop,
  handleConnectionStart,
  handleExecuteNode,
  setNodes,
  setZoomedMedia,
  handleImprentaNodeHover,
  handleCreateActionFromContext,
}: ImprentaLayoutEffectsOptions) {
  useEffect(() => {
    setPositions(prev => {
      const allNodes = [...nodes, ...dummyNodes]
      const nodeIds = new Set(allNodes.map(n => n.id))
      const cleaned = Object.fromEntries(
        Object.entries(prev).filter(([id]) => nodeIds.has(id))
      )

      let updatedWithDb = false;
      allNodes.forEach(n => {
        if (!n.id.startsWith('dummy-') && (n.settings)?.ui_position) {
          const dbPos = (n.settings).ui_position;
          if (
            typeof dbPos?.x !== 'number' ||
            typeof dbPos?.y !== 'number' ||
            isNaN(dbPos.x) ||
            isNaN(dbPos.y)
          ) {
            return
          }
          // Backend often persists a copy of the parent's settings on new children; that puts
          // ui_position on the child equal to the parent and overwrites the dummy handoff layout.
          if (n.parent_node_id) {
            const parentNode = allNodes.find(p => p.id === n.parent_node_id)
            const parentDb = parentNode && (parentNode.settings)?.ui_position
            const parentClean = cleaned[n.parent_node_id]
            const overlapsParent =
              (parentDb &&
                typeof parentDb.x === 'number' &&
                typeof parentDb.y === 'number' &&
                positionsNearlyEqual(dbPos, parentDb)) ||
              (parentClean && positionsNearlyEqual(dbPos, parentClean))
            if (overlapsParent) {
              return
            }
          }
          if (!cleaned[n.id] || cleaned[n.id].x !== dbPos.x || cleaned[n.id].y !== dbPos.y) {
            // Avoid overwriting if we are currently dragging this node
            if (draggingNodeRef.current !== n.id) {
              cleaned[n.id] = dbPos;
              updatedWithDb = true;
            }
          }
        }
      });

      const hasMissing = allNodes.some(n => !cleaned[n.id])
      const hasStale = Object.keys(cleaned).length !== Object.keys(prev).length

      if (hasMissing || hasStale || updatedWithDb) {
        return getLayoutPositions(allNodes, cleaned, nodeHeightsRef.current)
      }
      return cleaned
    })
  }, [nodes, dummyNodes])

  const maxBounds = useMemo(() => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let hasNodes = false

    Object.entries(positions).forEach(([id, pos]) => {
      if (typeof pos.x !== 'number' || typeof pos.y !== 'number' || isNaN(pos.x) || isNaN(pos.y)) return

      hasNodes = true
      const nh = (nodeHeightsRef.current[id] || ROW_H)
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + NODE_W)
      maxY = Math.max(maxY, pos.y + nh)
    })

    if (!hasNodes) {
      return { width: 800, height: 600, offsetX: 0, offsetY: 0 }
    }

    return {
      width: Math.max(maxX - minX + 100, 320),
      height: Math.max(maxY - minY + 100, 320),
      offsetX: minX - 50,
      offsetY: minY - 50,
    }
  }, [positions])

  const trackNodeSave = useCallback(
    <T = { error: unknown },>(nodeId: string, operation: PromiseLike<T>, category?: string) =>
      persistenceBarrier.track(nodeId, operation, category),
    [persistenceBarrier]
  )

  const actionsRef = useRef({
    handleNodeMouseDown,
    handleDeleteNode,
    handleDuplicateNode,
    handleConnectionDrop,
    handleConnectionStart,
    handleExecuteNode,
    trackNodeSave,
    setNodes,
    setZoomedMedia,
    handleImprentaNodeHover,
    isImprentaWorkflowActionNode,
    handleCreateActionFromContext,
    getParentNode: (node: InstanceNode) => node.parent_node_id ? nodes.find(n => n.id === node.parent_node_id) : undefined
  })

  useEffect(() => {
    actionsRef.current = {
      handleNodeMouseDown,
      handleDeleteNode,
      handleDuplicateNode,
      handleConnectionDrop,
      handleConnectionStart,
      handleExecuteNode,
      trackNodeSave,
      setNodes,
      setZoomedMedia,
      handleImprentaNodeHover,
      isImprentaWorkflowActionNode,
      handleCreateActionFromContext,
      getParentNode: (node: InstanceNode) => node.parent_node_id ? nodes.find(n => n.id === node.parent_node_id) : undefined
    }
  })

  return { maxBounds, trackNodeSave, actionsRef }
}

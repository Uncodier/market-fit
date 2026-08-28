"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ZoomableCanvas } from "@/app/components/agents/zoomable-canvas"
import { ImprentaLoadingRouteEdges } from "@/app/components/agents/imprenta-world-svg"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { createViewportStore } from "@/app/lib/imprenta-viewport-store"
import type { InstanceNode } from "@/app/types/instance-nodes"
import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_PLAN_TYPE,
  DEFAULT_STEP_ROLE,
  DEFAULT_STEP_SKILL,
  NODE_H,
  NODE_W,
  isWorkflowResultId,
  type WorkflowNodeType,
} from "./types"
import { useWorkflowGraph } from "./use-workflow-graph"
import { useWorkflowRunStatus } from "./use-workflow-run-status"
import { useWorkflowResultNodes } from "./use-workflow-result-nodes"
import {
  computeGraphBounds,
  isInteractiveTarget,
  placeNewNode,
  placeResultNodes,
  positionsMoved,
  readSavedPosition,
  sortWorkflowLayout,
  unstackOverlaps,
  type WFPoint,
} from "./use-workflow-layout"
import { WorkflowPalette } from "./workflow-palette"
import { WorkflowNodeCard } from "./workflow-node-card"
import { WorkflowResultCard } from "./workflow-result-card"
import { WorkflowEdges } from "./workflow-edges"
import { WorkflowSkeleton } from "@/app/components/skeletons/workflow-skeleton"

export function WorkflowPanel({ activeInstanceId }: { activeInstanceId?: string }) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const { nodes, isLoading, createNode, updateNode, deleteNode, hasSandboxStep } = useWorkflowGraph(
    activeInstanceId,
    currentSite?.id,
  )
  const { statusByNode, activePlan } = useWorkflowRunStatus(activeInstanceId)
  const { resultNodes, grouped, loadingIds, actionNodeIds, loadingEdges } = useWorkflowResultNodes({
    instanceId: activeInstanceId,
    graphNodes: nodes,
    activePlan,
    statusByNode,
  })
  const canvasNodes = useMemo(() => [...nodes, ...resultNodes], [nodes, resultNodes])
  const viewportStore = useMemo(() => createViewportStore(), [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [positions, setPositions] = useState<Record<string, WFPoint>>({})
  const [heightTick, setHeightTick] = useState(0)
  const heightsRef = useRef<Record<string, number>>({})
  const nodeElsRef = useRef<Record<string, HTMLDivElement | null>>({})
  const positionsRef = useRef(positions)
  const lastDragPosRef = useRef<WFPoint | null>(null)
  positionsRef.current = positions

  const graphSig = nodes.map((node) => node.id).join(",")
  const resultSig = resultNodes.map((node) => node.id).join(",")
  const nodesRef = useRef(nodes)
  const resultNodesRef = useRef(resultNodes)
  nodesRef.current = nodes
  resultNodesRef.current = resultNodes

  useEffect(() => {
    if (dragId) return
    const graph = nodesRef.current
    const results = resultNodesRef.current
    setPositions((prev) => {
      const incoming: Record<string, WFPoint> = {}
      graph.forEach((node, index) => {
        incoming[node.id] = prev[node.id] || readSavedPosition(node, index)
      })
      results.forEach((node) => {
        if (prev[node.id]) incoming[node.id] = prev[node.id]
      })
      const placed = placeResultNodes(graph, results, incoming, heightsRef.current)
      return unstackOverlaps([...graph, ...results], placed, heightsRef.current)
    })
  }, [graphSig, resultSig, dragId, heightTick])

  const observerRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    let frame: number
    observerRef.current = new ResizeObserver((entries) => {
      let changed = false
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.nodeId
        if (!id) continue
        const height = (entry.target as HTMLElement).offsetHeight
        if (height > 0 && heightsRef.current[id] !== height) {
          heightsRef.current[id] = height
          changed = true
        }
      }
      if (changed) {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => setHeightTick((tick) => tick + 1))
      }
    })
    return () => {
      cancelAnimationFrame(frame)
      observerRef.current?.disconnect()
    }
  }, [])

  const registerHeight = useCallback((id: string, el: HTMLDivElement | null) => {
    const prevEl = nodeElsRef.current[id]
    if (prevEl && prevEl !== el && observerRef.current) {
      observerRef.current.unobserve(prevEl)
    }
    nodeElsRef.current[id] = el
    if (!el) return
    el.dataset.nodeId = id
    if (observerRef.current) {
      observerRef.current.observe(el)
    }
    const height = el.offsetHeight
    if (height <= 0 || heightsRef.current[id] === height) return
    heightsRef.current[id] = height
    setHeightTick((tick) => tick + 1)
  }, [])

  const graphBounds = useMemo(
    () => computeGraphBounds(canvasNodes, positions, heightsRef.current),
    [canvasNodes, positions, heightTick],
  )

  const persistPositions = (next: Record<string, WFPoint>) => {
    setPositions(next)
    positionsMoved(nodes, next).forEach((item) => {
      void updateNode(item.id, { settings: item.settings })
    })
  }

  const sortLayout = () => {
    persistPositions(sortWorkflowLayout(canvasNodes, heightsRef.current))
  }

  const addNode = async (type: WorkflowNodeType, parentId?: string | null) => {
    const resolvedParentId = type === "wf-trigger" ? null : parentId ?? selectedId
    if (type !== "wf-trigger" && !resolvedParentId) return
    const parent =
      type === "wf-trigger" ? null : nodes.find((n) => n.id === resolvedParentId) || null
    if (type !== "wf-trigger" && !parent) return
    const created = await createNode({
      type,
      parentId: type === "wf-trigger" ? null : parent?.id || null,
      position: placeNewNode({
        type,
        parent,
        nodes,
        positions: positionsRef.current,
        heights: heightsRef.current,
      }),
      title: type === "wf-trigger" ? "Trigger" : "Step",
      prompt: type === "wf-step" ? "Describe what this step should accomplish." : "When this workflow starts",
      settings:
        type === "wf-trigger"
          ? { enabled: false, trigger: { kind: "manual", active_kinds: ["manual"], plan_type: DEFAULT_PLAN_TYPE } }
          : {
              step: {
                skill: DEFAULT_STEP_SKILL,
                role: DEFAULT_STEP_ROLE,
                max_retries: DEFAULT_MAX_RETRIES,
                mcp_actions: [],
                validation_rules: [],
              },
            },
    })
    if (created) setSelectedId(created.id)
  }

  const onNodeMouseDown = (node: InstanceNode, event: React.MouseEvent) => {
    if (event.button !== 0) return
    setSelectedId(node.id)
    if (isInteractiveTarget(event.target)) return
    event.stopPropagation()
    event.preventDefault()
    setDragId(node.id)
    const scale = viewportStore.get().scale || 1
    const origin = positionsRef.current[node.id] || readSavedPosition(node, 0)
    lastDragPosRef.current = origin
    const start = { clientX: event.clientX, clientY: event.clientY }
    const move = (ev: MouseEvent) => {
      ev.preventDefault()
      const next = {
        x: origin.x + (ev.clientX - start.clientX) / scale,
        y: origin.y + (ev.clientY - start.clientY) / scale,
      }
      lastDragPosRef.current = next
      const el = nodeElsRef.current[node.id]
      if (el) el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`
    }
    const up = () => {
      const finalPos = lastDragPosRef.current || origin
      lastDragPosRef.current = null
      setDragId(null)
      setPositions((prev) => ({ ...prev, [node.id]: finalPos }))
      if (!isWorkflowResultId(node.id)) {
        void updateNode(node.id, {
          settings: { ...((node.settings as object) || {}), ui_position: finalPos },
        })
      }
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mouseup", up)
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", up)
  }

  if (!activeInstanceId || isLoading) {
    return (
      <div className="h-full min-h-0 absolute inset-0 flex flex-col">
        <WorkflowSkeleton />
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 absolute inset-0 flex flex-col">
      {hasSandboxStep && (
        <div className="absolute left-1/2 -translate-x-1/2 top-3 z-20 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-800 dark:text-amber-300">
          {t("workflows.sandboxBadge") || "This workflow can start a billed VM on matching triggers."}
        </div>
      )}
      <ZoomableCanvas
        className="w-full min-h-0 flex-1"
        height="100%"
        minHeight="100%"
        enableWheelPan
        fitOnChildrenChange={false}
        graphBounds={graphBounds}
        viewportStore={viewportStore}
        onSort={sortLayout}
        extraControls={
          <WorkflowPalette
            onAdd={(type) => void addNode(type)}
            canAddChild={Boolean(selectedId && !isWorkflowResultId(selectedId))}
          />
        }
      >
        <div className="relative" style={{ width: graphBounds.width, height: graphBounds.height }}>
          <WorkflowEdges nodes={canvasNodes} positions={positions} heights={heightsRef.current} />
          <ImprentaLoadingRouteEdges
            edges={loadingEdges}
            positions={positions}
            nodeHeights={heightsRef.current}
            nodeW={NODE_W}
            rowH={NODE_H}
            visibleNodeIds={null}
          />
          {canvasNodes.map((node, index) => {
            const pos = positions[node.id] || readSavedPosition(node, index)
            const isResult = isWorkflowResultId(node.id)
            return (
              <div
                key={node.id}
                ref={(el) => registerHeight(node.id, el)}
                className="absolute z-10"
                style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, left: 0, top: 0, width: NODE_W }}
              >
                {isResult ? (
                  <WorkflowResultCard
                    node={node}
                    loading={loadingIds.has(node.id)}
                    logs={
                      node.settings?.result_kind === "overall"
                        ? grouped.overall
                        : grouped.byNodeId[String(node.settings?.source_node_id || "")] || []
                    }
                    stepOutput={
                      node.settings?.result_kind === "overall"
                        ? undefined
                        : grouped.stepOutputByNodeId[String(node.settings?.source_node_id || "")]
                    }
                    summary={node.settings?.result_kind === "overall" ? grouped.summary : undefined}
                  />
                ) : (
                  <WorkflowNodeCard
                    node={node}
                    selected={selectedId === node.id || dragId === node.id}
                    runStatus={statusByNode[node.id]}
                    actionRunning={actionNodeIds.has(node.id)}
                    onSelect={() => setSelectedId(node.id)}
                    onMouseDown={(e) => onNodeMouseDown(node, e)}
                    onChange={updateNode}
                    onAddStep={() => void addNode("wf-step", node.id)}
                    onDelete={async (id) => {
                      await deleteNode(id)
                      if (selectedId === id) setSelectedId(null)
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </ZoomableCanvas>
    </div>
  )
}

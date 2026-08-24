"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { InstanceNode } from "@/app/types/instance-nodes"
import {
  WF_OVERALL_RESULT_ID_PREFIX,
  WF_RESULT_ID_PREFIX,
  WF_RESULT_TYPE,
  isOverallResultId,
  type WorkflowRunPlan,
} from "./types"
import type { NodeRunStatusMap } from "./use-workflow-run-status"
import {
  groupWorkflowResultLogs,
  shouldShowResultForStatus,
  type GroupedWorkflowLogs,
  type WorkflowResultLog,
} from "./workflow-result-logs"

const supabase = createClient()
const PLAN_STATUSES_LOADING = new Set(["pending", "in_progress"])

function asLog(row: Record<string, unknown>): WorkflowResultLog | null {
  if (typeof row.id !== "string" || typeof row.created_at !== "string") return null
  const details =
    row.details && typeof row.details === "object" ? (row.details as Record<string, unknown>) : null
  return {
    id: row.id,
    created_at: row.created_at,
    log_type: typeof row.log_type === "string" ? row.log_type : undefined,
    message: typeof row.message === "string" ? row.message : undefined,
    command_id: typeof row.command_id === "string" ? row.command_id : null,
    details,
    tool_result: row.tool_result,
  }
}

function dummyResultNode({
  id,
  parent,
  kind,
}: {
  id: string
  parent: InstanceNode
  kind: "step" | "overall"
}): InstanceNode {
  return {
    id,
    instance_id: parent.instance_id,
    parent_node_id: parent.id,
    original_node_id: null,
    parent_instance_log_id: null,
    type: WF_RESULT_TYPE,
    status: kind === "overall" ? "running" : parent.status,
    prompt: { text: "" },
    settings: { result_kind: kind, source_node_id: parent.id },
    result: {},
    site_id: parent.site_id,
    user_id: parent.user_id,
    created_at: parent.updated_at || parent.created_at,
    updated_at: parent.updated_at || parent.created_at,
  }
}

export function leafGraphNodes(graphNodes: InstanceNode[]): InstanceNode[] {
  const childParents = new Set(
    graphNodes.map((node) => node.parent_node_id).filter((id): id is string => Boolean(id)),
  )
  return graphNodes.filter((node) => !childParents.has(node.id))
}

export function buildWorkflowResultNodes(
  graphNodes: InstanceNode[],
  statusByNode: NodeRunStatusMap,
): InstanceNode[] {
  const next: InstanceNode[] = []
  graphNodes.forEach((node) => {
    if (!shouldShowResultForStatus(statusByNode[node.id])) return
    next.push(
      dummyResultNode({
        id: `${WF_RESULT_ID_PREFIX}${node.id}`,
        parent: node,
        kind: "step",
      }),
    )
  })
  if (next.length === 0) return next

  const hasStep = graphNodes.some((node) => node.type === "wf-step")
  leafGraphNodes(graphNodes).forEach((leaf) => {
    if (leaf.type === "wf-step" || (leaf.type === "wf-trigger" && !hasStep)) {
      next.push(
        dummyResultNode({
          id: `${WF_OVERALL_RESULT_ID_PREFIX}${leaf.id}`,
          parent: leaf,
          kind: "overall",
        }),
      )
    }
  })
  return next
}

export function useWorkflowResultNodes({
  instanceId,
  graphNodes,
  activePlan,
  statusByNode,
}: {
  instanceId?: string
  graphNodes: InstanceNode[]
  activePlan: WorkflowRunPlan | null
  statusByNode: NodeRunStatusMap
}) {
  const [logs, setLogs] = useState<WorkflowResultLog[]>([])

  useEffect(() => {
    if (!instanceId) {
      setLogs([])
      return
    }

    let cancelled = false

    const load = async () => {
      const { data } = await supabase
        .from("instance_logs")
        .select("id, log_type, message, created_at, command_id, details, tool_result")
        .eq("instance_id", instanceId)
        .order("created_at", { ascending: false })
        .limit(200)
      if (cancelled) return
      const next = (data || [])
        .map((row) => asLog(row as Record<string, unknown>))
        .filter((row): row is WorkflowResultLog => Boolean(row))
        .reverse()
      setLogs(next)
    }

    void load()

    const channel = supabase
      .channel(`workflow_result_logs_${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "instance_logs", filter: `instance_id=eq.${instanceId}` },
        (payload) => {
          const next = asLog((payload.new || {}) as Record<string, unknown>)
          if (!next) return
          setLogs((prev) => (prev.some((log) => log.id === next.id) ? prev : [...prev, next]))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [instanceId])

  const resultNodes = useMemo(
    () => (activePlan ? buildWorkflowResultNodes(graphNodes, statusByNode) : []),
    [activePlan, graphNodes, statusByNode],
  )

  const grouped = useMemo<GroupedWorkflowLogs>(
    () =>
      groupWorkflowResultLogs({
        logs,
        nodeIds: graphNodes.map((node) => node.id),
        plan: activePlan,
      }),
    [logs, graphNodes, activePlan],
  )

  const planLoading = Boolean(activePlan?.status && PLAN_STATUSES_LOADING.has(activePlan.status))

  const loadingIds = useMemo(() => {
    const ids = new Set<string>()
    resultNodes.forEach((node) => {
      if (isOverallResultId(node.id)) {
        if (planLoading) ids.add(node.id)
        return
      }
      const sourceId = String(node.settings?.source_node_id || "")
      if (statusByNode[sourceId] === "in_progress") ids.add(node.id)
    })
    return ids
  }, [resultNodes, planLoading, statusByNode])

  const actionNodeIds = useMemo(() => {
    const ids = new Set<string>()
    resultNodes.forEach((node) => {
      if (loadingIds.has(node.id) && node.parent_node_id) ids.add(node.parent_node_id)
    })
    return ids
  }, [resultNodes, loadingIds])

  const loadingEdges = useMemo(
    () =>
      resultNodes
        .filter((node) => loadingIds.has(node.id) && node.parent_node_id)
        .map((node) => ({ parentId: node.parent_node_id as string, childId: node.id })),
    [resultNodes, loadingIds],
  )

  return { resultNodes, grouped, loadingIds, actionNodeIds, loadingEdges }
}

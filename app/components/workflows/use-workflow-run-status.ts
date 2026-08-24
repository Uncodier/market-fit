"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { WorkflowRunPlan, WorkflowRunPlanStep, WorkflowStepStatus } from "./types"

const supabase = createClient()

export type NodeRunStatusMap = Record<string, WorkflowStepStatus>

function asRunPlan(row: unknown): WorkflowRunPlan | null {
  if (!row || typeof row !== "object") return null
  const rec = row as WorkflowRunPlan
  if (!rec.id || !rec.metadata?.workflow_run) return null
  return rec
}

export function statusesFromPlan(plan: WorkflowRunPlan | null): NodeRunStatusMap {
  if (!plan || !Array.isArray(plan.steps)) return {}
  const next: NodeRunStatusMap = {}
  for (const step of plan.steps as WorkflowRunPlanStep[]) {
    const nodeId = step.metadata?.node_id
    if (nodeId && step.status) next[nodeId] = step.status as WorkflowStepStatus
  }
  return next
}

export function useWorkflowRunStatus(instanceId?: string) {
  const [statusByNode, setStatusByNode] = useState<NodeRunStatusMap>({})
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [activePlan, setActivePlan] = useState<WorkflowRunPlan | null>(null)

  useEffect(() => {
    if (!instanceId) {
      setStatusByNode({})
      setActiveRunId(null)
      setActivePlan(null)
      return
    }

    let cancelled = false

    const apply = (row: unknown, { allowEmpty }: { allowEmpty: boolean }) => {
      const plan = asRunPlan(row)
      if (!plan && !allowEmpty) return
      setActivePlan(plan)
      setActiveRunId(plan?.id || null)
      setStatusByNode(statusesFromPlan(plan))
    }

    const load = async () => {
      const { data } = await supabase
        .from("instance_plans")
        .select("id, status, steps, metadata, created_at, updated_at")
        .eq("instance_id", instanceId)
        .contains("metadata", { workflow_run: true })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      apply(data, { allowEmpty: true })
    }

    void load()

    const channel = supabase
      .channel(`workflow_runs_${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instance_plans", filter: `instance_id=eq.${instanceId}` },
        (payload) => {
          if (payload.eventType === "DELETE") return
          apply(payload.new, { allowEmpty: false })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [instanceId])

  return { statusByNode, activeRunId, activePlan }
}

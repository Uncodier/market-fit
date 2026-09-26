"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { apiClient } from "@/app/services/api-client-service"
import type { InstanceNode } from "@/app/types/instance-nodes"
import { DEFAULT_PLAN_TYPE, WF_LOAD_NODE_TYPES, type WorkflowNodeType } from "./types"
import { canSetWorkflowParent } from "./workflow-relations"
import { DEFAULT_RELATION_CONTEXT, MAX_RELATION_CONTEXT_LENGTH, workflowRelationContext } from "./workflow-relation-context"

const supabase = createClient()
const seedPending = new Set<string>()

function isWorkflowNode(node: InstanceNode): boolean {
  return (WF_LOAD_NODE_TYPES as readonly string[]).includes(node.type)
}

async function seedTrigger(instanceId: string, siteId: string): Promise<InstanceNode | null> {
  if (seedPending.has(instanceId)) return null
  seedPending.add(instanceId)
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) return null
    const { data, error } = await supabase
      .from("instance_nodes")
        .insert([{
          instance_id: instanceId,
          site_id: siteId,
          user_id: sessionData.session.user.id,
          parent_node_id: null,
          type: "wf-trigger",
          status: "pending",
          prompt: { text: "When this workflow starts" },
          settings: {
            title: "Manual trigger",
            enabled: false,
            ui_position: { x: 80, y: 80 },
            trigger: { kind: "manual", active_kinds: ["manual"], plan_type: DEFAULT_PLAN_TYPE },
          },
          result: {},
        }])
      .select("*")
      .single()
    if (error) throw error
    return data as InstanceNode
  } finally {
    seedPending.delete(instanceId)
  }
}

export function useWorkflowGraph(instanceId?: string, siteId?: string) {
  const [nodes, setNodes] = useState<InstanceNode[]>([])
  const [loadedInstanceId, setLoadedInstanceId] = useState<string | null>(null)
  const instanceIdRef = useRef(instanceId)
  const deletedNodeIdsRef = useRef<Set<string>>(new Set())
  
  if (instanceIdRef.current !== instanceId) {
    deletedNodeIdsRef.current.clear()
    instanceIdRef.current = instanceId
  }

  const reload = useCallback(async () => {
    if (!instanceId || !siteId) {
      setNodes([])
      setLoadedInstanceId(null)
      return
    }
    try {
      const { data, error } = await supabase
        .from("instance_nodes")
        .select("*")
        .eq("instance_id", instanceId)
        .in("type", [...WF_LOAD_NODE_TYPES])
        .order("created_at", { ascending: true })
      if (error) throw error
      if (instanceId !== instanceIdRef.current) return
      let next = (data || []) as InstanceNode[]
      if (next.length === 0) {
        const seeded = await seedTrigger(instanceId, siteId)
        if (seeded) next = [seeded]
      }
      next = next
        .filter((node) => !deletedNodeIdsRef.current.has(node.id))
        .map((node) => node.parent_node_id && deletedNodeIdsRef.current.has(node.parent_node_id)
          ? { ...node, parent_node_id: null }
          : node)
      if (instanceId !== instanceIdRef.current) return
      setNodes(next)
    } finally {
      if (instanceId === instanceIdRef.current) setLoadedInstanceId(instanceId)
    }
  }, [instanceId, siteId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!instanceId) return
    const channel = supabase
      .channel(`workflow_nodes_${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instance_nodes", filter: `instance_id=eq.${instanceId}` },
        (payload: any) => {
          const row = (payload.new || payload.old) as InstanceNode | undefined
          if (payload.eventType === "DELETE" && row?.id) {
            deletedNodeIdsRef.current.delete(row.id)
          }
          if (row && !isWorkflowNode(row) && payload.eventType !== "DELETE") return
          void reload()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [instanceId, reload])

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  const syncTimerRef = useRef<NodeJS.Timeout | null>(null)

  const syncTriggers = useCallback((instanceIdToSync: string) => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current)
    }
    syncTimerRef.current = setTimeout(async () => {
      try {
        const response = await apiClient.post(`/api/workflows/${instanceIdToSync}/sync-triggers`, {})
        if (!response.success) {
          console.error("Failed to sync triggers: API returned success=false", response.error)
          toast.error(response.error?.message || "Could not sync workflow. Changes may not be active.")
        }
      } catch (err) {
        console.error("Failed to sync triggers (network error):", err)
        toast.error("Could not sync workflow. Changes may not be active.")
      }
    }, 1000)
  }, [])

  const createNode = useCallback(
    async (params: {
      type: WorkflowNodeType
      parentId?: string | null
      position: { x: number; y: number }
      title: string
      settings?: Record<string, unknown>
      prompt?: string
    }) => {
      if (!instanceId || !siteId) return null
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) return null
      const { data, error } = await supabase
        .from("instance_nodes")
        .insert([{
          instance_id: instanceId,
          site_id: siteId,
          user_id: sessionData.session.user.id,
          parent_node_id: params.parentId || null,
          type: params.type,
          status: "pending",
          prompt: { text: params.prompt || params.title },
          settings: {
            title: params.title,
            ui_position: params.position,
            ...(params.settings || {}),
            ...(params.type === "wf-step" && params.parentId
              ? { relation_context: DEFAULT_RELATION_CONTEXT }
              : {}),
          },
          result: {},
        }])
        .select("*")
        .single()
      if (error) throw error
      const created = data as InstanceNode
      setNodes((prev) => (prev.some((n) => n.id === created.id) ? prev : [...prev, created]))
      
      if (isWorkflowNode(created) && created.instance_id) {
        syncTriggers(created.instance_id)
      }
      
      return created
    },
    [instanceId, siteId, syncTriggers],
  )

  const updateNode = useCallback(async (id: string, patch: Partial<InstanceNode>) => {
    const { data, error } = await supabase.from("instance_nodes").update(patch).eq("id", id).select("*").single()
    if (error) throw error
    const updated = data as InstanceNode
    setNodes((prev) => prev.map((n) => (n.id === id ? updated : n)))
    
    if (isWorkflowNode(updated) && updated.instance_id) {
      // Keep the execution plan and trigger eligibility current after edits to
      // either the trigger or its steps; the debounce also covers drag updates.
      syncTriggers(updated.instance_id)
    }
    
    return updated
  }, [syncTriggers])

  const setStepParent = useCallback(async (stepId: string, parentId: string | null) => {
    const step = nodesRef.current.find((node) => node.id === stepId)
    if (!instanceId || !siteId || !step || step.instance_id !== instanceId || step.site_id !== siteId || !canSetWorkflowParent(nodesRef.current, stepId, parentId)) {
      throw new Error("Cannot connect these workflow nodes")
    }
    if (step.parent_node_id === parentId) return step
    const settings = { ...(step.settings || {}) }
    if (parentId) settings.relation_context = DEFAULT_RELATION_CONTEXT
    else delete settings.relation_context
    const { data, error } = await supabase.from("instance_nodes")
      .update({ parent_node_id: parentId, settings })
      .eq("id", stepId)
      .eq("instance_id", instanceId)
      .eq("site_id", siteId)
      .select("*")
      .single()
    if (error) throw error
    const updated = data as InstanceNode
    setNodes((prev) => prev.map((node) => node.id === stepId ? updated : node))
    syncTriggers(instanceId)
    return updated
  }, [instanceId, siteId, syncTriggers])

  const setRelationContext = useCallback(async (stepId: string, context: string) => {
    const step = nodesRef.current.find((node) => node.id === stepId)
    if (!instanceId || !siteId || !step || step.type !== "wf-step" || !step.parent_node_id ||
      step.instance_id !== instanceId || step.site_id !== siteId || context.length > MAX_RELATION_CONTEXT_LENGTH) {
      throw new Error("Cannot update this workflow relation")
    }
    const label = workflowRelationContext(context)
    const { data, error } = await supabase.from("instance_nodes")
      .update({ settings: { ...(step.settings || {}), relation_context: label } })
      .eq("id", stepId)
      .eq("instance_id", instanceId)
      .eq("site_id", siteId)
      .eq("parent_node_id", step.parent_node_id)
      .select("*")
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error("The relation changed before it could be saved")
    const updated = data as InstanceNode
    setNodes((prev) => prev.map((node) => node.id === stepId ? updated : node))
    syncTriggers(instanceId)
    return updated
  }, [instanceId, siteId, syncTriggers])

  const deleteNode = useCallback(async (id: string) => {
    // Find the node before deleting it to refresh its workflow definition.
    const target = nodesRef.current.find((n) => n.id === id)
    if (!target || target.instance_id !== instanceId) return
    const children = nodesRef.current.filter((node) => node.parent_node_id === id)
    let detached = false
    try {
      if (children.length) {
        const { error } = await supabase.from("instance_nodes")
          .update({ parent_node_id: null })
          .eq("instance_id", target.instance_id)
          .eq("site_id", target.site_id)
          .eq("parent_node_id", id)
          .in("id", children.map((node) => node.id))
        if (error) throw error
        detached = true
        setNodes((prev) => prev.map((node) => node.parent_node_id === id ? { ...node, parent_node_id: null } : node))
      }
      const { error } = await supabase.from("instance_nodes")
        .delete()
        .eq("id", id)
        .eq("instance_id", target.instance_id)
        .eq("site_id", target.site_id)
      if (error) throw error
      deletedNodeIdsRef.current.add(id)
      setNodes((prev) => prev.filter((node) => node.id !== id))
    } catch (e) {
      if (detached) {
        const { error } = await supabase.from("instance_nodes")
          .update({ parent_node_id: id })
          .eq("instance_id", target.instance_id)
          .eq("site_id", target.site_id)
          .in("id", children.map((node) => node.id))
        if (error) console.error("Failed to restore workflow relations after deletion error:", error)
      }
      void reload()
      throw e
    }
    if (isWorkflowNode(target) && target.instance_id) {
      syncTriggers(target.instance_id)
    }
  }, [instanceId, syncTriggers, reload])

  const hasSandboxStep = useMemo(
    () =>
      nodes.some((n) => {
        const step = (n.settings as { step?: { requires_sandbox?: boolean } })?.step
        return Boolean(step?.requires_sandbox)
      }),
    [nodes],
  )

  const isLoading = Boolean(instanceId) && loadedInstanceId !== instanceId

  return { nodes, isLoading, reload, createNode, updateNode, setStepParent, setRelationContext, deleteNode, hasSandboxStep }
}

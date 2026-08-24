"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { InstanceNode } from "@/app/types/instance-nodes"
import { DEFAULT_PLAN_TYPE, WF_LOAD_NODE_TYPES, type WorkflowNodeType } from "./types"

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
      .insert({
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
          trigger: { kind: "manual", plan_type: DEFAULT_PLAN_TYPE },
        },
        result: {},
      })
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
  instanceIdRef.current = instanceId

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
        (payload) => {
          const row = (payload.new || payload.old) as InstanceNode | undefined
          if (row && !isWorkflowNode(row) && payload.eventType !== "DELETE") return
          void reload()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [instanceId, reload])

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
        .insert({
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
          },
          result: {},
        })
        .select("*")
        .single()
      if (error) throw error
      const created = data as InstanceNode
      setNodes((prev) => (prev.some((n) => n.id === created.id) ? prev : [...prev, created]))
      return created
    },
    [instanceId, siteId],
  )

  const updateNode = useCallback(async (id: string, patch: Partial<InstanceNode>) => {
    const { data, error } = await supabase.from("instance_nodes").update(patch).eq("id", id).select("*").single()
    if (error) throw error
    const updated = data as InstanceNode
    setNodes((prev) => prev.map((n) => (n.id === id ? updated : n)))
    return updated
  }, [])

  const deleteNode = useCallback(async (id: string) => {
    const { error } = await supabase.from("instance_nodes").delete().eq("id", id)
    if (error) throw error
    setNodes((prev) => prev.filter((n) => n.id !== id && n.parent_node_id !== id))
  }, [])

  const hasSandboxStep = useMemo(
    () =>
      nodes.some((n) => {
        const step = (n.settings as { step?: { requires_sandbox?: boolean } })?.step
        return Boolean(step?.requires_sandbox)
      }),
    [nodes],
  )

  const isLoading = Boolean(instanceId) && loadedInstanceId !== instanceId

  return { nodes, isLoading, reload, createNode, updateNode, deleteNode, hasSandboxStep }
}

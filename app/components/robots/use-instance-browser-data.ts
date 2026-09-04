"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { WF_LOAD_NODE_TYPES } from "@/app/components/workflows/types"
import type { InstanceMessages, InstanceStats, RobotInstance } from "./instance-browser-model"

const CHUNK_SIZE = 15
const WF_TYPES = `(${WF_LOAD_NODE_TYPES.join(",")})`

function resolveAssetUrl(filePath?: string | null) {
  if (!filePath) return null
  if (filePath.startsWith("http")) return filePath
  const supabase = createClient()
  const { data } = supabase.storage.from("assets").getPublicUrl(filePath)
  return data.publicUrl || null
}

export function useInstanceBrowserData(isOpen: boolean, instances: RobotInstance[]) {
  const [instanceMessages, setInstanceMessages] = useState<Record<string, InstanceMessages>>({})
  const [instanceStats, setInstanceStats] = useState<Record<string, InstanceStats>>({})
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  useEffect(() => {
    if (!isOpen || instances.length === 0) return

    let isMounted = true
    const supabase = createClient()
    const instanceIds = instances.map((instance) => instance.id)

    const fetchStats = async () => {
      setIsLoadingStats(true)

      for (let i = 0; i < instanceIds.length; i += CHUNK_SIZE) {
        if (!isMounted) return
        const chunk = instanceIds.slice(i, i + CHUNK_SIZE)
        const results = await Promise.all(chunk.map(async (id) => {
          const [nodesRes, workflowsRes, assetsRes, recentAssetsRes, reqRes, latestImageRes] = await Promise.all([
            supabase.from("instance_nodes").select("id", { count: "exact", head: true }).eq("instance_id", id).not("type", "in", WF_TYPES),
            supabase.from("instance_nodes").select("id", { count: "exact", head: true }).eq("instance_id", id).in("type", [...WF_LOAD_NODE_TYPES]),
            supabase.from("assets").select("id", { count: "exact", head: true }).eq("instance_id", id),
            supabase.from("assets").select("id, file_path, name, file_type, created_at").eq("instance_id", id).order("created_at", { ascending: false }).limit(3),
            supabase.from("requirement_status").select("id", { count: "exact", head: true }).eq("instance_id", id),
            supabase.from("assets").select("file_path").eq("instance_id", id).like("file_type", "image/%").order("created_at", { ascending: false }).limit(1),
          ])

          return {
            id,
            nodes: nodesRes.count || 0,
            workflows: workflowsRes.count || 0,
            assets: assetsRes.count || 0,
            recentAssets: recentAssetsRes.data || [],
            requirements: reqRes.count || 0,
            avatarUrl: resolveAssetUrl(latestImageRes.data?.[0]?.file_path),
          }
        }))

        if (!isMounted) return
        setInstanceStats((prev) => {
          const next = { ...prev }
          results.forEach((result) => {
            next[result.id] = {
              nodes: result.nodes,
              workflows: result.workflows,
              assets: result.assets,
              recentAssets: result.recentAssets,
              requirements: result.requirements,
              avatarUrl: result.avatarUrl,
            }
          })
          return next
        })
      }

      if (isMounted) setIsLoadingStats(false)
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true)

      for (let i = 0; i < instanceIds.length; i += CHUNK_SIZE) {
        if (!isMounted) return
        const chunk = instanceIds.slice(i, i + CHUNK_SIZE)
        const results = await Promise.all(chunk.map(async (id) => {
          const [userRes, agentRes] = await Promise.all([
            supabase.from("instance_logs").select("message, details, created_at").eq("instance_id", id).eq("log_type", "user_action").order("created_at", { ascending: false }).limit(1),
            supabase.from("instance_logs").select("message, details, created_at").eq("instance_id", id).in("log_type", ["agent_action", "system"]).order("created_at", { ascending: false }).limit(1),
          ])

          return {
            id,
            user: userRes.data?.[0] || null,
            agent: agentRes.data?.[0] || null,
          }
        }))

        if (!isMounted) return
        setInstanceMessages((prev) => {
          const next = { ...prev }
          results.forEach((result) => {
            next[result.id] = { user: result.user, agent: result.agent }
          })
          return next
        })
      }

      if (isMounted) setIsLoadingMessages(false)
    }

    fetchStats()
    fetchMessages()

    return () => {
      isMounted = false
    }
  }, [isOpen, instances])

  return { instanceMessages, instanceStats, isLoadingStats, isLoadingMessages }
}

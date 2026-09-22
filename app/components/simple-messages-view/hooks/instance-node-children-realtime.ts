import { createClient } from "@/lib/supabase/client"
import type { InstanceNode } from "@/app/types/instance-nodes"

type NodeListener = (nodes: InstanceNode[]) => void
type NodePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE"
  new?: Partial<InstanceNode>
  old?: Partial<InstanceNode>
}

type Client = ReturnType<typeof createClient>
type Channel = ReturnType<Client["channel"]>

type InstanceEntry = {
  client: Client
  channel: Channel
  listeners: Map<string, Set<NodeListener>>
  nodesByParent: Map<string, InstanceNode[]>
  pendingPayloads: NodePayload[]
  loaded: boolean
  refreshing: boolean
  refreshQueued: boolean
  hasSubscribed: boolean
  reconcileTimer: ReturnType<typeof setTimeout> | null
  closeTimer: ReturnType<typeof setTimeout> | null
}

const entries = new Map<string, InstanceEntry>()
let channelGeneration = 0
let browserListenersAttached = false
const CLOSE_GRACE_MS = 250
const RECONCILE_DEBOUNCE_MS = 250
const NODE_FIELDS =
  "id, instance_id, parent_instance_log_id, type, status, prompt"

function notifyParent(entry: InstanceEntry, parentLogId: string) {
  const nodes = entry.nodesByParent.get(parentLogId) || []
  for (const listener of entry.listeners.get(parentLogId) || []) {
    listener(nodes)
  }
}

function notifyAll(entry: InstanceEntry) {
  for (const parentLogId of entry.listeners.keys()) {
    notifyParent(entry, parentLogId)
  }
}

function findParentByNodeId(
  nodesByParent: Map<string, InstanceNode[]>,
  nodeId: string
): string | null {
  for (const [parentLogId, nodes] of nodesByParent) {
    if (nodes.some((node) => node.id === nodeId)) return parentLogId
  }
  return null
}

function applyPayload(entry: InstanceEntry, payload: NodePayload) {
  const nextNode = payload.new?.id ? payload.new as InstanceNode : null
  const nodeId = nextNode?.id || payload.old?.id
  if (!nodeId) return

  const previousParent = findParentByNodeId(entry.nodesByParent, nodeId)
  const nextParent = nextNode?.parent_instance_log_id || null
  const affectedParents = new Set<string>()

  if (previousParent) {
    const previousNodes = entry.nodesByParent.get(previousParent) || []
    entry.nodesByParent.set(
      previousParent,
      previousNodes.filter((node) => node.id !== nodeId)
    )
    affectedParents.add(previousParent)
  }

  if (payload.eventType !== "DELETE" && nextNode && nextParent) {
    const nextNodes = entry.nodesByParent.get(nextParent) || []
    entry.nodesByParent.set(nextParent, [...nextNodes, nextNode])
    affectedParents.add(nextParent)
  }

  if (entry.loaded) {
    for (const parentLogId of affectedParents) notifyParent(entry, parentLogId)
  }
}

function scheduleReconcile(
  instanceId: string,
  entry: InstanceEntry,
  delay = RECONCILE_DEBOUNCE_MS
) {
  if (entry.reconcileTimer) clearTimeout(entry.reconcileTimer)
  if (entry.refreshing) {
    entry.refreshQueued = true
    return
  }
  entry.reconcileTimer = setTimeout(() => {
    entry.reconcileTimer = null
    void refreshNodes(instanceId, entry)
  }, delay)
}

function reconcileVisibleEntries() {
  if (
    typeof document !== "undefined" &&
    (document.visibilityState === "hidden" || !navigator.onLine)
  ) {
    return
  }
  for (const [instanceId, entry] of entries) {
    scheduleReconcile(instanceId, entry)
  }
}

function attachBrowserListeners() {
  if (browserListenersAttached || typeof window === "undefined") return
  browserListenersAttached = true
  document.addEventListener("visibilitychange", reconcileVisibleEntries)
  window.addEventListener("online", reconcileVisibleEntries)
}

function detachBrowserListenersIfIdle() {
  if (!browserListenersAttached || entries.size > 0 || typeof window === "undefined") return
  browserListenersAttached = false
  document.removeEventListener("visibilitychange", reconcileVisibleEntries)
  window.removeEventListener("online", reconcileVisibleEntries)
}

async function refreshNodes(instanceId: string, entry: InstanceEntry) {
  if (entry.refreshing) {
    entry.refreshQueued = true
    return
  }
  entry.refreshing = true

  try {
    const { data, error } = await entry.client
      .from("instance_nodes")
      .select(NODE_FIELDS)
      .eq("instance_id", instanceId)
      .not("parent_instance_log_id", "is", null)

    if (entries.get(instanceId) !== entry) return

    if (error) {
      console.warn("[InstanceNodeChildren] Failed to load instance nodes", error)
    } else {
      entry.nodesByParent.clear()
      for (const node of (data || []) as unknown as InstanceNode[]) {
        if (!node.parent_instance_log_id) continue
        const current = entry.nodesByParent.get(node.parent_instance_log_id) || []
        current.push(node)
        entry.nodesByParent.set(node.parent_instance_log_id, current)
      }
    }
  } catch (error) {
    if (entries.get(instanceId) !== entry) return
    console.warn("[InstanceNodeChildren] Failed to load instance nodes", error)
  } finally {
    entry.refreshing = false
    if (entry.refreshQueued && entries.get(instanceId) === entry) {
      entry.refreshQueued = false
      scheduleReconcile(instanceId, entry, 0)
    }
  }

  if (entries.get(instanceId) !== entry) return
  for (const payload of entry.pendingPayloads) applyPayload(entry, payload)
  entry.pendingPayloads = []
  entry.loaded = true
  notifyAll(entry)
}

function createEntry(instanceId: string): InstanceEntry {
  const client = createClient()
  const listeners = new Map<string, Set<NodeListener>>()
  const nodesByParent = new Map<string, InstanceNode[]>()
  let entry: InstanceEntry

  const channel = client
    .channel(`instance_node_children_${instanceId}_${++channelGeneration}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "instance_nodes",
        filter: `instance_id=eq.${instanceId}`,
      },
      (payload: NodePayload) => {
        if (!entry.loaded || entry.refreshing) {
          entry.pendingPayloads.push(payload)
          return
        }
        applyPayload(entry, payload)
      }
    )

  entry = {
    client,
    channel,
    listeners,
    nodesByParent,
    pendingPayloads: [],
    loaded: false,
    refreshing: false,
    refreshQueued: false,
    hasSubscribed: false,
    reconcileTimer: null,
    closeTimer: null,
  }
  entries.set(instanceId, entry)
  attachBrowserListeners()
  channel.subscribe((status: string) => {
    if (status !== "SUBSCRIBED" || entries.get(instanceId) !== entry) return
    if (entry.hasSubscribed) {
      scheduleReconcile(instanceId, entry)
    } else {
      entry.hasSubscribed = true
    }
  })
  void refreshNodes(instanceId, entry)
  return entry
}

export function subscribeToInstanceNodeChildren(
  instanceId: string,
  parentLogId: string,
  listener: NodeListener
): () => void {
  const entry = entries.get(instanceId) || createEntry(instanceId)
  if (entry.closeTimer) {
    clearTimeout(entry.closeTimer)
    entry.closeTimer = null
  }

  const parentListeners = entry.listeners.get(parentLogId) || new Set<NodeListener>()
  parentListeners.add(listener)
  entry.listeners.set(parentLogId, parentListeners)
  if (entry.loaded) listener(entry.nodesByParent.get(parentLogId) || [])

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true

    const current = entries.get(instanceId)
    if (current !== entry) return
    const listenersForParent = entry.listeners.get(parentLogId)
    listenersForParent?.delete(listener)
    if (listenersForParent?.size === 0) entry.listeners.delete(parentLogId)
    if (entry.listeners.size > 0) return

    entry.closeTimer = setTimeout(() => {
      if (entry.listeners.size > 0 || entries.get(instanceId) !== entry) return
      if (entry.reconcileTimer) clearTimeout(entry.reconcileTimer)
      entries.delete(instanceId)
      detachBrowserListenersIfIdle()
      void Promise.resolve(entry.client.removeChannel(entry.channel)).catch((error) => {
        console.warn("[InstanceNodeChildren] Failed to close shared channel", error)
      })
    }, CLOSE_GRACE_MS)
  }
}

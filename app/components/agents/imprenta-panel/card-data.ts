import { useMemo } from "react"
import type { InstanceNode } from "@/app/types/instance-nodes"
import { isDescendantOfAudienceNode, isValidPublishAudienceSource } from "../imprenta-publish-context"
import { inferImprentaResultMediaType } from "./result-helpers"
import type { ImprentaContext, ImprentaLog } from "./data-types"

const EMPTY_NODES: InstanceNode[] = []
const EMPTY_CONTEXTS: ImprentaContext[] = []
const EMPTY_LOGS: ImprentaLog[] = []

type CardData = {
  nodes: InstanceNode[]
  contexts: ImprentaContext[]
  logs: ImprentaLog[]
  hasRealChildren: boolean
}

function reuseArray<T>(previous: T[] | undefined, next: T[]): T[] {
  return previous?.length === next.length && next.every((item, index) => item === previous[index])
    ? previous : next
}

/** Only ancestors affect result interpretation; unrelated nodes must not invalidate a card. */
function createCardDataSelector() {
  const cache = new Map<string, CardData>()
  return (nodes: InstanceNode[], dummyNodes: InstanceNode[], contexts: ImprentaContext[], logs: ImprentaLog[]) => {
    const byId = new Map([...nodes, ...dummyNodes].map(node => [node.id, node]))
    const parentsWithChildren = new Set(nodes.filter(node => !node.id.startsWith("dummy-")).map(node => node.parent_node_id))
    const incoming = new Map<string, ImprentaContext[]>()
    for (const context of contexts) {
      const group = incoming.get(context.target_node_id) ?? []
      group.push(context)
      incoming.set(context.target_node_id, group)
    }
    for (const id of cache.keys()) {
      if (!byId.has(id)) cache.delete(id)
    }

    return (node: InstanceNode): CardData => {
      const ancestors: InstanceNode[] = []
      const seen = new Set([node.id])
      let parentId = node.parent_node_id
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId)
        const parent = byId.get(parentId)
        if (!parent) break
        ancestors.push(parent)
        parentId = parent.parent_node_id
      }
      const previous = cache.get(node.id)
      const relatedNodes = reuseArray(previous?.nodes, ancestors.length ? ancestors : EMPTY_NODES)
      // Preserve the legacy instance-log fallback for audience results only.
      const usesAudienceLogs = isValidPublishAudienceSource(node)
        || isDescendantOfAudienceNode(node, relatedNodes)
        || inferImprentaResultMediaType(node, relatedNodes) === "audience"
      const data: CardData = {
        nodes: relatedNodes,
        contexts: reuseArray(previous?.contexts, incoming.get(node.id) ?? EMPTY_CONTEXTS),
        logs: usesAudienceLogs ? logs : EMPTY_LOGS,
        hasRealChildren: parentsWithChildren.has(node.id),
      }
      cache.set(node.id, data)
      return data
    }
  }
}

export function useImprentaCardData(
  nodes: InstanceNode[], dummyNodes: InstanceNode[], contexts: ImprentaContext[], logs: ImprentaLog[]
) {
  const select = useMemo(() => createCardDataSelector(), [])
  return useMemo(() => select(nodes, dummyNodes, contexts, logs), [select, nodes, dummyNodes, contexts, logs])
}
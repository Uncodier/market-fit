import type { MutableRefObject } from "react"
import type { InstanceNode } from "@/app/types/instance-nodes"
import { buildNodeCellGrid } from "@/app/lib/graph-viewport"

export type GridCacheEntry = {
  nodes: InstanceNode[]
  positions: Record<string, { x: number; y: number }>
  heights: Record<string, number>
  nodeW: number
  rowH: number
  ids: string[]
  grid: Map<string, Set<string>>
  nodesById: Map<string, InstanceNode>
  nodeIndexes: Map<string, number>
}

/** Identity-keyed grid helper kept module-level for HMR/React-Compiler compatibility. */
export function readCachedIdsAndGrid(
  cacheRef: MutableRefObject<GridCacheEntry | null>,
  nodes: InstanceNode[],
  positions: Record<string, { x: number; y: number }>,
  heights: Record<string, number>,
  nodeW: number,
  rowH: number
): GridCacheEntry {
  const cached = cacheRef.current
  if (
    cached &&
    cached.nodes === nodes &&
    cached.positions === positions &&
    cached.heights === heights &&
    cached.nodeW === nodeW &&
    cached.rowH === rowH
  ) {
    return cached
  }
  const ids = new Array<string>(nodes.length)
  const nodesById = new Map<string, InstanceNode>()
  const nodeIndexes = new Map<string, number>()
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    ids[i] = node.id
    nodesById.set(node.id, node)
    nodeIndexes.set(node.id, i)
  }
  const grid = buildNodeCellGrid(ids, positions, heights, nodeW, rowH)
  const entry: GridCacheEntry = {
    nodes,
    positions,
    heights,
    nodeW,
    rowH,
    ids,
    grid,
    nodesById,
    nodeIndexes,
  }
  cacheRef.current = entry
  return entry
}

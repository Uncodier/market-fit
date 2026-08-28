import type { InstanceNode } from "@/app/types/instance-nodes"
import {
  H_GAP,
  NODE_H,
  NODE_W,
  V_GAP,
  isOverallResultId,
  isWorkflowResultId,
  type WorkflowNodeType,
} from "./types"

export type WFPoint = { x: number; y: number }

export function readSavedPosition(node: InstanceNode, index: number): WFPoint {
  const pos = (node.settings as { ui_position?: { x?: number; y?: number } })?.ui_position
  return {
    x: Number(pos?.x ?? 80 + index * 40),
    y: Number(pos?.y ?? 80 + index * (NODE_H + V_GAP)),
  }
}

function boxOf(pos: WFPoint, height: number) {
  return { x: pos.x, y: pos.y, w: NODE_W, h: height }
}

function overlaps(a: WFPoint, ah: number, b: WFPoint, bh: number, pad = 8) {
  const left = boxOf(a, ah)
  const right = boxOf(b, bh)
  return (
    left.x < right.x + right.w + pad &&
    left.x + left.w + pad > right.x &&
    left.y < right.y + right.h + pad &&
    left.y + left.h + pad > right.y
  )
}

export function unstackOverlaps(
  nodes: InstanceNode[],
  positions: Record<string, WFPoint>,
  heights: Record<string, number>,
): Record<string, WFPoint> {
  const next = { ...positions }
  let changed = true
  let guard = 0
  while (changed && guard < 80) {
    changed = false
    guard += 1
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const pa = next[a.id]
        const pb = next[b.id]
        if (!pa || !pb) continue
        const ha = heights[a.id] || NODE_H
        const hb = heights[b.id] || NODE_H
        if (!overlaps(pa, ha, pb, hb)) continue
        next[b.id] = { x: pb.x, y: pa.y + ha + V_GAP }
        changed = true
      }
    }
  }
  return next
}

export function placeNewNode({
  type,
  parent,
  nodes,
  positions,
  heights,
}: {
  type: WorkflowNodeType
  parent: InstanceNode | null
  nodes: InstanceNode[]
  positions: Record<string, WFPoint>
  heights: Record<string, number>
}): WFPoint {
  if (type === "wf-trigger" || !parent) {
    const roots = nodes.filter((n) => !n.parent_node_id)
    if (roots.length === 0) return { x: 80, y: 80 }
    let x = 80
    let bottom = 80
    roots.forEach((root) => {
      const pos = positions[root.id] || readSavedPosition(root, 0)
      const height = heights[root.id] || NODE_H
      const edge = pos.y + height
      if (edge >= bottom) {
        bottom = edge
        x = pos.x
      }
    })
    return { x, y: bottom + V_GAP }
  }

  const parentPos = positions[parent.id] || readSavedPosition(parent, 0)
  let candidate = { x: parentPos.x + NODE_W + H_GAP, y: parentPos.y }
  for (let i = 0; i < 40; i++) {
    const hit = nodes.find((n) => {
      const pos = positions[n.id]
      if (!pos) return false
      return overlaps(candidate, NODE_H, pos, heights[n.id] || NODE_H)
    })
    if (!hit) break
    const hitPos = positions[hit.id]!
    candidate = { x: candidate.x, y: hitPos.y + (heights[hit.id] || NODE_H) + V_GAP }
  }
  return candidate
}

export function placeResultNodes(
  graphNodes: InstanceNode[],
  resultNodes: InstanceNode[],
  positions: Record<string, WFPoint>,
  heights: Record<string, number>,
): Record<string, WFPoint> {
  const next = { ...positions }
  const placed: InstanceNode[] = [...graphNodes]
  
  resultNodes.forEach((result) => {
    if (next[result.id]) {
      placed.push(result)
      return
    }

    const parentId = (result.settings?.source_node_id as string | undefined) || result.parent_node_id
    if (parentId) {
      const parentPos = next[parentId] || positions[parentId] || { x: 80, y: 80 }
      const parentH = heights[parentId] || NODE_H
      // Always pin result nodes exactly below their parent
      next[result.id] = {
        x: parentPos.x,
        y: parentPos.y + parentH + 12,
      }
      placed.push(result)
    } else {
      const parent = graphNodes.find((node) => node.id === result.parent_node_id) || null
      next[result.id] = placeNewNode({
        type: "wf-step",
        parent,
        nodes: placed,
        positions: next,
        heights,
      })
      placed.push(result)
    }
  })
  return next
}

export function computeGraphBounds(
  nodes: InstanceNode[],
  positions: Record<string, WFPoint>,
  heights: Record<string, number>,
) {
  if (nodes.length === 0) return { width: 800, height: 600, offsetX: 0, offsetY: 0 }
  let maxX = 400
  let maxY = 300
  nodes.forEach((node, index) => {
    const pos = positions[node.id] || readSavedPosition(node, index)
    maxX = Math.max(maxX, pos.x + NODE_W + H_GAP)
    maxY = Math.max(maxY, pos.y + (heights[node.id] || NODE_H) + V_GAP)
  })
  return { width: maxX, height: maxY, offsetX: 0, offsetY: 0 }
}

const INTERACTIVE_SELECTOR = [
  "button",
  "input",
  "textarea",
  "select",
  "a",
  "label",
  "[contenteditable='true']",
  '[role="switch"]',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="menu"]',
  '[role="dialog"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="tab"]',
  '[role="tabpanel"]',
].join(", ")

export function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest(INTERACTIVE_SELECTOR))
}

export function sortWorkflowLayout(
  nodes: InstanceNode[],
  heights: Record<string, number>,
): Record<string, WFPoint> {
  const byParent = new Map<string, InstanceNode[]>()
  const resultsByParent = new Map<string, InstanceNode[]>()
  const roots: InstanceNode[] = []
  
  nodes.forEach((node) => {
    if (isWorkflowResultId(node.id)) {
      const pId = node.settings?.source_node_id as string | undefined || node.parent_node_id
      if (pId) {
        const arr = resultsByParent.get(pId) || []
        arr.push(node)
        resultsByParent.set(pId, arr)
      }
      return
    }
    
    if (!node.parent_node_id) {
      roots.push(node)
      return
    }
    const siblings = byParent.get(node.parent_node_id) || []
    siblings.push(node)
    byParent.set(node.parent_node_id, siblings)
  })

  const byTime = (a: InstanceNode, b: InstanceNode) =>
    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  
  roots.sort(byTime)
  byParent.forEach((siblings) => siblings.sort(byTime))
  resultsByParent.forEach((results) => results.sort(byTime))

  const nodeEffectiveHeight = (nodeId: string): number => {
    let h = heights[nodeId] || NODE_H
    const results = resultsByParent.get(nodeId) || []
    results.forEach((res) => {
      h += 12 + (heights[res.id] || NODE_H)
    })
    return h
  }

  const subtreeHeight = (node: InstanceNode): number => {
    const kids = byParent.get(node.id) || []
    const selfH = nodeEffectiveHeight(node.id)
    if (kids.length === 0) return selfH
    const kidsH = kids.reduce((sum, kid, index) => sum + subtreeHeight(kid) + (index > 0 ? V_GAP : 0), 0)
    return Math.max(selfH, kidsH)
  }

  const pos: Record<string, WFPoint> = {}
  const place = (node: InstanceNode, x: number, y: number) => {
    pos[node.id] = { x, y }
    
    // Place result nodes exactly below
    let currentY = y + (heights[node.id] || NODE_H) + 12
    const results = resultsByParent.get(node.id) || []
    results.forEach((res) => {
      pos[res.id] = { x, y: currentY }
      currentY += (heights[res.id] || NODE_H) + 12
    })

    const kids = byParent.get(node.id) || []
    let childY = y
    kids.forEach((kid) => {
      place(kid, x + NODE_W + H_GAP, childY)
      childY += subtreeHeight(kid) + V_GAP
    })
  }

  let y = 80
  roots.forEach((root) => {
    place(root, 80, y)
    y += subtreeHeight(root) + V_GAP
  })
  return pos
}

export function positionsMoved(
  nodes: InstanceNode[],
  next: Record<string, WFPoint>,
): Array<{ id: string; settings: Record<string, unknown>; point: WFPoint }> {
  const moved: Array<{ id: string; settings: Record<string, unknown>; point: WFPoint }> = []
  nodes.forEach((node, index) => {
    const saved = readSavedPosition(node, index)
    const point = next[node.id]
    if (!point) return
    if (Math.abs(point.x - saved.x) < 1 && Math.abs(point.y - saved.y) < 1) return
    moved.push({
      id: node.id,
      settings: { ...((node.settings as Record<string, unknown>) || {}), ui_position: point },
      point,
    })
  })
  return moved
}

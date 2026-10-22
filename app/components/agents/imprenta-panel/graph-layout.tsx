import { InstanceNode } from "@/app/types/instance-nodes"
import { IMPRENTA_NODE_W, IMPRENTA_ROW_H } from './preview-helpers'
import type { useImprentaPanelState } from './state'

type ImprentaLayoutOptions = Pick<ReturnType<typeof useImprentaPanelState>, "sidebarWidth" | "nodeHeightsRef" | "contexts">

export function useImprentaLayout({ sidebarWidth, nodeHeightsRef, contexts }: ImprentaLayoutOptions) {
  const NODE_W = IMPRENTA_NODE_W

  const H_GAP = 80

  const V_GAP = 40

  const ROW_H = IMPRENTA_ROW_H

  const PAD_X = 100 + sidebarWidth

  const HEADER_STACK_PX = 135

  const PAD_Y = 100 + 188 - HEADER_STACK_PX

  const getLayoutPositions = (
    currentNodes: InstanceNode[],
    currentPositions: Record<string, { x: number; y: number }>,
    heights: Record<string, number> = nodeHeightsRef.current
  ): Record<string, { x: number; y: number }> => {
    const pos = { ...currentPositions }

    // Clean up any stale dummy positions first before we start logic, so we don't treat them as fixed nodes
    const validIds = new Set(currentNodes.map(n => n.id))
    Object.keys(pos).forEach(id => {
      if (!validIds.has(id)) {
        delete pos[id]
      }
    })

    // Group nodes by parent, preserving current visual order of positioned nodes
    const parentGroups: Record<string, InstanceNode[]> = {}
    currentNodes.forEach(n => {
      const pId = n.parent_node_id || '__root__'
      if (!parentGroups[pId]) parentGroups[pId] = []
      parentGroups[pId].push(n)
    })

    // Sort siblings: those with established positions stay in relative Y order,
    // unpositioned ones go at the end
    Object.keys(parentGroups).forEach(pId => {
      parentGroups[pId].sort((a, b) => {
        const pa = pos[a.id]
        const pb = pos[b.id]

        if (pa && pb) return pa.y - pb.y
        if (pa) return -1
        if (pb) return 1

        // Determine timestamp, fallback to 0
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;

        // For unpositioned ones, dummies last (stable sort) 
        // So if we have real nodes and dummies generated at the same time, real nodes show up first
        const isDummyA = a.id.startsWith('dummy-');
        const isDummyB = b.id.startsWith('dummy-');

        if (!isDummyA && isDummyB) return -1;
        if (isDummyA && !isDummyB) return 1;

        return timeA - timeB;
      })
    })

    const isInitial = !currentNodes.some(n => pos[n.id] && !n.id.startsWith('dummy-'))

    const nodeDepth = (id: string): number => {
      const n = currentNodes.find(nd => nd.id === id)
      if (!n?.parent_node_id) return 0
      return 1 + nodeDepth(n.parent_node_id)
    }

    const h = (id: string) => (heights[id] || ROW_H) + V_GAP

    // Parentless nodes that receive contexts ("results" fed purely by contexts)
    // should be anchored to the right of their context sources and vertically
    // centered between them, rather than floating at column 0 as a root.
    const incomingContextIds: Record<string, string[]> = {}
    contexts.forEach((c) => {
      if (!c?.target_node_id || !c?.context_node_id) return
      if (!incomingContextIds[c.target_node_id]) incomingContextIds[c.target_node_id] = []
      incomingContextIds[c.target_node_id].push(c.context_node_id)
    })
    const hasInboundContexts = (id: string) =>
      (incomingContextIds[id]?.length ?? 0) > 0

    /** Right of the rightmost positioned context, vertically centered between
     *  all positioned contexts. Returns null if no context has a position yet. */
    const computeContextAnchoredPosition = (
      nodeId: string,
      currentPos: Record<string, { x: number; y: number }>
    ): { x: number; y: number } | null => {
      const ctxIds = incomingContextIds[nodeId] || []
      const positioned = ctxIds.filter(id => currentPos[id])
      if (positioned.length === 0) return null
      const rightmostX = Math.max(...positioned.map(id => currentPos[id].x))
      const centers = positioned.map(
        id => currentPos[id].y + (heights[id] || ROW_H) / 2
      )
      const avgCenter = centers.reduce((s, c) => s + c, 0) / centers.length
      const myH = heights[nodeId] || ROW_H
      return { x: rightmostX + NODE_W + H_GAP, y: avgCenter - myH / 2 }
    }

    if (isInitial && currentNodes.length > 0) {
      const subtreeHeight = (id: string): number => {
        const ch = parentGroups[id] || []
        if (ch.length === 0) return h(id)
        const childrenSum = ch.reduce((s, c) => s + subtreeHeight(c.id), 0)
        return Math.max(h(id), childrenSum)
      }

      const assign = (id: string, d: number, yStart: number) => {
        const ch = parentGroups[id] || []
        const totalH = subtreeHeight(id)
        pos[id] = {
          x: PAD_X + d * (NODE_W + H_GAP),
          y: yStart + (totalH - h(id)) / 2
        }
        let cy = yStart
        ch.forEach(c => {
          assign(c.id, d + 1, cy)
          cy += subtreeHeight(c.id)
        })
      }

      const roots = parentGroups['__root__'] || []
      let yOffset = PAD_Y
      roots.forEach(r => {
        assign(r.id, 0, yOffset)
        yOffset += subtreeHeight(r.id) + V_GAP
      })

      // Post-pass: reposition parentless nodes that are fed by contexts so they
      // sit to the right of their rightmost context, vertically centered between
      // all of them. The entire subtree shifts with the orphan to keep children
      // glued to their parent. Iterated to resolve chained context dependencies.
      const shiftSubtree = (id: string, dx: number, dy: number) => {
        if (!pos[id]) return
        pos[id] = { x: pos[id].x + dx, y: pos[id].y + dy }
        const ch = parentGroups[id] || []
        ch.forEach(c => shiftSubtree(c.id, dx, dy))
      }
      const orphansWithCtx = roots.filter(n => hasInboundContexts(n.id))
      if (orphansWithCtx.length > 0) {
        for (let pass = 0;pass < 10;pass++) {
          let changed = false

          // Group orphans by their computed anchor position to avoid overlaps
          const anchoredPositions = new Map<string, typeof orphansWithCtx>();
          const nodeAnchors = new Map<string, { x: number, y: number, avgCenter: number }>();

          orphansWithCtx.forEach(node => {
            if (!pos[node.id]) return
            const anchored = computeContextAnchoredPosition(node.id, pos)
            if (!anchored) return

            // Re-calculate avgCenter because computeContextAnchoredPosition subtracts myH / 2
            const myH = h(node.id)
            const avgCenter = anchored.y + myH / 2
            nodeAnchors.set(node.id, { x: anchored.x, y: anchored.y, avgCenter })

            // Group by approximate position (to handle exact same contexts)
            const key = `${Math.round(anchored.x)},${Math.round(avgCenter)}`;
            if (!anchoredPositions.has(key)) anchoredPositions.set(key, []);
            anchoredPositions.get(key)!.push(node);
          });

          anchoredPositions.forEach((group) => {
            if (group.length === 1) {
              const node = group[0];
              const anchored = nodeAnchors.get(node.id)!;
              const dx = anchored.x - pos[node.id].x;
              const dy = anchored.y - pos[node.id].y;
              if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                shiftSubtree(node.id, dx, dy);
                changed = true;
              }
            } else {
              // Multiple nodes want to be at the same anchor. Stack them vertically
              // and center the entire stack around the avgCenter.
              const anchorInfo = nodeAnchors.get(group[0].id)!;
              const avgCenter = anchorInfo.avgCenter;

              // Calculate total height of the group
              let totalH = 0;
              group.forEach(n => { totalH += subtreeHeight(n.id); });
              totalH += (group.length - 1) * V_GAP;

              let currentY = avgCenter - totalH / 2;

              group.forEach(node => {
                const targetX = anchorInfo.x;
                const dx = targetX - pos[node.id].x;
                const dy = currentY - pos[node.id].y;
                if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                  shiftSubtree(node.id, dx, dy);
                  changed = true;
                }
                currentY += subtreeHeight(node.id) + V_GAP;
              });
            }
          });

          if (!changed) break
        }
      }
    } else {
      const unpositioned = currentNodes
        .filter(n => !pos[n.id])
        .sort((a, b) => nodeDepth(a.id) - nodeDepth(b.id))

      unpositioned.forEach(node => {
        const isRoot = !node.parent_node_id;

        // Parentless nodes fed by contexts: anchor to the right of their
        // rightmost context, centered vertically between them.
        if (isRoot && hasInboundContexts(node.id)) {
          const anchored = computeContextAnchoredPosition(node.id, pos)
          if (anchored) {
            pos[node.id] = anchored
            return
          }
        }

        let x: number;
        if (node.parent_node_id && pos[node.parent_node_id]) {
          x = pos[node.parent_node_id].x + NODE_W + H_GAP;
        } else {
          const d = nodeDepth(node.id);
          x = PAD_X + d * (NODE_W + H_GAP);
        }

        const siblings = parentGroups[node.parent_node_id || '__root__']
        const positionedSiblings = siblings.filter(n => n.id !== node.id && pos[n.id])

        let y: number

        if (isRoot) {
          const allPositioned = Object.keys(pos);
          if (allPositioned.length > 0) {
            let maxY = PAD_Y;
            allPositioned.forEach(id => {
              const bottom = pos[id].y + h(id);
              if (bottom > maxY) maxY = bottom;
            });
            y = maxY;
          } else {
            y = PAD_Y;
          }
        } else if (positionedSiblings.length > 0) {
          const lastSibling = positionedSiblings.reduce((a, b) => pos[a.id].y > pos[b.id].y ? a : b)
          y = pos[lastSibling.id].y + h(lastSibling.id)
        } else if (node.parent_node_id && pos[node.parent_node_id]) {
          y = pos[node.parent_node_id].y
        } else {
          y = PAD_Y
        }
        pos[node.id] = { x, y }
      })

      // Re-space already-positioned siblings that may now overlap or have gaps.
      for (const key of Object.keys(parentGroups)) {
        let nodeGroups: InstanceNode[][] = [];

        if (key === '__root__') {
          // For roots, separate them by X column to avoid comparing col 0 roots with col 1 orphans
          const cols: Record<number, InstanceNode[]> = {};
          parentGroups[key]
            .filter(n => pos[n.id] && !isNaN(pos[n.id].y))
            .forEach(n => {
              const colX = Math.round(pos[n.id].x / 100) * 100;
              if (!cols[colX]) cols[colX] = [];
              cols[colX].push(n);
            });
          nodeGroups = Object.values(cols);
        } else {
          nodeGroups = [
            parentGroups[key].filter(n => pos[n.id] && !isNaN(pos[n.id].y))
          ];
        }

        for (const sorted of nodeGroups) {
          if (sorted.length > 0 && key !== '__root__') {
            const firstNodeId = sorted[0].id;
            const firstNode = currentNodes.find(n => n.id === firstNodeId);
            const hasUserPos0 = firstNode && !firstNode.id.startsWith('dummy-') && (firstNode.settings)?.ui_position;

            if (!hasUserPos0) {
              const parentPos = pos[key];
              if (parentPos && pos[firstNodeId].y !== parentPos.y) {
                pos[firstNodeId] = { ...pos[firstNodeId], y: parentPos.y };
              }
            }
          }

          // Ensure sorted array is actually sorted by Y so adjacent overlaps are caught
          sorted.sort((a, b) => {
            const dy = pos[a.id].y - pos[b.id].y;
            if (Math.abs(dy) > 1) return dy;
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeA - timeB;
          });

          for (let i = 1;i < sorted.length;i++) {
            const prevNodeId = sorted[i - 1].id;
            const currNodeId = sorted[i].id;

            const prevBottom = pos[prevNodeId].y + h(prevNodeId)
            const currNode = currentNodes.find(n => n.id === currNodeId);
            const hasUserPos = currNode && !currNode.id.startsWith('dummy-') && (currNode.settings)?.ui_position;

            const prevNodeX = pos[prevNodeId].x;
            const currNodeX = pos[currNodeId].x;
            const xOverlap = Math.abs(currNodeX - prevNodeX) < NODE_W + H_GAP / 2;

            if (pos[currNodeId].y < prevBottom && xOverlap) {
              // Always unstack collisions (saved ui_position must not keep cards overlapping
              // after media height changes). Ignore exact same-Y dummy/real replacements.
              const isPrevDummy = prevNodeId.startsWith('dummy-');
              const isCurrDummy = currNodeId.startsWith('dummy-');
              const isReplacement = (isPrevDummy && !isCurrDummy) || (!isPrevDummy && isCurrDummy);
              const exactY = Math.abs(pos[currNodeId].y - pos[prevNodeId].y) <= 1;

              if (!(exactY && isReplacement)) {
                pos[currNodeId] = { ...pos[currNodeId], y: prevBottom }
              }
            } else if (pos[currNodeId].y > prevBottom && !hasUserPos && xOverlap) {
              // Pull up to close gap if it was placed automatically
              pos[currNodeId] = { ...pos[currNodeId], y: prevBottom }
            }
          }
        }
      }
    }

    return pos
  }

  return { NODE_W, H_GAP, V_GAP, ROW_H, PAD_X, HEADER_STACK_PX, PAD_Y, getLayoutPositions }
}

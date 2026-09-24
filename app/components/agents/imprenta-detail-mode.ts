export const IMPRENTA_LOD_LITE_MIN_NODES = 100

/**
 * Small graphs stay interactive DOM cards at every zoom level. Switching them
 * to a canvas shell makes a normal click appear to replace the card.
 */
export function isLargeImprentaGraph(nodeCount: number): boolean {
  return nodeCount >= IMPRENTA_LOD_LITE_MIN_NODES
}

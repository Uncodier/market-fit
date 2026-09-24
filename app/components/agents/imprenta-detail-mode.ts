export const IMPRENTA_LOD_LITE_MIN_NODES = 100

export type ImprentaResultMediaType = "text" | "image" | "video" | "audio" | "audience"

/**
 * Small graphs stay interactive DOM cards at every zoom level. Switching them
 * to a canvas shell makes a normal click appear to replace the card.
 */
export function isLargeImprentaGraph(nodeCount: number): boolean {
  return nodeCount >= IMPRENTA_LOD_LITE_MIN_NODES
}

/**
 * Text results retain their original response type. Converting a response to a
 * prompt turns an immutable result into an editable action card.
 */
export function imprentaNodeTypeForResultMediaType(
  currentType: string,
  mediaType: ImprentaResultMediaType,
): string {
  if (mediaType === "text") return currentType
  if (mediaType === "audience") return "generate-audience"
  return `generate-${mediaType}`
}

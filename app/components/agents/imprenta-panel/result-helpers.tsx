import { InstanceNode } from "@/app/types/instance-nodes"
import { imprentaNodeTypeForResultMediaType, type ImprentaResultMediaType } from "../imprenta-detail-mode"

export const skLine = "rounded-full bg-foreground/22 dark:bg-foreground/28 animate-pulse"

export const skBlock = "rounded-xl bg-muted/70 dark:bg-muted/55 border border-border animate-pulse"

export const skMedia = "rounded-2xl bg-muted/80 dark:bg-muted/65 border border-border animate-pulse"

export const IMPRENTA_LITE_MEDIA_WIDTH = "w-full"

export function imprentaSegmentedActiveIndex(type: string): number {
  switch (type) {
    case "generate-image":
      return 1
    case "generate-video":
      return 2
    case "generate-audio":
      return 3
    case "generate-audience":
      return 4
    case "publish":
      return 5
    case "prompt":
    default:
      return 0
  }
}

export function imprentaNodeHasResult(node: InstanceNode): boolean {
  const r = node.result as Record<string, unknown> | undefined
  return !!r && typeof r === "object" && Object.keys(r).length > 0
}

export function inferImprentaResultMediaType(node: InstanceNode, nodes: InstanceNode[] = []): ImprentaResultMediaType | null {
  if (!imprentaNodeHasResult(node)) return null
  const res = (node.result || {})

  if ((Array.isArray(res.audience_leads) && res.audience_leads.length > 0) || (Array.isArray(res.example_leads) && res.example_leads.length > 0)) return "audience"
  if (node.type === "generate-audience" || (node.settings)?.media_type === "audience") return "audience"

  const parentNode = nodes.find(n => n.id === node.parent_node_id)
  if (parentNode && (parentNode.type === "generate-audience" || (parentNode.settings)?.media_type === "audience" || (node.result)?.text?.includes("audience_id"))) {
    return "audience"
  }

  const outputs = Array.isArray(res.outputs) ? res.outputs : null
  if (outputs) {
    for (const o of outputs) {
      const t = o?.type?.toLowerCase()
      if (t === "image" || t === "video" || t === "audio") return t
      if (typeof o?.url === 'string') {
        if (o.url.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i)) return "video"
        if (o.url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) return "image"
        if (o.url.match(/\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i)) return "audio"
      }
    }
  }

  const media = Array.isArray(res.media) ? res.media : null
  if (media) {
    for (const m of media) {
      const t = m?.type?.toLowerCase()
      if (t === "image" || t === "video" || t === "audio") return t
      if (typeof m?.url === 'string') {
        if (m.url.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i)) return "video"
        if (m.url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) return "image"
        if (m.url.match(/\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i)) return "audio"
      }
    }
  }

  if (Array.isArray(res.images) && res.images.some((x: InstanceNode["result"]) => !!x?.url)) return "image"
  if (res.image?.url) return "image"
  if (res.video?.url) return "video"
  if (res.audio?.url) return "audio"
  if (typeof res.text === "string" && res.text.trim().length > 0) {
    if (res.text.match(/https?:\/\/[^\s"'<>()]+\.(mp4|webm|mov|mkv)/i)) return "video"
    if (res.text.match(/https?:\/\/[^\s"'<>()]+\.(jpg|jpeg|png|gif|webp|svg)/i)) return "image"
    if (res.text.match(/https?:\/\/[^\s"'<>()]+\.(mp3|wav|ogg|m4a|aac|flac)/i)) return "audio"
    return "text"
  }

  return "text"
}

export function normalizeImprentaNodeForResultMediaType(node: InstanceNode, nodes: InstanceNode[]): InstanceNode {
  if (node.id?.startsWith("dummy-")) return node
  if (node.type === "publish") return node

  const mediaType = inferImprentaResultMediaType(node, nodes)
  if (!mediaType) return node

  const nextType = imprentaNodeTypeForResultMediaType(node.type, mediaType)
  const prevMediaType = (node.settings)?.media_type
  const shouldSetMediaType = mediaType !== "text" && prevMediaType !== mediaType

  if (node.type === nextType && !shouldSetMediaType) return node

  const nextSettings = shouldSetMediaType
    ? { ...((node.settings) || {}), media_type: mediaType }
    : node.settings

  return {
    ...node,
    type: nextType,
    settings: nextSettings,
  }
}

export function isImprentaVisualMediaResultCard(node: InstanceNode, nodes: InstanceNode[] = []): boolean {
  const mediaType = inferImprentaResultMediaType(node, nodes)
  return mediaType === "image" || mediaType === "video"
}

export const IMPRENTA_SHOP_OVERLAY_BTN =
  "h-10 gap-1.5 bg-white text-black font-bold shadow-[0_4px_14px_rgba(0,0,0,0.28)] ring-1 ring-black/10 hover:bg-black hover:text-white active:scale-95 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-black"

export const IMPRENTA_SHOP_OVERLAY_ICON = "h-4 w-4 shrink-0"

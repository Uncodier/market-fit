"use client"

  import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, memo } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { useSite } from "@/app/context/SiteContext"
import { useLayout } from "@/app/context/LayoutContext"
import { useTheme } from "@/app/context/ThemeContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { useImprentaData } from "@/app/hooks/useImprentaData"
import { createClient } from "@/lib/supabase/client"
import { ZoomableCanvas, type ZoomableViewportInfo } from "./zoomable-canvas"
import { ImprentaParentEdgesCanvas } from "./imprenta-parent-edges-canvas"
import { ImprentaNodesCanvas, readCachedIdsAndGrid, type GridCacheEntry } from "./imprenta-nodes-canvas"
import { ImprentaContextEdges } from "./imprenta-context-edges"
import {
  worldViewportFromCanvas,
  bboxIntersects,
  buildNodeCellGrid,
  collectIdsFromGrid,
  quantizeViewport,
  type GraphBBox,
} from "@/app/lib/graph-viewport"
import {
  createViewportStore,
  type ViewportSnapshot,
  type ViewportStore,
} from "@/app/lib/imprenta-viewport-store"
import { getImprentaThumbCache } from "@/app/lib/imprenta-thumb-cache"
import { createImprentaDragStore } from '@/app/lib/imprenta-drag-store'
import { createImprentaHoverStore } from '@/app/lib/imprenta-hover-store'
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { Plus, Play, RotateCcw as RefreshCw, AlertCircle, FileText, Bot, Eye, Trash2, GitFork, Link, Copy, Globe, Mail, Phone, Tag, UploadCloud, Download, ZoomIn, X } from "@/app/components/ui/icons"
import { AudioPlayer } from "./audio-player"
import { SocialIcon } from "@/app/components/ui/social-icons"
import { InstanceNode } from "@/app/types/instance-nodes"
import { toast } from "sonner"
import { uploadAssetFile } from "@/app/assets/actions"
import { AnimatedConnectionLine } from "./animated-connection-line"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { ImprentaContextTypeSelect } from "@/app/components/agents/imprenta-context-type-select"
import { Switch } from "@/app/components/ui/switch"
import { Textarea } from "@/app/components/ui/textarea"
import { MediaParametersToolbar } from "../simple-messages-view/components/MediaParametersToolbar"
import { ImageParameters, VideoParameters, AudioParameters } from "../simple-messages-view/types"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { markdownComponents } from '../simple-messages-view/utils/markdownComponents'

import { ImprentaSkeleton } from "@/app/components/skeletons/imprenta-skeleton"
import {
  ImprentaLazyPreviewImage,
  ImprentaLazyPreviewVideo,
  ImprentaLazyCardImage,
} from "@/app/components/agents/imprenta-lazy-media"
import { ImprentaAudienceLeadsCarousel } from "@/app/components/agents/imprenta-audience-leads-carousel"
import type { AudienceLeadRow } from "@/app/audiences/actions"
import { isSocialMediaEntryConnected } from "@/app/components/settings/data-adapter"
import {
  destinationsRequireAudience,
  getPublishContextAnchorY,
  getPublishContextEdgeCaption,
  hasPublishAudienceInput,
  hasPublishContentInput,
  isDescendantOfAudienceNode,
  isNormalPublishContextType,
  isPublishAudienceSourceReady,
  isValidPublishAudienceSource,
  resolveAudienceSegmentIdForImprenta,
  shouldRouteToPublishAudienceSlot,
  PUBLISH_ANCHOR_AUDIENCE_Y,
  PUBLISH_ANCHOR_CONTENT_Y,
  PUBLISH_ANCHOR_CONTEXT_Y,
  PUBLISH_ANCHOR_LABELS,
  PUBLISH_SLOT_AUDIENCE,
  PUBLISH_SLOT_CONTENT,
  PUBLISH_SLOT_REFERENCE,
  validatePublishNodeInputs,
} from "@/app/components/agents/imprenta-publish-context"

/** Treat inherited / mistaken DB copies of the parent's coordinates as invalid for child nodes. */
function positionsNearlyEqual(
  a: { x: number; y: number },
  b: { x: number; y: number },
  eps = 1
) {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps
}

/** Prompt / generate / publish cards (not placeholder dummies). */
function isImprentaWorkflowActionNode(node: InstanceNode): boolean {
  if (node.id.startsWith("dummy-")) return false
  const t = node.type
  return t === "prompt" || t === "publish" || t.startsWith("generate-")
}

function isImprentaUploadedNode(node: InstanceNode): boolean {
  const source = (node.settings as any)?.imprenta_source
  return source === "upload"
}

const IMPRENTA_MODE_OPTIONS: readonly { type: string; label: string }[] = [
  { type: "prompt", label: "Text" },
  { type: "generate-image", label: "Image" },
  { type: "generate-video", label: "Video" },
  { type: "generate-audio", label: "Audio" },
  { type: "generate-audience", label: "Audience" },
  { type: "publish", label: "Publish" },
]

function imprentaSettingsForClonedType(
  newType: string,
  previous: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...previous }
  if (newType === "prompt") {
    out.media_type = "text"
  } else if (newType === "generate-audience") {
    out.media_type = "audience"
  } else if (newType === "publish") {
    delete out.media_type
  } else if (newType.startsWith("generate-")) {
    out.media_type = newType.replace("generate-", "")
  }
  return out
}

/**
 * Insert payload for a cloned context edge: same fields as the source (Content / Context /
 * Audience `type` slots, metadata, etc.) with a new `target_node_id` and current site/user.
 */
function cloneInstanceNodeContextRowForInsert(
  row: Record<string, unknown>,
  newTargetId: string,
  siteId: string,
  userId: string
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...row }
  delete next.id
  delete next.created_at
  delete next.updated_at
  next.target_node_id = newTargetId
  next.site_id = siteId
  next.user_id = userId
  return next
}

/** Hovered node plus every `parent_node_id` ancestor (cycle-safe). */
function collectNodeAndAncestorIds(nodeId: string, allNodes: InstanceNode[]): Set<string> {
  const byId = new Map(allNodes.map((n) => [n.id, n]))
  const out = new Set<string>()
  let cur: string | null = nodeId
  const guard = new Set<string>()
  while (cur && !guard.has(cur)) {
    guard.add(cur)
    out.add(cur)
    const n = byId.get(cur)
    cur = n?.parent_node_id ?? null
  }
  return out
}

const FALLBACK_POS = Object.freeze({ x: 100, y: 100 })

/** Matches layout constants in ImprentaPanel (NODE_W / ROW_H). */
const IMPRENTA_NODE_W = 480
const IMPRENTA_ROW_H = 300
/**
 * World padding around the screen rect when culling nodes (smaller = more aggressive unmount).
 * Keeps a small band so edges/nodes do not pop when panning.
 */
const IMPRENTA_VIEWPORT_CULL_PAD = 96
/** Canvas scale above which full node cards render; below uses lite shells. */
const IMPRENTA_LOD_FULL_DETAIL_SCALE = 0.4
/**
 * Below this total node count the graph stays in full DOM detail at ANY zoom.
 * Virtualization alone is enough for small/medium instances: the lite canvas
 * layer only buys you meaningful wins when the visible-node count at far zoom
 * would otherwise explode. Keep this generous so typical workflows never see
 * the "skeleton pop" when zooming out.
 */
/**
 * Within lite shells only (scale < IMPRENTA_LOD_FULL_DETAIL_SCALE):
 * - micro: minimal chrome + optional tiny preview
 * - simple: compact type layout + one small preview when images exist
 * - rich: full lite skeleton + larger previews / extra thumbs
 *
 * ZoomableCanvas clamps user zoom to min 0.01 (wheel / buttons / pinch). Initial
 * "fit" can be below that; thresholds must sit inside (~0.01 … full) so all
 * three bands are reachable while zooming.
 */
const IMPRENTA_LOD_LITE_MARKER_MAX = 0.08
const IMPRENTA_LOD_LITE_MICRO_MAX = 0.10
const IMPRENTA_LOD_LITE_SIMPLE_MAX = 0.15

type ImprentaLiteSkeletonBand = "marker" | "micro" | "simple" | "rich"

type LoadingRouteEdge = { parentId: string; childId: string }

function imprentaLiteSkeletonBand(scale: number): ImprentaLiteSkeletonBand {
  if (scale < IMPRENTA_LOD_LITE_MARKER_MAX) return "marker"
  if (scale < IMPRENTA_LOD_LITE_MICRO_MAX) return "micro"
  if (scale < IMPRENTA_LOD_LITE_SIMPLE_MAX) return "simple"
  return "rich"
}

function imprentaExtractResultUrl(text: unknown): string {
  if (!text) return ""
  const str = String(text)
  const urlMatch = str.match(/https?:\/\/[^\s"'<>()]+/)
  return urlMatch ? urlMatch[0] : str
}

/** Image URLs from result only (same priority as full-card rendering). Used for low-res lite previews. */
function collectImprentaLiteImagePreviewUrls(node: InstanceNode, max = 4): string[] {
  const urls: string[] = []
  const push = (raw: unknown) => {
    const u = imprentaExtractResultUrl(raw)
    if (u && /^https?:\/\//i.test(u) && !urls.includes(u)) urls.push(u)
  }
  const res = node.result as Record<string, unknown> | undefined
  if (!res) return urls

  const outputs = res.outputs as unknown[] | undefined
  if (Array.isArray(outputs)) {
    for (const o of outputs) {
      if (!o || typeof o !== "object") continue
      const item = o as Record<string, unknown>
      if (item.type === "image") {
        if (item.url) push(item.url)
        const data = item.data as Record<string, unknown> | undefined
        if (data?.url) push(data.url)
      }
      if (item.type === "video") {
        if (item.thumbnail_url) push(item.thumbnail_url)
        if (item.cover_url) push(item.cover_url)
        if (item.poster_url) push(item.poster_url)
        if (item.poster) push(item.poster)
        const data = item.data as Record<string, unknown> | undefined
        if (data?.thumbnail_url) push(data.thumbnail_url)
        if (data?.cover_url) push(data.cover_url)
        if (data?.poster_url) push(data.poster_url)
        if (data?.poster) push(data.poster)
      }
    }
  }
  if (urls.length < max) {
    const media = res.media as unknown[] | undefined
    if (Array.isArray(media)) {
      for (const m of media) {
        if (!m || typeof m !== "object") continue
        const item = m as Record<string, unknown>
        if (item.type === "image" && item.url) push(item.url)
        if (item.type === "video") {
          if (item.thumbnail_url) push(item.thumbnail_url)
          if (item.cover_url) push(item.cover_url)
          if (item.poster_url) push(item.poster_url)
          if (item.poster) push(item.poster)
        }
      }
    }
  }
  if (urls.length < max) {
    const images = res.images as unknown[] | undefined
    if (Array.isArray(images)) {
      for (const img of images) {
        if (img && typeof img === "object" && "url" in img) push((img as { url: unknown }).url)
      }
    }
  }
  if (urls.length < max) {
    const image = res.image as { url?: unknown } | undefined
    if (image?.url) push(image.url)
  }
  if (urls.length < max) {
    const video = res.video as { url?: unknown, thumbnail_url?: unknown, cover_url?: unknown, poster_url?: unknown, poster?: unknown } | undefined
    if (video?.thumbnail_url) push(video.thumbnail_url)
    if (video?.cover_url) push(video.cover_url)
    if (video?.poster_url) push(video.poster_url)
    if (video?.poster) push(video.poster)
  }
  return urls.slice(0, max)
}

/** Video URLs from result (outputs → media → video), for lite shells when no image poster exists. */
function collectImprentaLiteVideoPreviewUrls(node: InstanceNode, max = 2): string[] {
  const urls: string[] = []
  const push = (raw: unknown) => {
    const u = imprentaExtractResultUrl(raw)
    if (u && /^https?:\/\//i.test(u) && !urls.includes(u)) urls.push(u)
  }
  const res = node.result as Record<string, unknown> | undefined
  if (!res) return urls

  const outputs = res.outputs as unknown[] | undefined
  if (Array.isArray(outputs)) {
    for (const o of outputs) {
      if (!o || typeof o !== "object") continue
      const item = o as Record<string, unknown>
      if (item.type === "video") {
        if (item.url) push(item.url)
        const data = item.data as Record<string, unknown> | undefined
        if (data?.url) push(data.url)
      }
    }
  }
  if (urls.length < max) {
    const media = res.media as unknown[] | undefined
    if (Array.isArray(media)) {
      for (const m of media) {
        if (!m || typeof m !== "object") continue
        const item = m as Record<string, unknown>
        if (item.type === "video" && item.url) push(item.url)
      }
    }
  }
  if (urls.length < max) {
    const video = res.video as { url?: unknown } | undefined
    if (video?.url) push(video.url)
  }
  return urls.slice(0, max)
}

/** When the full card has never been measured, approximate its height from prompt + result shape (media, text, etc.). */
function estimateImprentaNodeContentHeight(node: InstanceNode, rowH: number): number {
  let extra = 0
  const promptText =
    typeof (node.prompt as { text?: string } | undefined)?.text === "string"
      ? (node.prompt as { text: string }).text
      : ""
  const promptLines = Math.min(28, Math.max(0, Math.ceil(promptText.length / 70)))
  extra += promptLines * 20

  const res = node.result as Record<string, unknown> | undefined
  if (!res || Object.keys(res).length === 0) {
    return Math.min(Math.max(rowH + extra + 32, rowH), 960)
  }

  extra += 48
  const outputs = res.outputs as unknown[] | undefined
  const media = res.media as unknown[] | undefined
  const images = res.images as unknown[] | undefined
  const image = res.image as { url?: string } | undefined
  const video = res.video as { url?: string } | undefined
  const audio = res.audio as { url?: string } | undefined
  const text = res.text as string | undefined

  if (Array.isArray(outputs) && outputs.length > 0) {
    extra += Math.min(420, 120 + outputs.length * 95)
  } else if (Array.isArray(media) && media.length > 0) {
    extra += Math.min(440, 100 + media.length * 110)
  } else if (Array.isArray(images) && images.length > 0) {
    extra += Math.min(480, 90 + images.length * 220)
  } else if (image?.url) {
    extra += 300
  } else if (video?.url) {
    extra += 320
  } else if (audio?.url) {
    extra += 140
  } else if (typeof text === "string" && text.length > 0) {
    const tl = Math.min(48, Math.ceil(text.length / 62))
    extra += tl * 22 + 48
    if (/https?:\/\/[^\s"'<>()]+\.(jpg|jpeg|png|gif|webp|svg)/i.test(text) || /!\[.*?\]\(https?:\/\/[^\s"'<>()]+\)/i.test(text)) {
      extra += 300 // Add height for inline markdown images
    }
  } else if (res.audience_leads != null) {
    extra += 220
  } else {
    extra += 100
  }

  return Math.min(Math.max(rowH + extra, rowH + 64), 1600)
}

/** Skeleton lines/blocks: higher contrast on dark canvas. */
const skLine = "rounded-full bg-foreground/22 dark:bg-foreground/28 animate-pulse"
const skBlock = "rounded-xl bg-muted/70 dark:bg-muted/55 border border-border animate-pulse"
const skMedia = "rounded-2xl bg-muted/80 dark:bg-muted/65 border border-border animate-pulse"

/** Match the full-card layout (p-5, NO heavy header bar). */
const IMPRENTA_LITE_MEDIA_WIDTH = "w-full"

/** Map node type -> active pill index inside the media-type segmented control. */
function imprentaSegmentedActiveIndex(type: string): number {
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

function imprentaNodeHasResult(node: InstanceNode): boolean {
  const r = node.result as Record<string, unknown> | undefined
  return !!r && typeof r === "object" && Object.keys(r).length > 0
}

type ImprentaResultMediaType = "text" | "image" | "video" | "audio" | "audience"

function inferImprentaResultMediaType(node: InstanceNode): ImprentaResultMediaType | null {
  if (!imprentaNodeHasResult(node)) return null
  const res = (node.result || {}) as any

  if (Array.isArray(res.audience_leads) && res.audience_leads.length > 0) return "audience"

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

  if (Array.isArray(res.images) && res.images.some((x: any) => !!x?.url)) return "image"
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

function imprentaNodeTypeForResultMediaType(mediaType: ImprentaResultMediaType): string {
  if (mediaType === "text") return "prompt"
  if (mediaType === "audience") return "generate-audience"
  return `generate-${mediaType}`
}

function normalizeImprentaNodeForResultMediaType(node: InstanceNode): InstanceNode {
  if (node.id?.startsWith("dummy-")) return node
  if (node.type === "publish") return node

  const mediaType = inferImprentaResultMediaType(node)
  if (!mediaType) return node

  const nextType = imprentaNodeTypeForResultMediaType(mediaType)
  const prevMediaType = (node.settings as any)?.media_type
  const shouldSetMediaType = mediaType !== "text" && prevMediaType !== mediaType

  if (node.type === nextType && !shouldSetMediaType) return node

  const nextSettings = shouldSetMediaType
    ? { ...((node.settings as any) || {}), media_type: mediaType }
    : node.settings

  return {
    ...node,
    type: nextType,
    settings: nextSettings,
  }
}

/**
 * DOM twin of `drawLiteNode`: renders the exact structural silhouette of a
 * final card so when users drag or zoom the shell they see the same three-zone
 * layout (label → segmented/body → separator + action buttons) instead of a
 * bare rounded rectangle.
 */
function ImprentaLiteSkeletonBody({ node, zoomScale }: { node: InstanceNode; zoomScale: number }) {
  const band = imprentaLiteSkeletonBand(zoomScale)
  const type = node.type ?? "prompt"
  const rich = band === "rich"
  const micro = band === "micro"
  const imageUrls = useMemo(() => collectImprentaLiteImagePreviewUrls(node, 4), [node.id, node.result])
  const videoUrls = useMemo(() => collectImprentaLiteVideoPreviewUrls(node, 2), [node.id, node.result])
  const cover = imageUrls[0]
  const coverVideo = !cover ? videoUrls[0] : null
  const hasResult = imprentaNodeHasResult(node)
  const activeIdx = imprentaSegmentedActiveIndex(type)
  /** Nearer to full-card zoom: fetch previews earlier so the shell matches readability. */
  const priorityPreviews = rich

  /** Bottom separator + Generate (no result) / 4 action buttons (with result). */
  const footer = (
    <div className="mt-auto pt-3 border-t border-border/60">
      {hasResult ? (
        <div className="flex gap-2 w-full">
          <div className={`h-8 flex-1 rounded-md ${skBlock}`} />
          <div className={`h-8 flex-1 rounded-md ${skBlock} opacity-95`} />
          <div className={`h-8 flex-1 rounded-md ${skBlock} opacity-90`} />
          <div className={`h-8 flex-1 rounded-md ${skBlock} opacity-85`} />
        </div>
      ) : (
        <div className={`h-9 w-full rounded-md ${skBlock}`} />
      )}
    </div>
  )

  // Micro band: tiny 3-zone silhouette (label strip · body · button strip).
  if (micro) {
    return (
      <div className="flex h-full w-full flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className={`h-1.5 w-14 ${skLine}`} />
          {hasResult && <div className={`h-1.5 w-9 ${skLine}`} />}
        </div>
        <div className={`flex-1 min-h-0 rounded-lg ${skBlock}`} />
        <div className="h-px bg-border/60" />
        {hasResult ? (
          <div className="flex gap-1">
            <div className={`h-5 flex-1 rounded-md ${skBlock}`} />
            <div className={`h-5 flex-1 rounded-md ${skBlock}`} />
            <div className={`h-5 flex-1 rounded-md ${skBlock}`} />
            <div className={`h-5 flex-1 rounded-md ${skBlock}`} />
          </div>
        ) : (
          <div className={`h-5 w-full rounded-md ${skBlock}`} />
        )}
      </div>
    )
  }

  /** Label row (TYPE / RESULT) + optional status badge. */
  const header = (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none truncate">
        {hasResult ? "Result" : type.replace(/-/g, " ")}
      </span>
      {hasResult && <div className={`h-3.5 w-12 rounded ${skBlock}`} />}
    </div>
  )

  // --- Publish: 3 left-side anchors + destinations row + textarea -----------
  if (type === "publish") {
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {header}
        <div className="flex-1 min-h-0 flex gap-2">
          <div className="flex flex-col justify-between shrink-0 py-1 w-4">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-primary/60 bg-background mx-auto" />
            <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/50 bg-background mx-auto" />
            {rich && <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/50 bg-background mx-auto" />}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {hasResult ? (
              <div className={`flex-1 rounded-xl ${skBlock}`} />
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <div className={`h-7 w-[4.5rem] rounded-full ${skBlock}`} />
                  <div className={`h-7 w-[4.5rem] rounded-full ${skBlock}`} />
                  <div className={`h-7 w-16 rounded-full ${skBlock}`} />
                  {rich && <div className={`h-7 w-20 rounded-full ${skBlock}`} />}
                </div>
                <div className={`flex-1 min-h-[52px] rounded-xl ${skBlock}`} />
              </>
            )}
          </div>
        </div>
        {footer}
      </div>
    )
  }

  // --- Result state ----------------------------------------------------------
  if (hasResult) {
    const videoLayout = !cover && !!coverVideo
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {header}
        {cover || coverVideo ? (
          <div
            className={`${IMPRENTA_LITE_MEDIA_WIDTH} max-w-full shrink-0 min-h-0 overflow-hidden rounded-2xl border border-border ${
              videoLayout ? "aspect-video" : "aspect-square"
            }`}
          >
            {cover ? (
              <ImprentaLazyPreviewImage
                url={cover}
                width={videoLayout ? 640 : 512}
                height={videoLayout ? 360 : 512}
                priority={priorityPreviews}
              />
            ) : (
              <ImprentaLazyPreviewVideo url={coverVideo!} priority={priorityPreviews} />
            )}
          </div>
        ) : (
          <div className={`flex-1 min-h-[60px] rounded-xl ${skBlock} p-3 space-y-2`}>
            <div className={`h-2 w-[92%] ${skLine}`} />
            <div className={`h-2 w-[80%] ${skLine}`} />
            {rich && <div className={`h-2 w-[68%] ${skLine}`} />}
          </div>
        )}
        {footer}
      </div>
    )
  }

  // --- Non-result: 6-pill segmented control + textarea/media + toolbar ------
  const segmented = (
    <div className="flex items-center bg-muted/50 p-1 rounded-2xl gap-1">
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const active = i === activeIdx
        return (
          <div
            key={i}
            className={`flex-1 h-7 rounded-full flex items-center justify-center ${
              active ? "bg-background shadow-sm border border-border" : ""
            }`}
          >
            <div
              className={`h-1.5 w-6 rounded-full ${
                active ? "bg-foreground/40" : "bg-foreground/20"
              }`}
            />
          </div>
        )
      })}
    </div>
  )

  const showMedia =
    type === "generate-image" ||
    type === "generate-video" ||
    !!cover ||
    !!coverVideo
  const videoLayout = type === "generate-video" || (!cover && !!coverVideo)

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {header}
      {segmented}
      {showMedia ? (
        <div
          className={`${IMPRENTA_LITE_MEDIA_WIDTH} max-w-full shrink-0 min-h-0 overflow-hidden rounded-2xl border border-border ${
            videoLayout ? "aspect-video" : "aspect-square"
          }`}
        >
          {cover ? (
            <ImprentaLazyPreviewImage
              url={cover}
              width={videoLayout ? 640 : 512}
              height={videoLayout ? 360 : 512}
              priority={priorityPreviews}
            />
          ) : coverVideo ? (
            <ImprentaLazyPreviewVideo url={coverVideo} priority={priorityPreviews} />
          ) : (
            <div className={`h-full w-full ${skMedia} rounded-none border-0`} />
          )}
        </div>
      ) : (
        <div className={`flex-1 min-h-[60px] rounded-xl ${skBlock} p-3 space-y-2`}>
          <div className={`h-2 w-[88%] ${skLine}`} />
          <div className={`h-2 w-[72%] ${skLine}`} />
          {rich && <div className={`h-2 w-[58%] ${skLine}`} />}
        </div>
      )}
      {type === "generate-audience" ? (
        <div className="flex items-center gap-2">
          <div className={`h-8 w-20 rounded-xl ${skBlock}`} />
          <div className={`h-8 w-16 rounded-xl ${skBlock}`} />
          <div className={`h-8 w-20 rounded-xl ${skBlock}`} />
        </div>
      ) : (
        <div className="flex gap-2">
          <div className={`h-6 w-20 rounded-md ${skBlock}`} />
          {rich && <div className={`h-6 w-16 rounded-md ${skBlock} opacity-90`} />}
        </div>
      )}
      {footer}
    </div>
  )
}

const ImprentaLiteGraphNode = memo(function ImprentaLiteGraphNode({
  node,
  pos,
  width,
  height,
  zoomScale,
  onMouseDown,
  registerRef,
  onHoverChange,
}: {
  node: InstanceNode
  pos: { x: number; y: number }
  /** Same as full card (e.g. 480) so layout and edges stay aligned. */
  width: number
  /** Measured or default row height so placeholder matches real node footprint. */
  height: number
  /** Canvas zoom scale for progressive lite LOD (smaller = farther). */
  zoomScale: number
  onMouseDown: (e: React.MouseEvent) => void
  registerRef: (el: HTMLDivElement | null) => void
  /** Highlights context + parent edges tied to this node while the pointer is over the shell. */
  onHoverChange?: (nodeId: string | null) => void
}) {
  const h = Math.max(Math.round(height), IMPRENTA_ROW_H)
  const micro = imprentaLiteSkeletonBand(zoomScale) === "micro"
  return (
    <div
      ref={registerRef}
      data-node-id={node.id}
      data-imprenta-lite="1"
      className="absolute z-10 cursor-grab active:cursor-grabbing rounded-3xl border-2 border-foreground/10 bg-card shadow-[0_0_10px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col pointer-events-auto box-border"
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, left: 0, top: 0, width, height: h }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => onHoverChange?.(node.id)}
      onMouseLeave={() => onHoverChange?.(null)}
    >
      <div className={`flex-1 min-h-0 flex flex-col ${micro ? "p-3" : "p-5"}`}>
        <ImprentaLiteSkeletonBody node={node} zoomScale={zoomScale} />
      </div>
    </div>
  )
})

const REMARK_PLUGINS = [remarkGfm]

const MemoMarkdown = memo(function MemoMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  )
})

const ImprentaDummyCardInner = memo(({ 
  node, 
  pos, 
  draggingNodeId, 
  liteDummy, 
  registerNodeRef,
  onMouseDown
}: {
  node: InstanceNode
  pos: { x: number; y: number }
  draggingNodeId: string | null
  liteDummy: boolean
  registerNodeRef: (id: string, el: HTMLDivElement | null) => void
  onMouseDown?: (e: React.MouseEvent) => void
}) => {
  const mediaTypeForDummy = (node.settings as any)?.media_type || node.type.replace('generate-', '')
  const isMediaDummy = mediaTypeForDummy === 'image' || mediaTypeForDummy === 'video' || mediaTypeForDummy === 'audio'
  const isVideoDummy = mediaTypeForDummy === 'video'
  
  const aspectRatioParam = (node.settings as any)?.parameters?.aspectRatio
  let aspectStyle = "1/1"
  if (isVideoDummy) aspectStyle = "16/9"
  
  if (aspectRatioParam) {
    if (aspectRatioParam === "16:9") aspectStyle = "16/9"
    else if (aspectRatioParam === "9:16") aspectStyle = "9/16"
    else if (aspectRatioParam === "4:3") aspectStyle = "4/3"
    else if (aspectRatioParam === "3:4") aspectStyle = "3/4"
    else if (aspectRatioParam === "1:1") aspectStyle = "1/1"
    else aspectStyle = String(aspectRatioParam).replace(':', '/')
  }

  return (
<div 
                          key={node.id}
                          ref={(el) => registerNodeRef(node.id, el)}
                          data-node-id={node.id}
                        className={cn(
                          "absolute group z-10 cursor-grab active:cursor-grabbing pointer-events-auto",
                          draggingNodeId ? "select-none" : ""
                        )}
                        style={{ 
                          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                          left: 0,
                          top: 0,
                        }}
                        onMouseDown={onMouseDown}
                        >
                          <Card
                            className={
                              "w-[480px] shadow-[0_0_10px_rgba(0,0,0,0.05)] border-2 border-foreground/10 bg-card rounded-3xl " +
                              (liteDummy ? "" : "animate-pulse")
                            }
                          >
                            <CardContent className="p-5 flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none truncate">
                                  Result
                                </span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-secondary/50">
                                  {node.status === 'pending' ? 'pending' : 'running'}
                                </Badge>
                              </div>
                              
                              {isMediaDummy ? (
                                <div 
                                  className={`w-full overflow-hidden rounded-xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center pointer-events-none`}
                                  style={{ aspectRatio: aspectStyle }}
                                >
                                  {!liteDummy && (
                                    <div className="relative w-full h-full">
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <Bot className="w-8 h-8 text-muted-foreground/30 animate-pulse" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className={`flex-1 min-h-[140px] rounded-xl bg-muted/30 border border-border/50 p-4 flex flex-col gap-3 justify-center`}>
                                  {!liteDummy && (
                                    <>
                                      <div className="h-2.5 w-[85%] rounded-full bg-muted-foreground/20 animate-pulse" />
                                      <div className="h-2.5 w-[65%] rounded-full bg-muted-foreground/20 animate-pulse" />
                                      <div className="h-2.5 w-[40%] rounded-full bg-muted-foreground/20 animate-pulse" />
                                    </>
                                  )}
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between pt-3 border-t border-white/5 opacity-50 pointer-events-none">
                                <div className="flex gap-2 w-full">
                                  <div className="h-8 flex-1 rounded-md bg-muted/50 border border-border/50" />
                                  <div className="h-8 flex-1 rounded-md bg-muted/50 border border-border/50" />
                                  <div className="h-8 flex-1 rounded-md bg-muted/50 border border-border/50" />
                                  <div className="h-8 flex-1 rounded-md bg-muted/50 border border-border/50" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
  )
})

const ImprentaNodeCardInner = memo(({
  node,
  pos,
  draggingNodeId,
  hasResult,
  actionRunning,
  hasCnt,
  hasAud,
  needAudience,
  registerNodeRef,
  nodes,
  dummyNodes,
  contexts,
  supabase,
  generatingNodeIds,
  currentSite,
  textParams,
  imageParams,
  videoParams,
  audioParams,
  renderMediaWithZoom,
  actions
}: {
  node: InstanceNode
  pos: { x: number; y: number }
  draggingNodeId: string | null
  hasResult: boolean
  actionRunning: boolean
  hasCnt: boolean
  hasAud: boolean
  needAudience: boolean
  registerNodeRef: (id: string, el: HTMLDivElement | null) => void
  nodes: InstanceNode[]
  dummyNodes: InstanceNode[]
  contexts: any[]
  supabase: any
  generatingNodeIds: Set<string>
  currentSite: any
  textParams: any
  imageParams: any
  videoParams: any
  audioParams: any
  renderMediaWithZoom: any
  actions: {
    handleNodeMouseDown: (e: any, id: string) => void
    handleDeleteNode: (id: string) => Promise<void>
    handleDuplicateNode: (id: string) => Promise<void>
    handleConnectionDrop: (e: any, id: string, type?: "content" | "context" | "audience") => void
    handleConnectionStart: (e: any, id: string) => void
    handleExecuteNode: (node: InstanceNode) => void
    setNodes: any
    setZoomedMedia: any
    handleImprentaNodeHover: (id: string | null) => void
    isImprentaWorkflowActionNode: (node: InstanceNode) => boolean
    getParentNode: (node: InstanceNode) => InstanceNode | undefined
    handleCreateActionFromContext: (ctx: any) => void
  }
}) => {
  return (
<div 
                        key={node.id}
                        ref={(el) => registerNodeRef(node.id, el)}
                        data-node-id={node.id}
                        className={cn(
                          "absolute cursor-grab active:cursor-grabbing",
                          draggingNodeId ? "select-none" : ""
                        )}
                        style={{ 
                          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                          left: 0,
                          top: 0,
                          zIndex: 10
                        }}
                        onMouseDown={(e) => actions.handleNodeMouseDown(e, node.id)}
                      >
                        <Card
                          // `transition-shadow` forced a repaint of every visible card on every
                          // hover change in Safari. Keep a flat static shadow and skip the
                          // transition. We DO NOT use `contain: paint` here: with many cards on
                          // screen, promoting each to its own Safari composite layer (plus the
                          // rounded-corner clip mask it implies) cost more than it saved.
                          // `group` + toolbar inside the card so hover ends when the pointer
                          // leaves the card surface (not the wider node wrapper used for drag).
                          className={
                            "group relative w-[480px] shadow-[0_0_10px_rgba(0,0,0,0.05)] border-2 border-foreground/10 bg-card rounded-3xl" +
                            (node.type === "publish" && !hasResult ? " group/publish-in" : "") +
                            (actionRunning ? " imprenta-action-running" : "")
                          }
                          onMouseEnter={() => actions.handleImprentaNodeHover(node.id)}
                          onMouseLeave={() => actions.handleImprentaNodeHover(null)}
                        >
                          <div
                            className="absolute z-20 flex flex-row-reverse items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                            style={{ top: -36, right: -6 }}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-8 w-8 rounded-full p-0 shadow-md shrink-0 [&_svg]:size-3"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void actions.handleDeleteNode(node.id)
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6} className="text-xs max-w-[240px]">
                                Delete this node and all nested nodes
                              </TooltipContent>
                            </Tooltip>
                            {actions.isImprentaWorkflowActionNode(node) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-8 w-8 rounded-full p-0 shadow-md border border-border/70 bg-background hover:bg-muted shrink-0 [&_svg]:size-3"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void actions.handleDuplicateNode(node.id)
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={6} className="text-xs max-w-[240px]">
                                  Duplicate settings and context links; the new node starts as pending
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>

                          <CardContent className="p-5 relative">
                            {!hasResult &&
                              (node.type === "publish" ? (
                                (() => {
                                  const contentWarn = !hasCnt;
                                  const audienceWarn = needAudience && !hasAud;
                                  const anchorClass = (warn: boolean) =>
                                    `w-4 h-4 bg-background border-2 rounded-full flex items-center justify-center shrink-0 hover:scale-125 transition-transform ${
                                      warn ? "border-amber-500" : "border-muted-foreground"
                                    }`;
                                  return (
                                    <>
                                      <div
                                        className="absolute -left-3 z-20 w-4 -translate-y-1/2"
                                        style={{ top: `${PUBLISH_ANCHOR_CONTENT_Y * 100}%` }}
                                        title="Content: any creative output (same allowed sources as Context; not Audience-branched)"
                                      >
                                        <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-foreground bg-muted/95 border border-border px-1.5 py-0.5 rounded-md shadow-sm opacity-0 group-hover/publish-in:opacity-100 transition-opacity whitespace-nowrap">
                                          {PUBLISH_ANCHOR_LABELS.content}
                                        </span>
                                        <div
                                          className={anchorClass(contentWarn)}
                                          onClick={(e) => actions.handleConnectionDrop(e, node.id, "content")}
                                        >
                                          <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full pointer-events-none" />
                                        </div>
                                      </div>
                                      <div
                                        className="absolute -left-3 z-20 w-4 -translate-y-1/2"
                                        style={{ top: `${PUBLISH_ANCHOR_CONTEXT_Y * 100}%` }}
                                        title="Context: normal references (style, data, other nodes)"
                                      >
                                        <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-foreground bg-muted/95 border border-border px-1.5 py-0.5 rounded-md shadow-sm opacity-0 group-hover/publish-in:opacity-100 transition-opacity whitespace-nowrap">
                                          {PUBLISH_ANCHOR_LABELS.context}
                                        </span>
                                        <div
                                          className={anchorClass(false)}
                                          onClick={(e) => actions.handleConnectionDrop(e, node.id, "context")}
                                        >
                                          <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full pointer-events-none" />
                                        </div>
                                      </div>
                                      <div
                                        className="absolute -left-3 z-20 w-4 -translate-y-1/2"
                                        style={{ top: `${PUBLISH_ANCHOR_AUDIENCE_Y * 100}%` }}
                                        title={
                                          needAudience
                                            ? "Audience: Audience node including audience_id: (required for Mail, WhatsApp, Newsletter)"
                                            : "Audience: Audience node including audience_id: (optional)"
                                        }
                                      >
                                        <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-foreground bg-muted/95 border border-border px-1.5 py-0.5 rounded-md shadow-sm opacity-0 group-hover/publish-in:opacity-100 transition-opacity whitespace-nowrap">
                                          {PUBLISH_ANCHOR_LABELS.audience}
                                        </span>
                                        <div
                                          className={anchorClass(audienceWarn)}
                                          onClick={(e) => actions.handleConnectionDrop(e, node.id, "audience")}
                                        >
                                          <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full pointer-events-none" />
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()
                              ) : (
                              <div 
                                className="absolute top-1/2 -translate-y-1/2 -left-3 w-4 h-4 bg-background border-2 border-muted-foreground rounded-full flex items-center justify-center z-20 hover:scale-125 transition-transform" 
                                  title="Drop context here"
                                onClick={(e) => actions.handleConnectionDrop(e, node.id)}
                              >
                                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full pointer-events-none" />
                              </div>
                              ))}

                            {hasResult && (
                              <div 
                                className="absolute top-1/2 -translate-y-1/2 -right-3 w-4 h-4 bg-background border-2 border-primary rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20 hover:scale-125 transition-transform" 
                                title="Drag to a context input"
                                onClick={(e) => actions.handleConnectionStart(e, node.id)}
                              >
                                <div className="w-1.5 h-1.5 bg-primary rounded-full pointer-events-none" />
                              </div>
                            )}

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground uppercase leading-none">
                                  {hasResult ? 'Result' : node.type}
                                </span>
                                {hasResult && (
                                  <Badge variant={
                                    node.status === 'completed' ? 'success' as any :
                                    node.status === 'failed' ? 'destructive' :
                                    node.status === 'running' ? 'default' : 'secondary'
                                  } className="text-[10px] px-1.5 py-0">
                                    {node.status}
                                  </Badge>
                                )}
                              </div>

                              {actions.isImprentaWorkflowActionNode(node) &&
                                !hasResult &&
                                !isImprentaUploadedNode(node) &&
                                (() => {
                                  const hasRealChildren = nodes.some(
                                    (ch) => ch.parent_node_id === node.id && !String(ch.id).startsWith("dummy-")
                                  )
                                  const outputTypeLocked =
                                    hasRealChildren || node.status !== "pending" || generatingNodeIds.has(node.id)
                                  const lockedTitle = outputTypeLocked
                                    ? "Output type is locked. Duplicate this node to change it."
                                    : "Card mode"

                                  return (
                                    <div
                                      className="flex flex-wrap items-center bg-muted/50 p-1 rounded-2xl gap-1"
                                      title={lockedTitle}
                                    >
                                      {IMPRENTA_MODE_OPTIONS.map(({ type: modeType, label }) => (
                                        <Button
                                          key={modeType}
                                          type="button"
                                          disabled={outputTypeLocked}
                                          variant={node.type === modeType ? "outline" : "ghost"}
                                          size="sm"
                                          className={`flex-1 h-7 text-[11px] rounded-full font-medium ${
                                            node.type === modeType
                                              ? "bg-background shadow-sm border-white/10"
                                              : "text-muted-foreground hover:text-foreground"
                                          }`}
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            if (outputTypeLocked) {
                                              toast.error("Output type is locked. Duplicate this node to change it.")
                                              return
                                            }
                                            actions.setNodes((prev: InstanceNode[]) =>
                                              prev.map((n: InstanceNode) => (n.id === node.id ? { ...n, type: modeType } : n))
                                            )
                                            await supabase
                                              .from("instance_nodes")
                                              .update({ type: modeType })
                                              .eq("id", node.id)
                                          }}
                                        >
                                          {label}
                                        </Button>
                                      ))}
                                    </div>
                                  )
                                })()}
                              
                              {!hasResult && (
                                <>
                                <Textarea 
                                  defaultValue={node.prompt?.text || ''}
                                  onBlur={async (e) => {
                                    const newText = e.target.value;
                                    if (newText !== node.prompt?.text) {
                                      actions.setNodes((prev: InstanceNode[]) => prev.map((n: InstanceNode) => n.id === node.id ? { ...n, prompt: { ...n.prompt, text: newText } } : n));
                                      const { error } = await supabase
                                        .from('instance_nodes')
                                        .update({ prompt: { ...node.prompt, text: newText } })
                                        .eq('id', node.id);
                                        
                                      if (error) {
                                        toast.error("Failed to save node text");
                                        console.error(error);
                                      }
                                    }
                                  }}
                                  className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-xl resize-none focus-visible:ring-1 focus-visible:ring-secondary min-h-[60px] max-h-[150px]"
                                  placeholder={node.type === 'publish' ? "Optional: custom instructions for publishing..." : "Type to edit prompt..."}
                                />
                                
                                {node.type === 'generate-audience' && (
                                  <TooltipProvider delayDuration={200}>
                                    <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4 [&>*]:min-w-0">
                                      {([
                                        { key: 'email', label: 'Email', icon: Mail, hint: 'Only include leads that have an email address.' },
                                        { key: 'web', label: 'Web', icon: Globe, hint: 'Only include leads that have a website URL.' },
                                        { key: 'phone', label: 'Phone', icon: Phone, hint: 'Only include leads that have a phone number.' },
                                        { key: 'deals', label: 'Deals', icon: Tag, hint: 'Only include leads that have at least one deal.' },
                                      ] as const).map(({ key, label, icon: Icon, hint }) => {
                                        const isSelected = !!(node.settings as any)?.audience_channels?.includes(key);
                                        const toggleChannel = async () => {
                                          const current = (node.settings as any)?.audience_channels || [];
                                          const newChannels = isSelected
                                            ? current.filter((c: string) => c !== key)
                                            : [...current, key];
                                          actions.setNodes((prev: InstanceNode[]) => prev.map((n: InstanceNode) => n.id === node.id ? { ...n, settings: { ...((n.settings as any) || {}), audience_channels: newChannels } } : n));
                                          await supabase.from('instance_nodes').update({
                                            settings: { ...((node.settings as any) || {}), audience_channels: newChannels }
                                          }).eq('id', node.id);
                                        };
                                        return (
                                          <Tooltip key={key}>
                                            <TooltipTrigger asChild>
                                              <label
                                                className="flex w-full min-w-0 cursor-pointer select-none items-center gap-1.5 text-[11px]"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <span className={`min-w-0 flex-1 truncate text-right font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                                                <Switch
                                                  thumbIcon={<Icon className="h-3 w-3" />}
                                                  checked={isSelected}
                                                  onCheckedChange={toggleChannel}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="h-[22px] w-[44px] shrink-0 [&>span]:h-[18px] [&>span]:w-[18px] [&>span[data-state=checked]]:translate-x-[22px] [&>span[data-state=unchecked]]:translate-x-0"
                                                />
                                              </label>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-[11px] max-w-[220px]">
                                              {hint}
                                            </TooltipContent>
                                          </Tooltip>
                                        );
                                      })}
                                    </div>
                                  </TooltipProvider>
                                )}

                                {node.type === 'publish' && (() => {
                                  const siteUrl = currentSite?.url && String(currentSite.url).trim();
                                  const isEmailDistributionAvailable = currentSite?.settings?.channels?.email?.status === 'synced';
                                  const isWhatsappAvailable = currentSite?.settings?.channels?.whatsapp?.status === 'active' || currentSite?.settings?.channels?.agent_whatsapp?.status === 'active';
                                  const rawDestinations = (node.settings as any)?.publish_destinations;
                                  // Treat unset destinations as blog-on-by-default when the site has a URL,
                                  // so new publish nodes land preconfigured for the most common case.
                                  const currentDestinations: string[] = Array.isArray(rawDestinations)
                                    ? rawDestinations
                                    : (siteUrl ? ['blog'] : []);
                                  const toggleDestination = async (key: string) => {
                                    const isOn = currentDestinations.includes(key);
                                    const newDest = isOn
                                      ? currentDestinations.filter((d: string) => d !== key)
                                      : [...currentDestinations, key];
                                    actions.setNodes((prev: InstanceNode[]) => prev.map((n: InstanceNode) => n.id === node.id ? { ...n, settings: { ...((n.settings as any) || {}), publish_destinations: newDest } } : n));
                                    await supabase.from('instance_nodes').update({
                                      settings: { ...((node.settings as any) || {}), publish_destinations: newDest }
                                    }).eq('id', node.id);
                                  };

                                  const renderToggle = (key: string, label: string, icon: React.ReactNode, hint: string) => {
                                    const isSelected = currentDestinations.includes(key);
                                    return (
                                      <Tooltip key={key}>
                                        <TooltipTrigger asChild>
                                          <label
                                            className="flex w-full min-w-0 cursor-pointer select-none items-center gap-1.5 text-[11px]"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <span
                                              className={`min-w-0 flex-1 truncate text-right font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}
                                            >
                                              {label}
                                            </span>
                                            <Switch
                                              thumbIcon={icon}
                                              checked={isSelected}
                                              onCheckedChange={() => toggleDestination(key)}
                                              onClick={(e) => e.stopPropagation()}
                                              className="h-[22px] w-[44px] shrink-0 [&>span]:h-[18px] [&>span]:w-[18px] [&>span[data-state=checked]]:translate-x-[22px] [&>span[data-state=unchecked]]:translate-x-0"
                                            />
                                          </label>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-[11px] max-w-[220px]">
                                          {hint}
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  };

                                  return (
                                    <TooltipProvider delayDuration={200}>
                                      <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4 [&>*]:min-w-0">
                                        {(currentSite?.settings?.social_media || [])
                                          .filter(isSocialMediaEntryConnected)
                                          .map((sm: any) => {
                                            const platformLabel = String(sm.platform).charAt(0).toUpperCase() + String(sm.platform).slice(1);
                                            return renderToggle(
                                              sm.platform,
                                              platformLabel,
                                              <SocialIcon platform={sm.platform} size={12} color="currentColor" />,
                                              `Publish this content to your connected ${platformLabel} account.`
                                            );
                                          })}
                                        {siteUrl && renderToggle(
                                          'blog',
                                          'Blog',
                                          <Globe size={12} />,
                                          'Publish this content as a blog post on your site.'
                                        )}
                                        {isEmailDistributionAvailable && renderToggle(
                                          'mail',
                                          'Mail',
                                          <Mail size={12} />,
                                          'Send this content as an individual email to the selected audience.'
                                        )}
                                        {isEmailDistributionAvailable && renderToggle(
                                          'newsletter',
                                          'Newsletter',
                                          <FileText
                                            size={12}
                                            className="[&>svg]:block [&>svg]:-translate-x-px"
                                          />,
                                          'Include this content in your next newsletter to subscribers.'
                                        )}
                                        {isWhatsappAvailable && renderToggle(
                                          'whatsapp',
                                          'WhatsApp',
                                          <SocialIcon platform="whatsapp" size={12} color="currentColor" />,
                                          'Send this content through your connected WhatsApp channel.'
                                        )}
                                      </div>
                                    </TooltipProvider>
                                  );
                                })()}
                                
                                {node.type !== 'publish' && node.type !== 'generate-audience' && (
                                  <div className="flex justify-start w-full">
                                    <MediaParametersToolbar
                                      selectedActivity={node.type}
                                      textParameters={(node.settings as any)?.parameters || textParams}
                                      imageParameters={(node.settings as any)?.parameters || imageParams}
                                      videoParameters={(node.settings as any)?.parameters || videoParams}
                                      audioParameters={(node.settings as any)?.parameters || audioParams}
                                      onTextParameterChange={async (key, value) => {
                                        const currentParams = (node.settings as any)?.parameters || textParams;
                                        const newParams = { ...currentParams, [key]: value };
                                        const updatedSettings = { ...((node.settings as any) || {}), media_type: 'text', parameters: newParams };
                                        actions.setNodes((prev: InstanceNode[]) => prev.map((n: InstanceNode) => n.id === node.id ? { ...n, settings: updatedSettings } : n));
                                        await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id);
                                      }}
                                      onImageParameterChange={async (key, value) => {
                                        const currentParams = (node.settings as any)?.parameters || imageParams;
                                        const newParams = { ...currentParams, [key]: value };
                                        const updatedSettings = { ...((node.settings as any) || {}), media_type: 'image', parameters: newParams };
                                        actions.setNodes((prev: InstanceNode[]) => prev.map((n: InstanceNode) => n.id === node.id ? { ...n, settings: updatedSettings } : n));
                                        await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id);
                                      }}
                                      onVideoParameterChange={async (key, value) => {
                                        const currentParams = (node.settings as any)?.parameters || videoParams;
                                        const newParams = { ...currentParams, [key]: value };
                                        const updatedSettings = { ...((node.settings as any) || {}), media_type: 'video', parameters: newParams };
                                        actions.setNodes((prev: InstanceNode[]) => prev.map((n: InstanceNode) => n.id === node.id ? { ...n, settings: updatedSettings } : n));
                                        await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id);
                                      }}
                                      onAudioParameterChange={async (key, value) => {
                                        const currentParams = (node.settings as any)?.parameters || audioParams;
                                        const newParams = { ...currentParams, [key]: value };
                                        const updatedSettings = { ...((node.settings as any) || {}), media_type: 'audio', parameters: newParams };
                                        actions.setNodes((prev: InstanceNode[]) => prev.map((n: InstanceNode) => n.id === node.id ? { ...n, settings: updatedSettings } : n));
                                        await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id);
                                      }}
                                    />
                                  </div>
                                )}
                              </>
                            )}
                            
                              {hasResult && (
                              (() => {
                                const extractUrl = (text: any): string => {
                                  if (!text) return '';
                                  const str = String(text);
                                  const urlMatch = str.match(/https?:\/\/[^\s"'<>()]+/);
                                  return urlMatch ? urlMatch[0] : str;
                                };

                                return (
                                <div className="flex flex-col gap-2">
                                {(() => {
                                  const allNodes = [...nodes, ...dummyNodes]
                                  const embeddedRaw = (node.result as { audience_leads?: unknown })?.audience_leads
                                  const embeddedLeads: AudienceLeadRow[] | undefined = Array.isArray(embeddedRaw)
                                    ? (embeddedRaw as AudienceLeadRow[])
                                    : undefined
                                  const resolvedId = resolveAudienceSegmentIdForImprenta(node, allNodes)
                                  const audienceId =
                                    resolvedId ||
                                    (embeddedLeads?.[0]?.audience_id
                                      ? String(embeddedLeads[0].audience_id)
                                      : "")
                                  const showLeadsCarousel =
                                    !!currentSite?.id &&
                                    (isValidPublishAudienceSource(node) ||
                                      isDescendantOfAudienceNode(node, allNodes)) &&
                                    (!!audienceId || (embeddedLeads && embeddedLeads.length > 0))
                                  if (!showLeadsCarousel) return null
                                  return (
                                    <ImprentaAudienceLeadsCarousel
                                      audienceId={audienceId || String(embeddedLeads?.[0]?.audience_id ?? "")}
                                      siteId={currentSite.id}
                                      embeddedLeads={embeddedLeads}
                                    />
                                  )
                                })()}
                                {(node.result as any).outputs && Array.isArray((node.result as any).outputs) && (
                                  <div className="flex flex-col gap-2">
                                    {(node.result as any).outputs.map((outputItem: any, idx: number) => {
                                      const rawUrl = outputItem.data?.url || outputItem.url;
                                      if (!rawUrl) return null;
                                      const url = extractUrl(rawUrl);
                                      if (outputItem.type === 'image') return renderMediaWithZoom(url, 'image', idx);
                                      if (outputItem.type === 'video') return renderMediaWithZoom(url, 'video', idx);
                                      if (outputItem.type === 'audio') return <AudioPlayer key={url || idx} src={url} className="w-full" />;
                                      return null;
                                    })}
                                  </div>
                                )}
                                {(node.result as any).media && Array.isArray((node.result as any).media) && (
                                  <div className="flex flex-col gap-2">
                                    {(node.result as any).media.map((mediaItem: any, idx: number) => {
                                      if (!mediaItem.url) return null;
                                      const url = extractUrl(mediaItem.url);
                                      if (mediaItem.type === 'image') return renderMediaWithZoom(url, 'image', idx);
                                      if (mediaItem.type === 'video') return renderMediaWithZoom(url, 'video', idx);
                                      if (mediaItem.type === 'audio') return <AudioPlayer key={url || idx} src={url} className="w-full" />;
                                      return null;
                                    })}
                                  </div>
                                )}
                                {!(node.result as any).outputs && !(node.result as any).media && (node.result as any).images && Array.isArray((node.result as any).images) && (
                                  <div className="flex flex-col gap-2">
                                    {(node.result as any).images.map((img: any, idx: number) => (
                                      img.url && renderMediaWithZoom(extractUrl(img.url), 'image', idx)
                                    ))}
                                  </div>
                                )}
                                {!(node.result as any).outputs && !(node.result as any).media && !(node.result as any).images && (node.result as any).image && (node.result as any).image.url && (
                                  renderMediaWithZoom(extractUrl((node.result as any).image.url), 'image', 'single-img')
                                )}
                                {!(node.result as any).outputs && !(node.result as any).media && (node.result as any).video && (node.result as any).video.url && (
                                  renderMediaWithZoom(extractUrl((node.result as any).video.url), 'video', 'single-vid')
                                )}
                                {!(node.result as any).outputs && !(node.result as any).media && (node.result as any).audio && (node.result as any).audio.url && (
                                  <AudioPlayer key={extractUrl((node.result as any).audio.url)} src={extractUrl((node.result as any).audio.url)} className="w-full" />
                                )}
                                {((node.result as any).text || (!(node.result as any).outputs && !(node.result as any).media && !(node.result as any).images && !(node.result as any).image && !(node.result as any).video && !(node.result as any).audio && !(node.result as any).text)) && (() => {
                                  let textContent = (node.result as any).text 
                                    ? String((node.result as any).text) 
                                    : "```json\n" + JSON.stringify(node.result, null, 2) + "\n```";
                                  
                                  const hasStructuredMedia = !!(node.result as any).outputs || !!(node.result as any).media || !!(node.result as any).images || !!(node.result as any).image || !!(node.result as any).video || !!(node.result as any).audio;

                                  const parentNode = actions.getParentNode(node);
                                  const isParentTextAction = parentNode && (parentNode.type === 'prompt' || parentNode.type === 'generate-text' || (parentNode.settings as any)?.media_type === 'text');
                                  
                                  // Detect intention: did this node intend to produce media?
                                  const isMediaIntent = !isParentTextAction && (node.type === 'generate-image' || node.type === 'generate-video' || node.type === 'generate-audio' || 
                                                        (node.settings as any)?.media_type === 'image' || (node.settings as any)?.media_type === 'video' || (node.settings as any)?.media_type === 'audio' ||
                                                        (parentNode && (parentNode.type === 'generate-image' || parentNode.type === 'generate-video' || parentNode.type === 'generate-audio' ||
                                                                        (parentNode.settings as any)?.media_type === 'image' || (parentNode.settings as any)?.media_type === 'video' || (parentNode.settings as any)?.media_type === 'audio')));

                                  let extractedUrl: string | null = null;
                                  if (isMediaIntent) {
                                    // If we ALREADY successfully parsed structured media, we don't need to show ANY text. 
                                    if (hasStructuredMedia) return null;

                                    // If we ONLY got text back from the agent for a media node, forcefully extract the media link and discard the conversational text.
                                    let expectedMediaType = (node.settings as any)?.media_type || node.type.replace('generate-', '');
                                    if (!['image', 'video', 'audio'].includes(expectedMediaType) && parentNode) {
                                      expectedMediaType = (parentNode.settings as any)?.media_type || parentNode.type.replace('generate-', '');
                                    }
                                    
                                    if (expectedMediaType === 'image') {
                                      const imgMatchMarkdown = textContent.match(/!\[.*?\]\((https?:\/\/[^\s"'<>()]+)\)/);
                                      const imgMatchUrl = textContent.match(/https?:\/\/[^\s"'<>()]+\.(jpg|jpeg|png|gif|webp|svg)/i) || textContent.match(/https?:\/\/[^\s"'<>()]+/);
                                      if (imgMatchMarkdown) extractedUrl = imgMatchMarkdown[1];
                                      else if (imgMatchUrl) extractedUrl = imgMatchUrl[0];
                                      
                                      if (extractedUrl) return renderMediaWithZoom(extractedUrl, 'image', 'extracted-img');
                                    } else if (expectedMediaType === 'video') {
                                      const vidMatchUrl = textContent.match(/https?:\/\/[^\s"'<>()]+\.(mp4|webm|mov|mkv)/i) || textContent.match(/https?:\/\/[^\s"'<>()]+/);
                                      if (vidMatchUrl) extractedUrl = vidMatchUrl[0];
                                      
                                      if (extractedUrl) return renderMediaWithZoom(extractedUrl, 'video', 'extracted-vid');
                                    } else if (expectedMediaType === 'audio') {
                                      const audioMatchUrl = textContent.match(/https?:\/\/[^\s"'<>()]+\.(mp3|wav|ogg|m4a|aac|flac)/i) || textContent.match(/https?:\/\/[^\s"'<>()]+/);
                                      if (audioMatchUrl) extractedUrl = audioMatchUrl[0];
                                      
                                      if (extractedUrl) return <AudioPlayer key="extracted-audio" src={extractedUrl} className="w-full" />;
                                    }

                                    // If no URL could be extracted yet and it's still running, show a placeholder
                                    if (!extractedUrl && (node.status === 'running' || node.status === 'pending')) {
                                      const aspectRatioParam = (node.settings as any)?.parameters?.aspectRatio || (parentNode?.settings as any)?.parameters?.aspectRatio;
                                      let aspectStyle = "1/1";
                                      if (expectedMediaType === 'video') aspectStyle = "16/9";
                                      
                                      if (aspectRatioParam) {
                                        if (aspectRatioParam === "16:9") aspectStyle = "16/9";
                                        else if (aspectRatioParam === "9:16") aspectStyle = "9/16";
                                        else if (aspectRatioParam === "4:3") aspectStyle = "4/3";
                                        else if (aspectRatioParam === "3:4") aspectStyle = "3/4";
                                        else if (aspectRatioParam === "1:1") aspectStyle = "1/1";
                                        else aspectStyle = String(aspectRatioParam).replace(':', '/');
                                      }

                                      return (
                                        <div 
                                          className={`w-full overflow-hidden rounded-xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center`}
                                          style={{ aspectRatio: aspectStyle }}
                                        >
                                          <div className="relative w-full h-full">
                                            <div className="absolute inset-0 flex items-center justify-center">
                                              <Bot className="w-8 h-8 text-muted-foreground/30 animate-pulse" />
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }

                                    // If completed and no media could be extracted (e.g. error message from agent),
                                    // we replace the text with an error placeholder and a retry button.
                                    if (!extractedUrl && (node.status === 'completed' || node.status === 'failed')) {
                                      const aspectRatioParam = (node.settings as any)?.parameters?.aspectRatio || (parentNode?.settings as any)?.parameters?.aspectRatio;
                                      let aspectStyle = "1/1";
                                      if (expectedMediaType === 'video') aspectStyle = "16/9";
                                      if (aspectRatioParam) {
                                        if (aspectRatioParam === "16:9") aspectStyle = "16/9";
                                        else if (aspectRatioParam === "9:16") aspectStyle = "9/16";
                                        else if (aspectRatioParam === "4:3") aspectStyle = "4/3";
                                        else if (aspectRatioParam === "3:4") aspectStyle = "3/4";
                                        else if (aspectRatioParam === "1:1") aspectStyle = "1/1";
                                        else aspectStyle = String(aspectRatioParam).replace(':', '/');
                                      }

                                      return (
                                        <div 
                                          className={`w-full overflow-hidden rounded-xl bg-muted/10 border border-destructive/20 flex flex-col items-center justify-center gap-3 p-6 text-center`}
                                          style={{ aspectRatio: aspectStyle }}
                                        >
                                          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
                                            <AlertCircle className="w-6 h-6" />
                                          </div>
                                          <div className="text-sm font-medium text-destructive">Failed to extract media</div>
                                          <p className="text-xs text-muted-foreground mb-2">The AI responded with text instead of the expected format.</p>
                                          
                                          <div className="flex gap-2 pointer-events-auto">
                                            <Button 
                                              variant="outline" 
                                              size="sm"
                                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const parentNode = actions.getParentNode(node);
                                                // Delete this faulty node and re-execute parent
                                                actions.handleDeleteNode(node.id).then(() => {
                                                  if (parentNode) actions.handleExecuteNode(parentNode);
                                                });
                                              }}
                                            >
                                              <RefreshCw className="w-3.5 h-3.5 mr-2" />
                                              Retry Generation
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    }
                                  }

                                  // Only for Text (prompt) and Publish types, show the markdown
                                  if (hasStructuredMedia && textContent && !isParentTextAction) {
                                    textContent = textContent.replace(/https?:\/\/[^\s"'<>()]+\.(wav|mp3|ogg|m4a|aac|flac|webm)/gi, '').trim();
                                  }
                                  if (!textContent) return null;
                                  
                                  return (
                                    <div className="text-xs bg-accent/10 border border-accent/20 p-3 rounded-xl text-accent-foreground prose prose-sm dark:prose-invert max-w-none">
                                      <MemoMarkdown text={textContent} />
                                    </div>
                                  );
                                })()}
                              </div>
                              );
                              })()
                            )}
                            
                              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                              {(() => {
                                const parentNode = actions.getParentNode(node);
                                return hasResult ? (
                                <div className="flex gap-2 w-full">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="flex-1"
                                    disabled={
                                      node.status === 'running' || 
                                      node.status === 'pending' || 
                                      node.status === 'failed' || 
                                      (!!(node.settings as any)?.imprenta_mode && !contexts.some(ctx => ctx.target_node_id === node.id)) ||
                                      // Disable if media was intended but failed to extract
                                      ((node.type === 'generate-image' || node.type === 'generate-video' || node.type === 'generate-audio' || (node.settings as any)?.media_type === 'image' || (node.settings as any)?.media_type === 'video' || (node.settings as any)?.media_type === 'audio' ||
                                        (parentNode && (parentNode.type === 'generate-image' || parentNode.type === 'generate-video' || parentNode.type === 'generate-audio' || (parentNode.settings as any)?.media_type === 'image' || (parentNode.settings as any)?.media_type === 'video' || (parentNode.settings as any)?.media_type === 'audio'))) && 
                                       !(!!(node.result as any).outputs || !!(node.result as any).media || !!(node.result as any).images || !!(node.result as any).image || !!(node.result as any).video || !!(node.result as any).audio) &&
                                       !(node.result as any)?.text?.match(/!\[.*?\]\((https?:\/\/[^\s"'<>()]+)\)/) &&
                                       !(node.result as any)?.text?.match(/https?:\/\/[^\s"'<>()]+\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|mkv|mp3|wav|ogg|m4a|aac|flac)/i))
                                    }
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const parentNode = actions.getParentNode(node);
                                      if (parentNode) {
                                        actions.handleExecuteNode(parentNode);
                                      } else {
                                        actions.handleExecuteNode(node); // Fallback: execute current if root
                                      }
                                    }}
                                    title="New Variant"
                                  >
                                    <GitFork className="w-4 h-4 mr-2" /> Variant
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="flex-1"
                                    disabled={
                                      node.status === 'running' || 
                                      node.status === 'pending' || 
                                      node.status === 'failed' ||
                                      ((node.type === 'generate-image' || node.type === 'generate-video' || node.type === 'generate-audio' || (node.settings as any)?.media_type === 'image' || (node.settings as any)?.media_type === 'video' || (node.settings as any)?.media_type === 'audio' ||
                                        (parentNode && (parentNode.type === 'generate-image' || parentNode.type === 'generate-video' || parentNode.type === 'generate-audio' || (parentNode.settings as any)?.media_type === 'image' || (parentNode.settings as any)?.media_type === 'video' || (parentNode.settings as any)?.media_type === 'audio'))) && 
                                       !(!!(node.result as any).outputs || !!(node.result as any).media || !!(node.result as any).images || !!(node.result as any).image || !!(node.result as any).video || !!(node.result as any).audio) &&
                                       !(node.result as any)?.text?.match(/!\[.*?\]\((https?:\/\/[^\s"'<>()]+)\)/) &&
                                       !(node.result as any)?.text?.match(/https?:\/\/[^\s"'<>()]+\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|mkv|mp3|wav|ogg|m4a|aac|flac)/i))
                                    }
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      actions.handleCreateActionFromContext(node.id);
                                    }}
                                    title="New Action"
                                  >
                                    <Plus className="w-4 h-4 mr-2" /> Action
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    disabled={
                                      node.status === 'running' || 
                                      node.status === 'pending' || 
                                      node.status === 'failed' ||
                                      ((node.type === 'generate-image' || node.type === 'generate-video' || node.type === 'generate-audio' || (node.settings as any)?.media_type === 'image' || (node.settings as any)?.media_type === 'video' || (node.settings as any)?.media_type === 'audio' ||
                                        (parentNode && (parentNode.type === 'generate-image' || parentNode.type === 'generate-video' || parentNode.type === 'generate-audio' || (parentNode.settings as any)?.media_type === 'image' || (parentNode.settings as any)?.media_type === 'video' || (parentNode.settings as any)?.media_type === 'audio'))) && 
                                       !(!!(node.result as any).outputs || !!(node.result as any).media || !!(node.result as any).images || !!(node.result as any).image || !!(node.result as any).video || !!(node.result as any).audio) &&
                                       !(node.result as any)?.text?.match(/!\[.*?\]\((https?:\/\/[^\s"'<>()]+)\)/) &&
                                       !(node.result as any)?.text?.match(/https?:\/\/[^\s"'<>()]+\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|mkv|mp3|wav|ogg|m4a|aac|flac)/i))
                                    }
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const res = node.result as any;
                                      let textToCopy = "";
                                      
                                      if (res.outputs && Array.isArray(res.outputs) && res.outputs.length > 0 && (res.outputs[0]?.data?.url || res.outputs[0]?.url)) textToCopy = String(res.outputs[0].data?.url || res.outputs[0].url);
                                      else if (res.media && Array.isArray(res.media) && res.media.length > 0 && res.media[0]?.url) textToCopy = String(res.media[0].url);
                                      else if (res.url) textToCopy = String(res.url);
                                      else if (res.images && res.images.length > 0 && res.images[0]?.url) textToCopy = String(res.images[0].url);
                                      else if (res.image && res.image.url) textToCopy = String(res.image.url);
                                      else if (res.audio && res.audio.url) textToCopy = String(res.audio.url);
                                      else if (res.video && res.video.url) textToCopy = String(res.video.url);
                                      else if (res.text) textToCopy = String(res.text);
                                      else textToCopy = JSON.stringify(res, null, 2);
                                      
                                      try {
                                        await navigator.clipboard.writeText(textToCopy);
                                        toast.success("Copied to clipboard");
                                      } catch (err) {
                                        toast.error("Failed to copy");
                                      }
                                    }}
                                    title="Copy Result"
                                  >
                                    <Copy className="h-4 w-4 mr-2" /> Copy
                                  </Button>
                                  {(() => {
                                      const extractUrl = (text: any): string => {
                                        if (!text) return '';
                                        const str = String(text);
                                        const urlMatch = str.match(/https?:\/\/[^\s"'<>()]+/);
                                        return urlMatch ? urlMatch[0] : str;
                                      };

                                      const res = node.result as any;
                                      let rawAssetUrl = "";
                                      
                                      if (res.outputs && Array.isArray(res.outputs) && res.outputs.length > 0 && (res.outputs[0]?.data?.url || res.outputs[0]?.url)) rawAssetUrl = String(res.outputs[0].data?.url || res.outputs[0].url);
                                      else if (res.media && Array.isArray(res.media) && res.media.length > 0 && res.media[0]?.url) rawAssetUrl = String(res.media[0].url);
                                      else if (res.images && res.images.length > 0 && res.images[0]?.url) rawAssetUrl = String(res.images[0].url);
                                      else if (res.image && res.image.url) rawAssetUrl = String(res.image.url);
                                      else if (res.audio && res.audio.url) rawAssetUrl = String(res.audio.url);
                                      else if (res.video && res.video.url) rawAssetUrl = String(res.video.url);
                                      else if (res.url) rawAssetUrl = String(res.url);

                                      const assetUrl = extractUrl(rawAssetUrl);
                                      const isAssetUrl = assetUrl && (assetUrl.startsWith('http') || assetUrl.startsWith('data:'));

                                      return (
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          className="flex-1"
                                          disabled={
                                            node.status === 'running' || 
                                            node.status === 'pending' || 
                                            node.status === 'failed' ||
                                            ((node.type === 'generate-image' || node.type === 'generate-video' || node.type === 'generate-audio' || (node.settings as any)?.media_type === 'image' || (node.settings as any)?.media_type === 'video' || (node.settings as any)?.media_type === 'audio' ||
                                              (parentNode && (parentNode.type === 'generate-image' || parentNode.type === 'generate-video' || parentNode.type === 'generate-audio' || (parentNode.settings as any)?.media_type === 'image' || (parentNode.settings as any)?.media_type === 'video' || (parentNode.settings as any)?.media_type === 'audio'))) && 
                                             !(!!(node.result as any).outputs || !!(node.result as any).media || !!(node.result as any).images || !!(node.result as any).image || !!(node.result as any).video || !!(node.result as any).audio) &&
                                             !(node.result as any)?.text?.match(/!\[.*?\]\((https?:\/\/[^\s"'<>()]+)\)/) &&
                                             !(node.result as any)?.text?.match(/https?:\/\/[^\s"'<>()]+\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|mkv|mp3|wav|ogg|m4a|aac|flac)/i))
                                          }
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (isAssetUrl) {
                                              try {
                                                const response = await fetch(assetUrl);
                                                const blob = await response.blob();
                                                const blobUrl = window.URL.createObjectURL(blob);
                                                const link = document.createElement('a');
                                                link.href = blobUrl;
                                                link.download = assetUrl.split('/').pop()?.split('?')[0] || `asset-${Date.now()}`;
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                                window.URL.revokeObjectURL(blobUrl);
                                                toast.success("Downloaded");
                                              } catch (err) {
                                                window.open(assetUrl, '_blank');
                                              }
                                            } else {
                                              // Download text result
                                              let textToDownload = "";
                                              if (res.text) textToDownload = String(res.text);
                                              else textToDownload = JSON.stringify(res, null, 2);
                                              
                                              const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
                                              const blobUrl = window.URL.createObjectURL(blob);
                                              const link = document.createElement('a');
                                              link.href = blobUrl;
                                              link.download = `result-${Date.now()}.txt`;
                                              document.body.appendChild(link);
                                              link.click();
                                              document.body.removeChild(link);
                                              window.URL.revokeObjectURL(blobUrl);
                                              toast.success("Downloaded result");
                                            }
                                          }}
                                          title="Download Result"
                                        >
                                          <Download className="w-4 h-4 mr-2" /> Download
                                        </Button>
                                      );
                                  })()}
                                </div>
                              ) : (
                                <div className="flex w-full">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full" 
                                    title="Generate"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      actions.handleExecuteNode(node);
                                    }}
                                  >
                                    <Play className="w-4 h-4 mr-2" /> Generate
                                  </Button>
                                </div>
                              );
                              })()}
                            </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
  )
})

export function ImprentaPanel({ activeInstanceId }: { activeInstanceId?: string }) {
  const { currentSite } = useSite()
  const { isLayoutCollapsed } = useLayout()
  const isMobile = useIsMobile()
  const sidebarWidth = isMobile ? 0 : isLayoutCollapsed ? 64 : 256;
  
  const supabase = createClient()
  const { imprentaData, isLoading: isImprentaLoading } = useImprentaData(
    activeInstanceId,
    currentSite?.id
  )
  const [nodes, setNodes] = useState<InstanceNode[]>([])
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)
  const [initialPrompt, setInitialPrompt] = useState("")
  const [zoomedMedia, setZoomedMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null)
  const imprentaSyncedInstanceRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dummyNodes, setDummyNodes] = useState<InstanceNode[]>([])
  const [generatingNodeIds, setGeneratingNodeIds] = useState<Set<string>>(new Set())

  const [positions, setPositions] = useState<Record<string, {x: number, y: number}>>({})
  /** rAF-batched live position while dragging so edges stay aligned without setPositions every mousemove. */
  const dragStore = useMemo(() => createImprentaDragStore(), [])
  const hoverStore = useMemo(() => createImprentaHoverStore(), [])
  const nodeDragRafRef = useRef<number | null>(null)
  const lastNodeDragPosRef = useRef<{ x: number; y: number } | null>(null)
  const [viewportInfo, setViewportInfo] = useState<ZoomableViewportInfo | null>(null)
  /** External pub/sub for pan/zoom so edges/nodes canvases repaint without React reconcile. */
  const viewportStoreRef = useRef<ViewportStore | null>(null)
  if (viewportStoreRef.current == null) {
    viewportStoreRef.current = createViewportStore()
  }
  const viewportStore = viewportStoreRef.current
  const thumbCache = useMemo(() => getImprentaThumbCache(), [])
  const [layoutEpoch, setLayoutEpoch] = useState(0)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [contexts, setContexts] = useState<any[]>([])
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null)
  /** Drives stronger strokes on context + parent-chain edges while a card is hovered. */

  const [tempConnection, setTempConnection] = useState<{fromNode: string, currentX: number, currentY: number} | null>(null)
  const drawingConnectionRef = useRef<{fromNode: string, mouseStartX: number, mouseStartY: number, nodeStartX: number, nodeStartY: number} | null>(null)

  const draggingNodeRef = useRef<string | null>(null)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const dragStartNodePos = useRef({ x: 0, y: 0 })
  const nodeDragMovedRef = useRef(false)
  const positionsRef = useRef<Record<string, {x: number, y: number}>>({})
  const nodesRef = useRef<InstanceNode[]>([])
  
  const nodeHeightsRef = useRef<Record<string, number>>({})
  const nodeElementsRef = useRef<Record<string, HTMLDivElement>>({})
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const resizeObserverRafRef = useRef<number | null>(null)

  const registerNodeRef = useCallback((nodeId: string, el: HTMLDivElement | null, observeForLayout = true) => {
    if (el) {
      nodeElementsRef.current[nodeId] = el
      if (observeForLayout) resizeObserverRef.current?.observe(el)
    } else {
      const prev = nodeElementsRef.current[nodeId]
      if (prev) {
        try {
          resizeObserverRef.current?.unobserve(prev)
        } catch {
          /* already unobserved */
        }
        delete nodeElementsRef.current[nodeId]
      }
    }
  }, [])

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      let changed = false
      for (const entry of entries) {
        const el = entry.target as HTMLDivElement
        if (el.dataset.imprentaLite === "1") continue
        const nodeId = el.dataset.nodeId
        if (!nodeId) continue
        const h = Math.ceil(entry.contentRect.height)
        if (nodeHeightsRef.current[nodeId] !== h) {
          nodeHeightsRef.current[nodeId] = h
          changed = true
        }
      }
      if (changed) {
        if (resizeObserverRafRef.current != null) return
        resizeObserverRafRef.current = requestAnimationFrame(() => {
          resizeObserverRafRef.current = null
          setLayoutEpoch((e) => e + 1)
          setPositions((prev) =>
            getLayoutPositions(nodesRef.current, prev, nodeHeightsRef.current)
          )
        })
      }
    })
    resizeObserverRef.current = ro
    return () => {
      if (resizeObserverRafRef.current != null) {
        cancelAnimationFrame(resizeObserverRafRef.current)
        resizeObserverRafRef.current = null
      }
      ro.disconnect()
    }
  }, [])

  const canvasNodes = useMemo(() => [...nodes, ...dummyNodes], [nodes, dummyNodes])

  // Keep refs in sync for window event listeners
  positionsRef.current = positions;
  nodesRef.current = canvasNodes;

  const { isDarkMode } = useTheme()

  /**
   * Stable positions map (no drag override). Consumed by the canvas layers so
   * their spatial-grid cache stays valid across per-frame drag updates: the
   * reference only changes on real layout / data events, not when the user is
   * dragging a node.
   */
  const stablePositions = useMemo(() => {
    const r: Record<string, { x: number; y: number }> = {}
    for (const n of canvasNodes) {
      r[n.id] = positions[n.id] || FALLBACK_POS
    }
    return r
  }, [canvasNodes, positions])

  /**
   * DOM-facing positions: same as `stablePositions` plus the live drag preview
   * for the currently-dragged node. Only DOM consumers (card mounting + SVG
   * connection lines) need this, so the canvas grid cache stays stable.
   */
  const resolvedPositions = stablePositions

  const resolveNodePosition = useCallback(
    (nodeId: string): { x: number; y: number } => resolvedPositions[nodeId] || FALLBACK_POS,
    [resolvedPositions]
  )

  const nodeHeightsSnapshot = useMemo(
    () => ({ ...nodeHeightsRef.current }),
    [layoutEpoch, positions]
  )

  const panelGridCacheRef = useRef<GridCacheEntry | null>(null)

  const visibleNodeIds = useMemo(() => {
    if (
      !viewportInfo ||
      canvasNodes.length === 0 ||
      viewportInfo.canvasWidth < 2 ||
      viewportInfo.canvasHeight < 2
    ) {
      return null
    }
    const vw = worldViewportFromCanvas(
      viewportInfo.canvasWidth,
      viewportInfo.canvasHeight,
      viewportInfo.scale,
      viewportInfo.position,
      IMPRENTA_VIEWPORT_CULL_PAD
    )
    // Use stable positions so the visible-id set does not churn while the user
    // drags a node. Drag origin is always kept in DOM via `domRenderNodes`.
    const cached = readCachedIdsAndGrid(
      panelGridCacheRef,
      canvasNodes,
      stablePositions,
      nodeHeightsRef.current,
      IMPRENTA_NODE_W,
      IMPRENTA_ROW_H
    )
    const candidates = collectIdsFromGrid(cached.grid, vw)
    const out = new Set<string>()
    candidates.forEach((id) => {
      const p = stablePositions[id]
      if (!p) return
      const h = nodeHeightsRef.current[id] || IMPRENTA_ROW_H
      const bbox: GraphBBox = {
        minX: p.x,
        minY: p.y,
        maxX: p.x + IMPRENTA_NODE_W,
        maxY: p.y + h,
      }
      if (bboxIntersects(bbox, vw)) out.add(id)
    })
    return out
  }, [canvasNodes, viewportInfo, stablePositions, layoutEpoch])

  /**
   * Commit `viewportInfo` into React state only on "settle" (debounced) or when the
   * quantized viewport rectangle changes by a grid cell. This prevents a re-render of
   * ImprentaPanel (and therefore full-card DOM mount/unmount) on every pan frame.
   * Canvases that need live transform read it directly from `viewportStore`.
   */
  useEffect(() => {
    let debounceId: ReturnType<typeof setTimeout> | null = null
    let lastKey: string | null = null
    const commit = (snap: ViewportSnapshot) => {
      setViewportInfo({
        scale: snap.scale,
        position: { ...snap.position },
        canvasWidth: snap.canvasWidth,
        canvasHeight: snap.canvasHeight,
      })
    }
    const unsub = viewportStore.subscribe((snap) => {
      if (snap.canvasWidth < 2 || snap.canvasHeight < 2) return
      const world = worldViewportFromCanvas(
        snap.canvasWidth,
        snap.canvasHeight,
        snap.scale,
        snap.position,
        IMPRENTA_VIEWPORT_CULL_PAD
      )
      const key = `${quantizeViewport(world)}|${snap.scale >= IMPRENTA_LOD_FULL_DETAIL_SCALE ? "F" : "L"}`
      const crossedBoundary = key !== lastKey
      if (debounceId) clearTimeout(debounceId)
      if (!snap.interacting) {
        lastKey = key
        commit(snap)
        return
      }
      if (crossedBoundary) {
        lastKey = key
        debounceId = setTimeout(() => commit(snap), 0)
      } else {
        debounceId = setTimeout(() => commit(snap), 120)
      }
    })
    return () => {
      unsub()
      if (debounceId) clearTimeout(debounceId)
    }
  }, [viewportStore])

  const parentEdgeStroke = isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)"
  const parentEdgeHoverStroke = isDarkMode ? "rgba(147,197,253,0.92)" : "rgba(37,99,235,0.88)"


  const handleImprentaNodeHover = useCallback((nodeId: string | null) => {
    hoverStore.set(nodeId)
  }, [hoverStore])

  /**
   * Skip the lite canvas layer entirely for small/medium graphs. Canvas rendering
   * is only a win when DOM full-cards would otherwise flood the viewport at far
   * zoom; React virtualization helps but canvas scale determines DOM mounting.
   */
  const showFullNodeDetail =
    !viewportInfo ||
    viewportInfo.scale >= IMPRENTA_LOD_FULL_DETAIL_SCALE
  /** Nodes we keep in DOM (dummies + drag origin + temp-connection origin). Canvas skips them. */
  const domOnlyNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const n of dummyNodes) ids.add(n.id)
    if (draggingNodeId) ids.add(draggingNodeId)
    if (tempConnection?.fromNode) ids.add(tempConnection.fromNode)
    return ids
  }, [dummyNodes, draggingNodeId, tempConnection?.fromNode])

  /**
   * Compute the list of nodes the React tree should actually render as DOM.
   *
   * - Below full-detail zoom: only dummies + drag origin + temp-connection origin.
   *   The `ImprentaNodesCanvas` draws everything else.
   * - At full-detail zoom: every visible node (virtualized via `visibleNodeIds`).
   *
   * Pre-filtering here prevents React from reconciling thousands of `null`s on pan
   * and fixes the O(N) renders that made the canvas feel sluggish at scale.
   */
  const domRenderNodes = useMemo(() => {
    const out: InstanceNode[] = []
    const vis = visibleNodeIds
    const all = canvasNodes
    for (let i = 0; i < all.length; i++) {
      const node = all[i]
      const isDummy = node.id.startsWith("dummy-")
      const hasResult = node.result && Object.keys(node.result as Record<string, unknown>).length > 0
      const isEffectivelyDummy =
        isDummy || (!hasResult && generatingNodeIds.has(node.id) && (node.status === "running" || node.status === "pending"))
      const isDragOrigin = draggingNodeId === node.id || tempConnection?.fromNode === node.id
      if (vis !== null && !vis.has(node.id) && !isDragOrigin) continue
      if (!showFullNodeDetail && !isEffectivelyDummy && !isDragOrigin) continue
      out.push(node)
    }
    return out
  }, [
    canvasNodes,
    visibleNodeIds,
    showFullNodeDetail,
    draggingNodeId,
    tempConnection?.fromNode,
    generatingNodeIds,
  ])

  const canvasGetImages = useCallback(
    (node: InstanceNode) => collectImprentaLiteImagePreviewUrls(node, 4),
    []
  )
  const canvasGetVideos = useCallback(
    (node: InstanceNode) => collectImprentaLiteVideoPreviewUrls(node, 2),
    []
  )

  /**
   * Ids of nodes currently rendered as the "generating" placeholder card
   * (either real `dummy-*` shells or real nodes that are running without a
   * result yet). Used to drive the loading-route edge animation and the
   * spinning border on their action (direct parent).
   */
  const loadingNodeIds = useMemo(() => {
    const set = new Set<string>()
    for (const n of dummyNodes) set.add(n.id)
    for (const n of nodes) {
      if (n.id.startsWith("dummy-")) {
        set.add(n.id)
        continue
      }
      const hasResult =
        n.result && Object.keys(n.result as Record<string, unknown>).length > 0
      if (
        !hasResult &&
        generatingNodeIds.has(n.id) &&
        (n.status === "running" || n.status === "pending")
      ) {
        set.add(n.id)
      }
    }
    return set
  }, [nodes, dummyNodes, generatingNodeIds])

  /**
   * Direct parents of every loading node. Rendered with a rotating conic
   * border so the user can see which "action" is currently producing results.
   * A node that is itself a loading result is excluded — no self-spin.
   */
  const actionNodeIds = useMemo(() => {
    if (loadingNodeIds.size === 0) return new Set<string>()
    const out = new Set<string>()
    for (const n of canvasNodes) {
      if (!loadingNodeIds.has(n.id)) continue
      const parentId = n.parent_node_id
      if (!parentId) continue
      if (loadingNodeIds.has(parentId)) continue
      out.add(parentId)
    }
    return out
  }, [canvasNodes, loadingNodeIds])

  /**
   * Parent→loading-node edge pairs along the full ancestry of every loading
   * node. Lets the SVG overlay animate the *route* (every segment on the way
   * from the root down to the result), not only the last hop.
   */
  const nodesById = useMemo(() => {
    const map = new Map<string, InstanceNode>()
    for (const n of canvasNodes) map.set(n.id, n)
    return map
  }, [canvasNodes])

  const loadingRouteEdges = useMemo<Array<{ parentId: string; childId: string }>>(() => {
    if (loadingNodeIds.size === 0) return []
    const seen = new Set<string>()
    const edges: Array<{ parentId: string; childId: string }> = []
    loadingNodeIds.forEach((startId) => {
      let current = nodesById.get(startId)
      while (current) {
        const parentId = current.parent_node_id
        if (!parentId) break
        const key = `${parentId}->${current.id}`
        if (seen.has(key)) break
        seen.add(key)
        edges.push({ parentId, childId: current.id })
        current = nodesById.get(parentId)
      }
    })
    return edges
  }, [nodesById, loadingNodeIds])

  // Reset ephemeral UI when changing instances
  useEffect(() => {
    imprentaSyncedInstanceRef.current = null
    setInitialPrompt("")
    setNodes([])
    setDummyNodes([])
    setContexts([])
    setPositions({})
    setGeneratingNodeIds(new Set())
    setSelectedContextId(null)
    hoverStore.set(null)
    setZoomedMedia(null)
  }, [activeInstanceId])

  // Media parameters state
  const [selectedMediaType, setSelectedMediaType] = useState<'text' | 'image' | 'video' | 'audio' | 'audience' | 'publish'>('text')
  const [textParams, setTextParams] = useState<any>({ expectedResults: 1, length: 'medium', styles: ['default'] })
  const [imageParams, setImageParams] = useState<ImageParameters>({ format: 'PNG', aspectRatio: '1:1', quality: 100, expectedResults: 1 })
  const [videoParams, setVideoParams] = useState<VideoParameters>({ aspectRatio: '16:9', resolution: '1080p', duration: 4, expectedResults: 1 })
  const [audioParams, setAudioParams] = useState<AudioParameters>({ format: 'MP3', sampleRate: '44.1kHz', channels: 'stereo', duration: 15, expectedResults: 1 })

  // Hydrate local state from SWR cache once per instance (realtime owns updates after that)
  // useLayoutEffect prevents 1-frame flicker where Canvas renders with empty nodes
  useLayoutEffect(() => {
    if (!imprentaData || !activeInstanceId) return
    if (imprentaSyncedInstanceRef.current === activeInstanceId) return

    imprentaSyncedInstanceRef.current = activeInstanceId
    setNodes(imprentaData.nodes)
    setContexts(imprentaData.contexts)
  }, [imprentaData, activeInstanceId])

  // Realtime subscriptions for nodes and contexts
  useEffect(() => {
    if (!activeInstanceId) return

    // Subscribe to realtime updates for nodes
    let nodeBatchBuffer: any[] = []
    let nodeBatchTimeout: NodeJS.Timeout | null = null

    const handleNodePayload = (payload: any) => {
      if (payload.eventType === 'INSERT') {
        const incoming = payload.new as InstanceNode
        const normalized = normalizeImprentaNodeForResultMediaType(incoming)
        const typeChanged = normalized.type !== incoming.type
        const mediaChanged =
          (normalized.settings as any)?.media_type !== (incoming.settings as any)?.media_type
        if (typeChanged || mediaChanged) {
          void supabase
            .from("instance_nodes")
            .update({ type: normalized.type, settings: normalized.settings })
            .eq("id", incoming.id)
        }
        setNodes(prev => {
          if (prev.some(n => n.id === incoming.id)) return prev;
          return [...prev, normalized];
        })
        setDummyNodes(prev => {
          // Find dummies for the same parent
          const dummiesForParent = prev.filter(d => d.parent_node_id === incoming.parent_node_id);
          
          if (dummiesForParent.length > 0) {
            // Get the first dummy that hasn't been replaced yet
            const dummyToReplace = dummiesForParent[0];
            const index = prev.findIndex(d => d.id === dummyToReplace.id);
            
            if (index !== -1) {
              // Pre-assign the dummy's position and height to the new real node
              setPositions(currPositions => {
                if (currPositions[dummyToReplace.id]) {
                  const newPositions = {
                    ...currPositions,
                    [incoming.id]: currPositions[dummyToReplace.id]
                  };
                  
                  if (nodeHeightsRef.current[dummyToReplace.id]) {
                    nodeHeightsRef.current[incoming.id] = nodeHeightsRef.current[dummyToReplace.id];
                  }
                  
                  // Immediately clean up the dummy node's position so it doesn't bump the new node
                  delete (newPositions as any)[dummyToReplace.id];
                  
                  return newPositions;
                }
                return currPositions;
              });
              
              setGeneratingNodeIds(prev => {
                const next = new Set(prev);
                next.add(incoming.id);
                return next;
              });
              
              const copy = [...prev];
              copy.splice(index, 1);
              return copy;
            }
          }
          return prev;
        })
      } else if (payload.eventType === 'UPDATE') {
        const incoming = payload.new as InstanceNode
        const normalized = normalizeImprentaNodeForResultMediaType(incoming)
        const typeChanged = normalized.type !== incoming.type
        const mediaChanged =
          (normalized.settings as any)?.media_type !== (incoming.settings as any)?.media_type
        if (typeChanged || mediaChanged) {
          void supabase
            .from("instance_nodes")
            .update({ type: normalized.type, settings: normalized.settings })
            .eq("id", incoming.id)
        }

        setNodes(prev => prev.map(n => n.id === incoming.id ? normalized : n))
        
        if (incoming.status === 'completed' || incoming.status === 'failed') {
          setGeneratingNodeIds(prev => {
            if (prev.has(incoming.id)) {
              const next = new Set(prev);
              next.delete(incoming.id);
              return next;
            }
            return prev;
          });
        }
        
        // If the executed node fails or completes without a child, we might want to clear dummy children
        if (incoming.status === 'failed' || incoming.status === 'completed') {
          setDummyNodes(prev => {
            const toRemove = prev.filter(d => d.parent_node_id === incoming.id);
            if (toRemove.length > 0) {
              // Also clean up their positions to prevent memory leaks
              setPositions(curr => {
                const copy = { ...curr };
                toRemove.forEach(d => delete copy[d.id]);
                return copy;
              });
              return prev.filter(d => d.parent_node_id !== incoming.id);
            }
            return prev;
          });
        }
      } else if (payload.eventType === 'DELETE') {
        setNodes(prev => prev.filter(n => n.id !== payload.old.id))
      }
    }

    const subscription = supabase
      .channel(`instance_nodes_${activeInstanceId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'instance_nodes',
        filter: `instance_id=eq.${activeInstanceId}`
      }, (payload: any) => {
        nodeBatchBuffer.push(payload)
        if (!nodeBatchTimeout) {
          nodeBatchTimeout = setTimeout(() => {
            nodeBatchTimeout = null
            const batch = nodeBatchBuffer
            nodeBatchBuffer = []
            // Using flushSync is generally not needed in React 18, 
            // setNodes inside timeout is already batched automatically.
            batch.forEach(handleNodePayload)
          }, 100)
        }
      })
      .subscribe()

    // Subscribe to realtime updates for contexts
    let contextTimeout: NodeJS.Timeout | null = null
    const contextSubscription = supabase
      .channel(`instance_node_contexts_${activeInstanceId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'instance_node_contexts'
      }, () => {
        if (contextTimeout) clearTimeout(contextTimeout)
        contextTimeout = setTimeout(async () => {
          // Refetch contexts on any change
          const currentNodes = nodesRef.current.map(n => n.id)
          if (currentNodes.length > 0) {
            const { data } = await supabase.from('instance_node_contexts').select('*').in('target_node_id', currentNodes)
            if (data) setContexts(data)
          }
        }, 500)
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
      contextSubscription.unsubscribe()
    }
  }, [activeInstanceId, supabase])

  const handleExecuteNode = async (node: InstanceNode) => {
    if (node.type === "publish") {
      const err = validatePublishNodeInputs(node, contexts, canvasNodes)
      if (err) {
        toast.error(err)
        return
      }
    }
    toast.info("Executing node...")
    try {
      // Create a dummy placeholder child node visually
      const expectedAmount = Number((node.settings as any)?.parameters?.expectedResults) || 1;
      const currentMediaType = (node.settings as any)?.media_type || (node.type === 'prompt' ? 'text' : node.type.replace('generate-', ''));
      const newDummies = Array.from({ length: expectedAmount }).map((_, i) => ({
        id: `dummy-${Date.now()}-${i}`,
        instance_id: node.instance_id,
        parent_node_id: node.id,
        original_node_id: null,
        parent_instance_log_id: null,
        type: 'Generating...',
        status: 'running',
        prompt: { text: '' },
        settings: {
          media_type: currentMediaType,
          parameters: (node.settings as any)?.parameters
        },
        result: {},
        site_id: node.site_id,
        user_id: node.user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as InstanceNode));
      
      setDummyNodes(prev => [...prev, ...newDummies])

      // 1. Set the current node to running to show visual feedback immediately
      setNodes(prev => prev.map(n => n.id === node.id ? { ...n, status: 'running' as any } : n));
      await supabase
        .from('instance_nodes')
        .update({ status: 'running' })
        .eq('id', node.id)

      const { apiClient } = await import('@/app/services/api-client-service')
      const { getSystemPromptForActivity } = await import('@/app/components/simple-messages-view/utils')
      
      // Prepare context string with media parameters
      const contextObj: any = {
        mediaType: currentMediaType,
        output_type: currentMediaType,
        parameters: { ...((node.settings as any)?.parameters || {}) }
      };

      if (node.type === 'publish') {
        const dest = Array.isArray((node.settings as any)?.publish_destinations)
          ? ((node.settings as any).publish_destinations as string[])
          : []
        contextObj.publish_destinations = dest
        const emailReady = currentSite?.settings?.channels?.email?.status === 'synced'
        const hasEmailDistributionSelection = dest.some(d => d === 'mail' || d === 'newsletter')
        if (emailReady || hasEmailDistributionSelection) {
          contextObj.distributionModes = {
            mail: dest.includes('mail'),
            newsletter: dest.includes('newsletter')
          }
        }
      }

      // Remove expectedResults from context to prevent the LLM from duplicating output internally
      if (contextObj.parameters.expectedResults !== undefined) {
        delete contextObj.parameters.expectedResults;
      }
      
      const systemPrompt = getSystemPromptForActivity(node.type, {
        imageParameters: (node.settings as any)?.parameters,
        videoParameters: (node.settings as any)?.parameters,
        audioParameters: (node.settings as any)?.parameters,
      });

      const requestPayload = {
        message: node.prompt?.text || "Execute node",
        site_id: node.site_id,
        user_id: node.user_id,
        instance_id: node.instance_id,
        instance_node_id: node.id, // Pass the current node ID instead of creating a child
        context: JSON.stringify(contextObj),
        system_prompt: systemPrompt,
        expected_results_amount: (node.settings as any)?.parameters?.expectedResults || 1
      }
      
      const response = await apiClient.post('/api/robots/instance/assistant', requestPayload)
      
      if (!response.success) {
        console.error('API Error Response:', response.error);
        
        // Revert node status on failure
        setNodes(prev => prev.map(n => n.id === node.id ? { ...n, status: 'failed' as any } : n));
        await supabase
          .from('instance_nodes')
          .update({ status: 'failed' })
          .eq('id', node.id)
          
        throw new Error(`Failed to start execution: ${response.error?.message || 'Unknown error'}`);
      }
      
      toast.success("Execution started asynchronously")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to execute node")
    }
  }

  const handleDeleteNode = async (nodeId: string) => {
    // Keep a backup in case the deletion fails
    const previousNodes = [...nodes];
    
    const getNodesToDeleteBottomUp = (rootId: string, currentNodes: InstanceNode[]): InstanceNode[] => {
      const result: InstanceNode[] = [];
      
      const traverse = (id: string) => {
        const children = currentNodes.filter(n => n.parent_node_id === id);
        for (const child of children) {
          traverse(child.id);
        }
        const node = currentNodes.find(n => n.id === id);
        if (node) result.push(node);
      };
      
      traverse(rootId);
      return result;
    };
    
    const nodesToDelete = getNodesToDeleteBottomUp(nodeId, nodes);
    const nodeIdsToDelete = nodesToDelete.map(n => n.id);
    
    if (nodesToDelete.length === 0) return;

    // Optimistic update to remove them from UI immediately
    setNodes(prev => prev.filter(n => !nodeIdsToDelete.includes(n.id)));

    try {
      // First, delete any contexts associated with these nodes to avoid foreign key constraints
      // if they don't have ON DELETE CASCADE
      await supabase
        .from('instance_node_contexts')
        .delete()
        .or(`target_node_id.in.(${nodeIdsToDelete.join(',')}),context_node_id.in.(${nodeIdsToDelete.join(',')})`);

      // Delete the nodes (bottom-up to avoid parent-child foreign key constraints if done sequentially)
      // We do it sequentially to be absolutely safe about FK constraints
      for (const node of nodesToDelete) {
        const { error } = await supabase
          .from('instance_nodes')
          .delete()
          .eq('id', node.id);
        
        if (error) throw error;
      }
      
      // Delete associated asset files if they were uploaded in imprenta mode
      for (const node of nodesToDelete) {
        if ((node.settings as any)?.imprenta_mode) {
          const url = (node.result as any)?.outputs?.[0]?.url;
          if (url) {
            const urlParts = url.split('/');
            const storagePath = urlParts[urlParts.length - 2] + '/' + urlParts[urlParts.length - 1];
            supabase.storage.from('assets').remove([storagePath]).catch((err: any) => {
              console.error("Failed to delete storage asset for node:", node.id, err);
            });
          }
        }
      }

      toast.success(nodesToDelete.length > 1 ? `Deleted node and ${nodesToDelete.length - 1} children` : "Node deleted");
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete node(s)");
      // Restore on failure
      setNodes(previousNodes);
    }
  }

  const cloneImprentaNodeWithType = async (nodeId: string, newType: string) => {
    if (!currentSite || !activeInstanceId) return
    const source = nodesRef.current.find((n) => n.id === nodeId)
    if (!source || !isImprentaWorkflowActionNode(source)) return
    if (!IMPRENTA_MODE_OPTIONS.some((o) => o.type === newType)) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const curPos = positionsRef.current[nodeId] || FALLBACK_POS
    const offset = 48
    const newPos = { x: curPos.x + offset, y: curPos.y + offset }

    let clonedSettings: Record<string, unknown>
    try {
      clonedSettings = JSON.parse(JSON.stringify(source.settings || {})) as Record<string, unknown>
    } catch {
      clonedSettings = { ...(source.settings || {}) } as Record<string, unknown>
    }
    clonedSettings = imprentaSettingsForClonedType(newType, clonedSettings)
    clonedSettings.ui_position = newPos

    let clonedPrompt: Record<string, unknown>
    try {
      clonedPrompt = JSON.parse(JSON.stringify(source.prompt || {})) as Record<string, unknown>
    } catch {
      clonedPrompt = { ...(source.prompt || {}) } as Record<string, unknown>
    }

    const newRow = {
      instance_id: source.instance_id,
      site_id: source.site_id,
      user_id: session.user.id,
      parent_node_id: source.parent_node_id,
      original_node_id: null as string | null,
      parent_instance_log_id: null as string | null,
      type: newType,
      status: "pending" as const,
      prompt: clonedPrompt,
      settings: clonedSettings,
      result: {},
    }

    const modeLabel = IMPRENTA_MODE_OPTIONS.find((o) => o.type === newType)?.label ?? newType

    try {
      const { data: created, error } = await supabase
        .from("instance_nodes")
        .insert(newRow)
        .select("*")
        .single()

      if (error || !created) {
        console.error(error)
        toast.error("Failed to create node")
        return
      }

      const { data: ctxRows, error: ctxLoadError } = await supabase
        .from("instance_node_contexts")
        .select("*")
        .eq("target_node_id", nodeId)

      if (ctxLoadError) {
        console.error(ctxLoadError)
        toast.error("Node created but context links could not be loaded to copy them")
      } else {
        const rows = (ctxRows || []) as Record<string, unknown>[]
        let anyCtxFailed = false
        for (const c of rows) {
          if (!c.context_node_id) continue
          const payload = cloneInstanceNodeContextRowForInsert(
            c,
            created.id,
            currentSite.id,
            session.user.id
          )
          const { error: ctxErr } = await supabase.from("instance_node_contexts").insert(payload)
          if (ctxErr) {
            console.error(ctxErr)
            anyCtxFailed = true
          }
        }
        if (anyCtxFailed) {
          toast.error("Node created but one or more context links failed to copy")
        }
      }

      const mergedIds = nodesRef.current.map((n) => n.id)
      if (!mergedIds.includes(created.id)) mergedIds.push(created.id)
      const { data: ctxRefetch } = await supabase
        .from("instance_node_contexts")
        .select("*")
        .in("target_node_id", mergedIds)
      if (ctxRefetch) setContexts(ctxRefetch)

      const sameType = newType === source.type
      toast.success(sameType ? "Node duplicated" : `New ${modeLabel} node created`)
    } catch (e) {
      console.error(e)
      toast.error("Failed to create node")
    }
  }

  const handleDuplicateNode = async (nodeId: string) => {
    const source = nodesRef.current.find((n) => n.id === nodeId)
    if (!source) return
    await cloneImprentaNodeWithType(nodeId, source.type)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeInstanceId || !currentSite) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    setIsUploadingAsset(true)
    toast.info("Uploading asset...")

    try {
      const { path, error: uploadError } = await uploadAssetFile(file)
      if (uploadError || !path) {
        throw new Error(uploadError || "Error uploading file")
      }

      // Determine media type
      let mediaType = 'text'
      if (file.type.startsWith('image/')) mediaType = 'image'
      else if (file.type.startsWith('video/')) mediaType = 'video'
      else if (file.type.startsWith('audio/')) mediaType = 'audio'

      const snap = viewportStoreRef.current?.get()
      let initialPosition = undefined
      if (snap && snap.canvasWidth > 0 && snap.canvasHeight > 0) {
        initialPosition = {
          x: (snap.canvasWidth / 2 - snap.position.x) / snap.scale - 240,
          y: (snap.canvasHeight / 2 - snap.position.y) / snap.scale - 150,
        }
      }

      const newNode = {
        instance_id: activeInstanceId,
        site_id: currentSite.id,
        user_id: session.user.id,
        parent_node_id: null,
        type: `generate-${mediaType}`,
        status: 'completed',
        prompt: { text: file.name },
        settings: { 
          imprenta_mode: true, 
          imprenta_source: "upload",
          media_type: mediaType,
          ...(initialPosition ? { ui_position: initialPosition } : {})
        },
        result: {
          outputs: [{ url: path, type: mediaType }]
        }
      }

      const { data: newDbNode, error } = await supabase.from('instance_nodes').insert(newNode).select('*').single()
      
      if (error) {
        throw error
      }
      
      if (newDbNode) {
        setNodes(prev => {
          if (prev.some(n => n.id === newDbNode.id)) return prev;
          return [...prev, newDbNode as InstanceNode];
        });
      }
      
      toast.success("Asset uploaded successfully")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Failed to upload asset")
    } finally {
      setIsUploadingAsset(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleCreateChild = async (parentId: string | null = null, promptText: string = "New node prompt") => {
    if (!activeInstanceId || !currentSite) return
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    
    const snap = viewportStoreRef.current?.get()
    let initialPosition = undefined
    if (!parentId && snap && snap.canvasWidth > 0 && snap.canvasHeight > 0) {
      initialPosition = {
        x: (snap.canvasWidth / 2 - snap.position.x) / snap.scale - 240,
        y: (snap.canvasHeight / 2 - snap.position.y) / snap.scale - 150,
      }
    }
    
    // Pass media type and params into settings
    const nodeSettings: any = selectedMediaType === 'text' 
      ? { media_type: 'text', parameters: textParams } 
      : {
          media_type: selectedMediaType,
          parameters: selectedMediaType === 'image' ? imageParams :
                      selectedMediaType === 'video' ? videoParams :
                      selectedMediaType === 'audio' ? audioParams : {}
        };
        
    if (initialPosition) {
      nodeSettings.ui_position = initialPosition
    }
    
    const newNode = {
      instance_id: activeInstanceId,
      site_id: currentSite.id,
      user_id: session.user.id,
      parent_node_id: parentId,
      type: selectedMediaType === 'text' ? 'prompt' : selectedMediaType === 'publish' ? 'publish' : `generate-${selectedMediaType}`,
      status: 'pending',
      prompt: { text: promptText },
      settings: nodeSettings,
      result: {}
    }
    
    const { data, error } = await supabase.from('instance_nodes').insert(newNode).select('*').single()
    if (error) {
      toast.error("Failed to create node")
      console.error(error)
      return null
    } else {
      setNodes(prev => {
        if (prev.some(n => n.id === data.id)) return prev;
        return [...prev, data as InstanceNode];
      });
      toast.success("Node created")
      return data.id
    }
  }

  // Keyboard shortcuts for the toolbar: Shift+N creates a new action, Shift+U
  // opens the file picker. Skipped when a field is focused so typing keeps working.
  useEffect(() => {
    if (!activeInstanceId || nodes.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Let Escape cancel the connection at any time
      if (e.key === "Escape") {
        if (drawingConnectionRef.current) {
          e.preventDefault();
          handleConnectionCancel();
        }
      }

      const t = e.target
      if (t instanceof HTMLElement) {
        const tag = t.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) {
          return
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!e.shiftKey) return
      if (isUploadingAsset) return

      if (e.key === "N" || e.key === "n") {
        e.preventDefault()
        handleCreateChild(null)
      } else if (e.key === "U" || e.key === "u") {
        e.preventDefault()
        fileInputRef.current?.click()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeInstanceId, nodes.length, isUploadingAsset])

  const handleCreateActionFromContext = async (contextNodeId: string) => {
    if (!activeInstanceId || !currentSite) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // 1. Create action node
    const newNode = {
      instance_id: activeInstanceId,
      site_id: currentSite.id,
      user_id: session.user.id,
      parent_node_id: contextNodeId, // visual parent
      type: 'prompt',
      status: 'pending',
      prompt: { text: '' },
      settings: {},
      result: {}
    }
    
    const { data: actionNode, error } = await supabase.from('instance_nodes').insert(newNode).select('*').single()
    if (error || !actionNode) {
      toast.error("Failed to create action node")
      return
    }

    setNodes(prev => {
      if (prev.some(n => n.id === actionNode.id)) return prev;
      return [...prev, actionNode as InstanceNode];
    });

    toast.success("Action node created")
  }

  const handleWindowMouseMove = useCallback((e: MouseEvent) => {
    const nodeId = draggingNodeRef.current
    if (!nodeId) return
    
    if (!nodeDragMovedRef.current) {
      if (Math.abs(e.clientX - dragStartPos.current.x) > 5 || Math.abs(e.clientY - dragStartPos.current.y) > 5) {
        nodeDragMovedRef.current = true
      }
    }
    
    // Prevenir selección de texto durante el drag de la tarjeta
    e.preventDefault()
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges()
    }
    
    let scale = 1
    const snap = viewportStore.get()
    if (snap) {
      scale = snap.scale
    }

    const dx = (e.clientX - dragStartPos.current.x) / scale
    const dy = (e.clientY - dragStartPos.current.y) / scale

    const nx = dragStartNodePos.current.x + dx
    const ny = dragStartNodePos.current.y + dy
    lastNodeDragPosRef.current = { x: nx, y: ny }

    const el = nodeElementsRef.current[nodeId]
    if (el) {
      el.style.transform = `translate3d(${nx}px, ${ny}px, 0)`
    }

    if (nodeDragRafRef.current == null) {
      nodeDragRafRef.current = requestAnimationFrame(() => {
        nodeDragRafRef.current = null
        const id = draggingNodeRef.current
        const last = lastNodeDragPosRef.current
        if (id && last) {
          dragStore.set({ id, x: last.x, y: last.y })
        }
      })
    }
  }, [])

  const handleWindowMouseUp = useCallback(async (e?: MouseEvent | Event) => {
    const nodeId = draggingNodeRef.current
    if (!nodeId) return

    const newPos = lastNodeDragPosRef.current
    if (nodeDragRafRef.current != null) {
      cancelAnimationFrame(nodeDragRafRef.current)
      nodeDragRafRef.current = null
    }

    // Termina el drag inmediatamente antes del await
    draggingNodeRef.current = null
    window.removeEventListener('pointermove', handleWindowMouseMove)
    window.removeEventListener('pointerup', handleWindowMouseUp)

    if (nodeDragMovedRef.current) {
      const suppressClick = (ev: MouseEvent) => {
        ev.stopPropagation()
        ev.preventDefault()
        window.removeEventListener('click', suppressClick, { capture: true })
      }
      window.addEventListener('click', suppressClick, { capture: true })
      setTimeout(() => window.removeEventListener('click', suppressClick, { capture: true }), 0)
    }

    dragStore.set(null)
    setDraggingNodeId(null)
    if (newPos) {
      setPositions((prev) => ({ ...prev, [nodeId]: newPos }))
    }

    const nodeToUpdate = nodesRef.current.find(n => n.id === nodeId)
    if (nodeToUpdate && newPos) {
       const updatedSettings = { ...((nodeToUpdate.settings as any) || {}), ui_position: newPos }
       setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, settings: updatedSettings } : n));
       try {
         await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', nodeId)
       } catch (err) {
         console.error("Failed to update node position", err)
       }
    }
  }, [handleWindowMouseMove])

  const beginNodeDrag = useCallback((nodeId: string, clientX: number, clientY: number) => {
    nodeDragMovedRef.current = false
    draggingNodeRef.current = nodeId
    dragStartPos.current = { x: clientX, y: clientY }
    dragStartNodePos.current = {
      x: positionsRef.current[nodeId]?.x || 0,
      y: positionsRef.current[nodeId]?.y || 0,
    }
    lastNodeDragPosRef.current = {
      x: dragStartNodePos.current.x,
      y: dragStartNodePos.current.y,
    }
    dragStore.set({
      id: nodeId,
      x: dragStartNodePos.current.x,
      y: dragStartNodePos.current.y,
    })
    setDraggingNodeId(nodeId)

    // Ensure we don't attach multiple times if somehow called twice
    window.removeEventListener('pointermove', handleWindowMouseMove)
    window.removeEventListener('pointerup', handleWindowMouseUp)

    window.addEventListener('pointermove', handleWindowMouseMove)
    window.addEventListener('pointerup', handleWindowMouseUp)
  }, [handleWindowMouseMove, handleWindowMouseUp])

  /** Entry point from the lite canvas layer (no React synthetic event is available). */
  const handleCanvasNodePointerDown = useCallback((nodeId: string, ev: PointerEvent) => {
    if (ev.button !== 0) return
    const target = ev.target as HTMLElement
    if (target && (target.closest('button') || target.closest('textarea') || target.closest('input') || target.closest('a') || target.closest('[role="button"]') || target.closest('[role="menuitem"]') || target.closest('[role="menu"]') || target.closest('[role="dialog"]') || target.closest('[role="listbox"]') || target.closest('[role="option"]') || target.closest('[role="combobox"]') || target.closest('[role="tab"]') || target.closest('[role="tabpanel"]'))) {
      return;
    }
    
    ev.stopPropagation()
    ev.preventDefault()
    beginNodeDrag(nodeId, ev.clientX, ev.clientY)
  }, [beginNodeDrag])

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return // Only left click
    const target = e.target as HTMLElement
    // Prevent dragging if clicking on an input/button or an SVG icon inside a button
    if (target.closest('button') || target.closest('textarea') || target.closest('input') || target.closest('a') || target.closest('[role="button"]') || target.closest('[role="menuitem"]') || target.closest('[role="menu"]') || target.closest('[role="dialog"]') || target.closest('[role="listbox"]') || target.closest('[role="option"]') || target.closest('[role="combobox"]') || target.closest('[role="tab"]') || target.closest('[role="tabpanel"]')) {
      return;
    }
    
    e.stopPropagation()
    // Prevenir explícitamente el arrastre nativo de imágenes/elementos
    e.preventDefault();

    beginNodeDrag(nodeId, e.clientX, e.clientY)
  }

  const handleConnectionMove = useCallback((e: MouseEvent) => {
    if (!drawingConnectionRef.current) return;
    
    let scale = 1;
    const snap = viewportStore.get();
    if (snap) {
       scale = snap.scale;
    }
    
    // Instead of forcing layout on contentDiv on every frame, 
    // we can use the position from the viewport snapshot to convert coordinates.
    const canvasEl = document.getElementById('imprenta-canvas-content');
    if (canvasEl && canvasEl.parentElement) {
       const rect = canvasEl.getBoundingClientRect();
       const currentX = (e.clientX - rect.left) / scale;
       const currentY = (e.clientY - rect.top) / scale;
       
       setTempConnection({
         fromNode: drawingConnectionRef.current.fromNode,
         currentX,
         currentY
       });
    }
  }, [viewportStore]);

  const handleConnectionCancel = useCallback(() => {
    drawingConnectionRef.current = null;
    setTempConnection(null);
    window.removeEventListener('mousemove', handleConnectionMove);
  }, [handleConnectionMove]);

  const handleConnectionStart = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Toggle off if clicking the same source knob again
    if (drawingConnectionRef.current && drawingConnectionRef.current.fromNode === nodeId) {
      handleConnectionCancel();
      return;
    }
    
    let scale = 1;
    const contentDiv = document.getElementById('imprenta-canvas-content');
    if (contentDiv && contentDiv.parentElement) {
       const transform = contentDiv.parentElement.style.transform;
       const match = transform.match(/scale\(([^)]+)\)/);
       if (match) scale = parseFloat(match[1]) || 1;
    }
    
    const startPos = positionsRef.current[nodeId] || {x: 0, y: 0};
    const startX = startPos.x + NODE_W;
    const startY = startPos.y + (nodeHeightsRef.current[nodeId] || ROW_H) / 2;

    drawingConnectionRef.current = {
       fromNode: nodeId,
       mouseStartX: e.clientX,
       mouseStartY: e.clientY,
       nodeStartX: startX,
       nodeStartY: startY
    };
    
    setTempConnection({
      fromNode: nodeId,
      currentX: startX,
      currentY: startY
    });
    
    window.addEventListener('mousemove', handleConnectionMove);
    // Removed mouseup and click listeners so connection stays active
  }

  const handleConnectionDrop = async (
    e: React.MouseEvent,
    targetNodeId: string,
    slot?: "content" | "context" | "audience"
  ) => {
    e.stopPropagation();
    if (!drawingConnectionRef.current) return;
    
    const sourceNodeId = drawingConnectionRef.current.fromNode;
    handleConnectionCancel(); // Clean up the connection line first
    
    if (sourceNodeId === targetNodeId) return;

    const targetNode = nodesRef.current.find((n) => n.id === targetNodeId);
    const sourceNode = nodesRef.current.find((n) => n.id === sourceNodeId);
    if (!targetNode || !sourceNode) return;

    let insertType: string | null = null;
    if (targetNode.type === "publish" && slot === "content") {
      if (shouldRouteToPublishAudienceSlot(sourceNode, nodesRef.current)) {
        toast.error("Use the Audience input for Audience nodes and their downstream actions.");
        return;
      }
      insertType = PUBLISH_SLOT_CONTENT;
    } else if (targetNode.type === "publish" && slot === "context") {
      if (shouldRouteToPublishAudienceSlot(sourceNode, nodesRef.current)) {
        toast.error("Use the Audience input for Audience nodes and their downstream actions.");
        return;
      }
      insertType = PUBLISH_SLOT_REFERENCE;
    } else if (targetNode.type === "publish" && slot === "audience") {
      if (!isPublishAudienceSourceReady(sourceNode, nodesRef.current)) {
        toast.error("Link from an Audience node or from a node whose parent is an Audience node.");
        return;
      }
      insertType = PUBLISH_SLOT_AUDIENCE;
    } else if (targetNode.type === "publish") {
      toast.error("Use the Content, Context, or Audience inputs on the left.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !currentSite) return;

    try {
      if (insertType === PUBLISH_SLOT_CONTENT) {
        const stale = contexts.filter(
          (c) =>
            c.target_node_id === targetNodeId &&
            c.type === PUBLISH_SLOT_CONTENT
        );
        for (const row of stale) {
          await supabase.from("instance_node_contexts").delete().eq("id", row.id);
        }
        if (stale.length) {
          setContexts((prev) => prev.filter((c) => !stale.some((s) => s.id === c.id)));
        }
      } else if (insertType === PUBLISH_SLOT_REFERENCE) {
        const stale = contexts.filter(
          (c) =>
            c.target_node_id === targetNodeId &&
            isNormalPublishContextType(c.type)
        );
        for (const row of stale) {
          await supabase.from("instance_node_contexts").delete().eq("id", row.id);
        }
        if (stale.length) {
          setContexts((prev) => prev.filter((c) => !stale.some((s) => s.id === c.id)));
        }
      } else if (insertType === PUBLISH_SLOT_AUDIENCE) {
        const stale = contexts.filter(
          (c) => c.target_node_id === targetNodeId && c.type === PUBLISH_SLOT_AUDIENCE
        );
        for (const row of stale) {
          await supabase.from("instance_node_contexts").delete().eq("id", row.id);
        }
        if (stale.length) {
          setContexts((prev) => prev.filter((c) => !stale.some((s) => s.id === c.id)));
        }
      }

      const { error } = await supabase.from("instance_node_contexts").insert({
            target_node_id: targetNodeId,
            context_node_id: sourceNodeId,
            site_id: currentSite.id,
        user_id: session.user.id,
        ...(insertType ? { type: insertType } : {}),
          });
          
          if (error) {
        if (error.code === "23505") toast.error("Context already linked");
            else toast.error("Failed to link context");
          } else {
            toast.success("Context linked!");
        const currentNodeIds = nodesRef.current.map((n) => n.id);
        const { data } = await supabase
          .from("instance_node_contexts")
          .select("*")
          .in("target_node_id", currentNodeIds);
            if (data) setContexts(data);
          }
    } catch (err) {
      console.error(err);
      toast.error("Failed to link context");
        }
  };

  const handleDeleteContext = async (contextId: string) => {
    try {
      const { error } = await supabase
        .from('instance_node_contexts')
        .delete()
        .eq('id', contextId);
      
      if (error) throw error;
      
      toast.success("Connection deleted");
      setContexts(prev => prev.filter(c => c.id !== contextId));
      if (selectedContextId === contextId) {
        setSelectedContextId(null);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete connection");
    }
  }

  const handleUpdateContextType = async (contextId: string, type: string) => {
    try {
      setContexts(prev => prev.map(c => c.id === contextId ? { ...c, type } : c));
      const { error } = await supabase
        .from('instance_node_contexts')
        .update({ type })
        .eq('id', contextId);
        
      if (error) throw error;
      
      toast.success("Connection type updated");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update connection type");
      // Refetch contexts on failure to revert
      const currentNodes = nodesRef.current.map(n => n.id)
      if (currentNodes.length > 0) {
        const { data } = await supabase.from('instance_node_contexts').select('*').in('target_node_id', currentNodes)
        if (data) setContexts(data)
      }
    }
  }

  const renderMediaWithZoom = (url: string, type: 'image' | 'video', key: React.Key) => (
    <div key={key} className="relative group w-full h-full flex items-center justify-center">
      {type === 'image' ? (
        <ImprentaLazyCardImage
          url={url}
          alt="Generated media"
          onOpen={() => setZoomedMedia({ url, type: "image" })}
        />
      ) : (
        <div 
          className="relative w-full overflow-hidden rounded-xl bg-black/10 flex items-center justify-center cursor-pointer group/video"
          onClick={(e) => { e.stopPropagation(); setZoomedMedia({ url, type }); }}
        >
          <ImprentaLazyPreviewVideo url={url} priority={true} className="w-full h-auto max-h-[800px] object-contain relative z-[1] m-auto" />
          <div className="absolute inset-0 bg-black/10 group-hover/video:bg-black/30 transition-colors z-[2] flex items-center justify-center pointer-events-none">
            <div className="bg-background/80 backdrop-blur text-foreground w-12 h-12 flex items-center justify-center rounded-full shadow-lg transform group-hover/video:scale-110 transition-transform">
              <Play className="h-6 w-6 translate-x-[2px]" />
            </div>
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white border-0"
            onClick={(e) => { e.stopPropagation(); setZoomedMedia({ url, type }); }}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      )}
      {type === 'image' && (
        <div 
          className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl pointer-events-none flex items-center justify-center opacity-0 group-hover:opacity-100"
        >
          <div className="bg-black/50 text-white p-2 rounded-full backdrop-blur-sm shadow-sm">
            <ZoomIn className="h-5 w-5" />
          </div>
        </div>
      )}
    </div>
  )

  const NODE_W = IMPRENTA_NODE_W
  const H_GAP = 80
  const V_GAP = 40
  const ROW_H = IMPRENTA_ROW_H
  const PAD_X = 100 + sidebarWidth
  /** TopBar (64px) + StickyHeader min (71px); inverse of chat empty-state top inset so the root node sits in the visible band */
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
    contexts.forEach((c: any) => {
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
        for (let pass = 0; pass < 10; pass++) {
          let changed = false
          
          // Group orphans by their computed anchor position to avoid overlaps
          const anchoredPositions = new Map<string, typeof orphansWithCtx>();
          const nodeAnchors = new Map<string, {x: number, y: number, avgCenter: number}>();
          
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
            const hasUserPos0 = firstNode && !firstNode.id.startsWith('dummy-') && (firstNode.settings as any)?.ui_position;
            
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
          
          for (let i = 1; i < sorted.length; i++) {
            const prevNodeId = sorted[i - 1].id;
            const currNodeId = sorted[i].id;
            
            const prevBottom = pos[prevNodeId].y + h(prevNodeId)
            const currNode = currentNodes.find(n => n.id === currNodeId);
            const hasUserPos = currNode && !currNode.id.startsWith('dummy-') && (currNode.settings as any)?.ui_position;
            
            const prevNodeX = pos[prevNodeId].x;
            const currNodeX = pos[currNodeId].x;
            const xOverlap = Math.abs(currNodeX - prevNodeX) < NODE_W + H_GAP / 2;
            
            if (pos[currNodeId].y < prevBottom && !hasUserPos && xOverlap) {
              // Only bump if they are actually colliding, but ignore exact same Y overlaps 
              // if it's a dummy vs real node, since that indicates a replacement in progress
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

  // Initialize positions whenever nodes change
  useEffect(() => {
    setPositions(prev => {
      const allNodes = [...nodes, ...dummyNodes]
      const nodeIds = new Set(allNodes.map(n => n.id))
      const cleaned = Object.fromEntries(
        Object.entries(prev).filter(([id]) => nodeIds.has(id))
      )
      
      let updatedWithDb = false;
      allNodes.forEach(n => {
        if (!n.id.startsWith('dummy-') && (n.settings as any)?.ui_position) {
          const dbPos = (n.settings as any).ui_position;
          if (
            typeof dbPos?.x !== 'number' ||
            typeof dbPos?.y !== 'number' ||
            isNaN(dbPos.x) ||
            isNaN(dbPos.y)
          ) {
            return
          }
          // Backend often persists a copy of the parent's settings on new children; that puts
          // ui_position on the child equal to the parent and overwrites the dummy handoff layout.
          if (n.parent_node_id) {
            const parentNode = allNodes.find(p => p.id === n.parent_node_id)
            const parentDb = parentNode && (parentNode.settings as any)?.ui_position
            const parentClean = cleaned[n.parent_node_id]
            const overlapsParent =
              (parentDb &&
                typeof parentDb.x === 'number' &&
                typeof parentDb.y === 'number' &&
                positionsNearlyEqual(dbPos, parentDb)) ||
              (parentClean && positionsNearlyEqual(dbPos, parentClean))
            if (overlapsParent) {
              return
            }
          }
          if (!cleaned[n.id] || cleaned[n.id].x !== dbPos.x || cleaned[n.id].y !== dbPos.y) {
            // Avoid overwriting if we are currently dragging this node
            if (draggingNodeRef.current !== n.id) {
              cleaned[n.id] = dbPos;
              updatedWithDb = true;
            }
          }
        }
      });
      
      const hasMissing = allNodes.some(n => !cleaned[n.id])
      const hasStale = Object.keys(cleaned).length !== Object.keys(prev).length
      
      if (hasMissing || hasStale || updatedWithDb) {
        return getLayoutPositions(allNodes, cleaned, nodeHeightsRef.current)
      }
      return cleaned
    })
  }, [nodes, dummyNodes])


  const maxBounds = useMemo(() => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let hasNodes = false

    Object.entries(positions).forEach(([id, pos]) => {
      if (typeof pos.x !== 'number' || typeof pos.y !== 'number' || isNaN(pos.x) || isNaN(pos.y)) return

      hasNodes = true
      const nh = (nodeHeightsRef.current[id] || ROW_H)
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + NODE_W)
      maxY = Math.max(maxY, pos.y + nh)
    })

    if (!hasNodes) {
      return { width: 800, height: 600, offsetX: 0, offsetY: 0 }
    }

    return {
      width: Math.max(maxX - minX + 100, 320),
      height: Math.max(maxY - minY + 100, 320),
      offsetX: minX - 50,
      offsetY: minY - 50,
    }
  }, [positions])

  const actionsRef = useRef({
    handleNodeMouseDown,
    handleDeleteNode,
    handleDuplicateNode,
    handleConnectionDrop,
    handleConnectionStart,
    handleExecuteNode,
    setNodes,
    setZoomedMedia,
    handleImprentaNodeHover,
    isImprentaWorkflowActionNode,
    handleCreateActionFromContext,
    getParentNode: (node: InstanceNode) => node.parent_node_id ? nodes.find(n => n.id === node.parent_node_id) : undefined
  })

  useEffect(() => {
    actionsRef.current = {
      handleNodeMouseDown,
      handleDeleteNode,
      handleDuplicateNode,
      handleConnectionDrop,
      handleConnectionStart,
      handleExecuteNode,
      setNodes,
      setZoomedMedia,
      handleImprentaNodeHover,
      isImprentaWorkflowActionNode,
      handleCreateActionFromContext,
      getParentNode: (node: InstanceNode) => node.parent_node_id ? nodes.find(n => n.id === node.parent_node_id) : undefined
    }
  })

  return (
    <div 
      className="h-full min-h-0 flex flex-col transition-[margin-left,width] duration-300 ease-out relative"
      style={{
        marginLeft: `-${sidebarWidth}px`,
        width: `calc(100% + ${sidebarWidth}px)`
      }}
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {!activeInstanceId || isImprentaLoading ? (
          <ImprentaSkeleton />
        ) : (
          <div
            className="flex-1 min-h-0 overflow-hidden relative flex flex-col z-0"
            onClick={() => setSelectedContextId(null)}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*,video/*,audio/*,text/plain,application/pdf"
            />
            <ZoomableCanvas 
          className="w-full min-h-0 flex-1"
          height="100%"
          minHeight="100%"
          dotSize="20px" 
          dotColorLight="rgba(0, 0, 0, 0.2)" 
          dotColorDark="rgba(255, 255, 255, 0.2)"
          fitOnChildrenChange={false}
          initialOffsetY={0}
          enableWheelPan={true}
          viewportStore={viewportStore}
          graphBounds={maxBounds}
          screenSpaceBehind={
            <ImprentaParentEdgesCanvas
              nodes={canvasNodes}
              positions={stablePositions}
              dragStore={dragStore}
              nodeHeights={nodeHeightsSnapshot}
              nodeW={NODE_W}
              rowH={ROW_H}
              strokeStyle={parentEdgeStroke}
              hoverStore={hoverStore}
              hoverChainStroke={parentEdgeHoverStroke}
              viewportStore={viewportStore}
              // On small graphs we keep full bezier edges at every zoom; the
              // straight-line LOD only pays off when many edges fit on screen.
              straightLinesBelowScale={IMPRENTA_LOD_FULL_DETAIL_SCALE}
              markerMax={IMPRENTA_LOD_LITE_MARKER_MAX}
            />
          }
          screenSpaceFront={
            <ImprentaNodesCanvas
              nodes={canvasNodes}
              positions={stablePositions}
              heights={nodeHeightsSnapshot}
              nodeW={NODE_W}
              rowH={ROW_H}
              // Effectively disable the lite canvas for small graphs by giving
              // it an unreachable threshold — it stays mounted (no layer
              // thrash on count crossings) but bails out of every paint and
              // hit test, so DOM cards render at every zoom.
              fullDetailScale={IMPRENTA_LOD_FULL_DETAIL_SCALE}
              liteMarkerMax={IMPRENTA_LOD_LITE_MARKER_MAX}
              liteMicroMax={IMPRENTA_LOD_LITE_MICRO_MAX}
              liteSimpleMax={IMPRENTA_LOD_LITE_SIMPLE_MAX}
              viewportStore={viewportStore}
              thumbs={thumbCache}
              isDarkMode={isDarkMode}
              skipIds={domOnlyNodeIds}
              getImageUrls={canvasGetImages}
              getVideoUrls={canvasGetVideos}
              onNodePointerDown={handleCanvasNodePointerDown}
              pointerEventsEnabled={tempConnection == null && draggingNodeId == null}
            />
          }
          onSort={() => {
            toast.info("Organizing layout...");
            const allNodes = [...nodes, ...dummyNodes];
            const newPositions = getLayoutPositions(allNodes, {}, nodeHeightsRef.current);
            setPositions(newPositions);
            
            // Optimistically update nodes state
            setNodes(prev => prev.map(n => {
              const pos = newPositions[n.id];
              if (pos) {
                return { ...n, settings: { ...((n.settings as any) || {}), ui_position: pos } };
              }
              return n;
            }));

            // Persist to DB in background
            const updates = nodes.map(n => {
              const pos = newPositions[n.id];
              if (pos) {
                const updatedSettings = { ...((n.settings as any) || {}), ui_position: pos };
                return supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', n.id);
              }
              return null;
            }).filter(Boolean);
            
            Promise.all(updates)
              .then(() => toast.success("Layout saved"))
              .catch(console.error);
          }}
          extraControls={
            activeInstanceId && nodes.length > 0 ? (
              <TooltipProvider delayDuration={200}>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs font-medium px-2.5"
                        onClick={() => handleCreateChild(null)}
                        disabled={isUploadingAsset}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> New action
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      <span className="flex items-center gap-2">
                        New action
                        <kbd className="pointer-events-none rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">Shift N</kbd>
                      </span>
                    </TooltipContent>
                  </Tooltip>
                  <div className="w-px h-4 bg-border mx-1"></div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs font-medium px-2.5"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAsset}
                      >
                        <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> {isUploadingAsset ? "Uploading..." : "New file"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      <span className="flex items-center gap-2">
                        Upload file
                        <kbd className="pointer-events-none rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">Shift U</kbd>
                      </span>
                    </TooltipContent>
                  </Tooltip>
                  {tempConnection && (
                    <>
                      <div className="w-px h-4 bg-border mx-1"></div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 text-xs font-medium px-2.5"
                            onClick={handleConnectionCancel}
                          >
                            <X className="w-3.5 h-3.5 mr-1.5" /> Cancel connection
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6}>
                          <span className="flex items-center gap-2">
                            Stop connecting node
                            <kbd className="pointer-events-none rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">ESC</kbd>
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              </TooltipProvider>
            ) : null
          }
        >
            <div 
              id="imprenta-canvas-content" 
              className="relative"
              onClick={() => setSelectedContextId(null)}
            >
                  {/* Parent edges are drawn by the viewport-sized canvas mounted in screenSpaceBehind. */}

                  {/* Context edges: single SVG for all paths; labels/UI stay in per-context overlays. */}
                  <ImprentaContextEdges
                    contexts={contexts}
                    nodesRef={nodesRef}
                    positions={positions}
                    nodeHeightsRef={nodeHeightsRef}
                    selectedContextId={selectedContextId}
                    setSelectedContextId={setSelectedContextId}
                    hoverStore={hoverStore}
                    visibleNodeIds={visibleNodeIds}
                  />

                  {contexts.filter(ctx => !visibleNodeIds || visibleNodeIds.has(ctx.context_node_id) || visibleNodeIds.has(ctx.target_node_id)).map((ctx) => {
                    if (!positions[ctx.context_node_id] || !positions[ctx.target_node_id]) return null
                    const start = resolveNodePosition(ctx.context_node_id)
                    const end = resolveNodePosition(ctx.target_node_id)
                    const startCy = (nodeHeightsRef.current[ctx.context_node_id] || ROW_H) / 2
                    const targetNodeForCtx = nodesById.get(ctx.target_node_id)
                    const endH = nodeHeightsRef.current[ctx.target_node_id] || ROW_H
                    const endCy = getPublishContextAnchorY(targetNodeForCtx?.type, ctx.type, endH)
                    const startX = start.x + NODE_W
                    const startY = start.y + startCy
                    const endX = end.x
                    const endY = end.y + endCy
                    const midX = (startX + endX) / 2
                    const midY = (startY + endY) / 2
                    const isSelected = selectedContextId === ctx.id
                    // Context links feeding a node that already produced a result are
                    // locked: the action has run, so unlinking its inputs would rewrite
                    // history. Only links to actions (no result yet) are deletable.
                    const targetHasResult = !!targetNodeForCtx && imprentaNodeHasResult(targetNodeForCtx)

                    return (
                      <div
                        key={`ctx-wrapper-${ctx.id}`}
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                        style={{ zIndex: isSelected ? 30 : 0 }}
                      >
                        {!isSelected && (ctx.type != null || targetNodeForCtx?.type === "publish") && (
                          <div
                            className="absolute px-2 py-0.5 bg-background border border-primary/20 text-primary text-[10px] font-medium rounded-full shadow-sm pointer-events-auto cursor-pointer whitespace-nowrap"
                            style={{
                              left: midX,
                              top: midY,
                              transform: "translate(-50%, -50%)",
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedContextId(ctx.id)
                            }}
                          >
                            {getPublishContextEdgeCaption(targetNodeForCtx?.type, ctx.type)}
                          </div>
                        )}

                        {isSelected && (
                          <Card
                            className="absolute pointer-events-auto shadow-xl border-primary/30 z-50 flex items-center gap-1 p-1"
                            style={{
                              left: midX,
                              top: midY,
                              transform: "translate(-50%, -50%)",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ImprentaContextTypeSelect
                              value={ctx.type || "reference"}
                              onValueChange={(val) => handleUpdateContextType(ctx.id, val)}
                            />

                            {!targetHasResult && (
                              <>
                                <div className="w-px h-4 bg-border mx-1" />

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteContext(ctx.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </Card>
                        )}
                      </div>
                    )
                  })}

                  {/* Draw temp dragging connection */}
                  {tempConnection && positions[tempConnection.fromNode] && (() => {
                    const fromPos = resolveNodePosition(tempConnection.fromNode)
                    const fromCy = (nodeHeightsRef.current[tempConnection.fromNode] || ROW_H) / 2
                    return (
                      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 50, overflow: 'visible' }} shapeRendering="optimizeSpeed">
                        <path
                          d={`M ${fromPos.x + NODE_W} ${fromPos.y + fromCy} C ${fromPos.x + NODE_W + 50} ${fromPos.y + fromCy}, ${tempConnection.currentX - 50} ${tempConnection.currentY}, ${tempConnection.currentX} ${tempConnection.currentY}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-primary"
                        />
                      </svg>
                    )
                  })()}
                  
                  {/* Draw nodes (virtualized + LOD when graph is large). */}
                  <TooltipProvider delayDuration={200}>
                  {domRenderNodes.map(node => {
                    const pos = resolvedPositions[node.id] || FALLBACK_POS
                    const isDummy = node.id.startsWith('dummy-');
                    const hasResult = node.result && Object.keys(node.result).length > 0;
                    const isEffectivelyDummy = isDummy || (!hasResult && generatingNodeIds.has(node.id) && (node.status === 'running' || node.status === 'pending'));
                    
                    if (isEffectivelyDummy) {
                      /** Below full-detail zoom, strip expensive composites from the dummy card (animate-pulse gradient, etc). */
                      const liteDummy = !showFullNodeDetail
                      
                      const mediaTypeForDummy = (node.settings as any)?.media_type || node.type.replace('generate-', '')
                      const isMediaDummy = mediaTypeForDummy === 'image' || mediaTypeForDummy === 'video' || mediaTypeForDummy === 'audio'
                      const isVideoDummy = mediaTypeForDummy === 'video'
                      
                      // Calculate the appropriate aspect ratio from node parameters
                      const aspectRatioParam = (node.settings as any)?.parameters?.aspectRatio
                      let aspectStyle = "1/1"
                      if (isVideoDummy) aspectStyle = "16/9"
                      
                      if (aspectRatioParam) {
                        if (aspectRatioParam === "16:9") aspectStyle = "16/9"
                        else if (aspectRatioParam === "9:16") aspectStyle = "9/16"
                        else if (aspectRatioParam === "4:3") aspectStyle = "4/3"
                        else if (aspectRatioParam === "3:4") aspectStyle = "3/4"
                        else if (aspectRatioParam === "1:1") aspectStyle = "1/1"
                        else aspectStyle = String(aspectRatioParam).replace(':', '/')
                      }

                      return (
                        <ImprentaDummyCardInner
                          key={node.id}
                          node={node}
                          pos={pos}
                          draggingNodeId={draggingNodeId}
                          liteDummy={liteDummy}
                          registerNodeRef={registerNodeRef}
                          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                        />
                      )
                    }

                    if (!showFullNodeDetail) {
                      const measured = nodeHeightsSnapshot[node.id]
                      const estimated = estimateImprentaNodeContentHeight(node, ROW_H)
                      const shellH = Math.round(
                        measured != null && measured >= ROW_H * 0.75
                          ? measured
                          : Math.max(measured ?? 0, estimated, ROW_H)
                      )
                      return (
                        <ImprentaLiteGraphNode
                          key={node.id}
                          node={node}
                          pos={pos}
                          width={NODE_W}
                          height={shellH}
                          zoomScale={viewportInfo?.scale ?? (IMPRENTA_LOD_LITE_MICRO_MAX + IMPRENTA_LOD_LITE_SIMPLE_MAX) / 2}
                          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                          registerRef={(el) => registerNodeRef(node.id, el, false)}
                          onHoverChange={handleImprentaNodeHover}
                        />
                      )
                    }

                    return (
                      <ImprentaNodeCardInner
                        key={node.id}
                        node={node}
                        pos={pos}
                        draggingNodeId={draggingNodeId}
                        hasResult={hasResult}
                        actionRunning={actionNodeIds.has(node.id)}
                        hasCnt={
                           node.type === "publish" 
                             ? hasPublishContentInput(contexts, node.id, [...nodes, ...dummyNodes]) 
                             : false
                        }
                        hasAud={
                           node.type === "publish" 
                             ? hasPublishAudienceInput(contexts, node.id, [...nodes, ...dummyNodes]) 
                             : false
                        }
                        needAudience={
                           node.type === "publish" 
                             ? destinationsRequireAudience(Array.isArray((node.settings as any)?.publish_destinations) ? (node.settings as any).publish_destinations as string[] : []) 
                             : false
                        }
                        registerNodeRef={registerNodeRef}
                        nodes={nodes}
                        dummyNodes={dummyNodes}
                        contexts={contexts}
                        supabase={supabase}
                        generatingNodeIds={generatingNodeIds}
                        currentSite={currentSite}
                        textParams={textParams}
                        imageParams={imageParams}
                        videoParams={videoParams}
                        audioParams={audioParams}
                        renderMediaWithZoom={renderMediaWithZoom}
                        actions={actionsRef.current}
                      />
                    )
                  })}
                  </TooltipProvider>

                  {/* Loading-route edges: same geometry as the graph above, but must render *above*
                      node cards (z-10). Otherwise only segments in empty gutter (often action→result)
                      are visible; parent→action was drawn under cards. */}
                  {loadingRouteEdges.length > 0 && (
                    <svg
                      className="absolute top-0 left-0 w-full h-full pointer-events-none"
                      style={{ zIndex: 12, overflow: "visible" }}
                    >
                      {loadingRouteEdges.map(({ parentId, childId }) => {
                        if (visibleNodeIds && !visibleNodeIds.has(parentId) && !visibleNodeIds.has(childId)) return null
                        if (!positions[parentId] || !positions[childId]) return null
                        const start = resolveNodePosition(parentId)
                        const end = resolveNodePosition(childId)
                        const startCy = (nodeHeightsRef.current[parentId] || ROW_H) / 2
                        const endCy = (nodeHeightsRef.current[childId] || ROW_H) / 2
                        const x1 = start.x + NODE_W
                        const y1 = start.y + startCy
                        const x2 = end.x
                        const y2 = end.y + endCy
                        const d = `M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`
                        return (
                          <path
                            key={`loading-edge-${parentId}-${childId}`}
                            d={d}
                            className="imprenta-loading-edge"
                          />
                        )
                      })}
                    </svg>
                  )}
            </div>
            </ZoomableCanvas>
          </div>
        )}
      </div>
      {zoomedMedia && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setZoomedMedia(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex justify-center items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute -top-12 right-0 text-white hover:bg-white/20"
              onClick={() => setZoomedMedia(null)}
            >
              <X className="w-6 h-6" />
            </Button>
            {zoomedMedia.type === 'image' && <img src={zoomedMedia.url} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />}
            {zoomedMedia.type === 'video' && <video src={zoomedMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
"use client"

import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLayout } from "@/app/context/LayoutContext"
import { useTheme } from "@/app/context/ThemeContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { createClient } from "@/lib/supabase/client"
import { ZoomableCanvas, type ZoomableViewportInfo } from "./zoomable-canvas"
import { ImprentaParentEdgesCanvas } from "./imprenta-parent-edges-canvas"
import { ImprentaNodesCanvas } from "./imprenta-nodes-canvas"
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

/** Match layout constants in ImprentaPanel (NODE_W / ROW_H). */
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
const IMPRENTA_LOD_LITE_MIN_NODES = 400
/**
 * Within lite shells only (scale < IMPRENTA_LOD_FULL_DETAIL_SCALE):
 * - micro: minimal chrome + optional tiny preview
 * - simple: compact type layout + one small preview when images exist
 * - rich: full lite skeleton + larger previews / extra thumbs
 *
 * ZoomableCanvas clamps user zoom to min 0.3 (wheel / buttons / pinch). Initial
 * "fit" can be below that; thresholds must sit inside (~0.3 … full) so all
 * three bands are reachable while zooming.
 */
const IMPRENTA_LOD_LITE_MICRO_MAX = 0.32
const IMPRENTA_LOD_LITE_SIMPLE_MAX = 0.36

type ImprentaLiteSkeletonBand = "micro" | "simple" | "rich"

type LoadingRouteEdge = { parentId: string; childId: string }

function imprentaLiteSkeletonBand(scale: number): ImprentaLiteSkeletonBand {
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
    }
  }
  if (urls.length < max) {
    const media = res.media as unknown[] | undefined
    if (Array.isArray(media)) {
      for (const m of media) {
        if (!m || typeof m !== "object") continue
        const item = m as Record<string, unknown>
        if (item.type === "image" && item.url) push(item.url)
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
      style={{ left: pos.x, top: pos.y, width, height: h }}
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

export function ImprentaPanel({ activeInstanceId }: { activeInstanceId?: string }) {
  const { currentSite } = useSite()
  const { isLayoutCollapsed } = useLayout()
  const isMobile = useIsMobile()
  const sidebarWidth = isMobile ? 0 : isLayoutCollapsed ? 64 : 256;
  
  const supabase = createClient()
  const [nodes, setNodes] = useState<InstanceNode[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)
  const [initialPrompt, setInitialPrompt] = useState("")
  const [zoomedMedia, setZoomedMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null)
  /** Prevents duplicate root inserts when parallel fetches both see an empty table before the first insert is visible. */
  const rootCreationPendingRef = useRef<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dummyNodes, setDummyNodes] = useState<InstanceNode[]>([])
  const [generatingNodeIds, setGeneratingNodeIds] = useState<Set<string>>(new Set())

  const [positions, setPositions] = useState<Record<string, {x: number, y: number}>>({})
  /** rAF-batched live position while dragging so edges stay aligned without setPositions every mousemove. */
  const [nodeDragPreview, setNodeDragPreview] = useState<{ id: string; x: number; y: number } | null>(null)
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
  const [imprentaHoveredNodeId, setImprentaHoveredNodeId] = useState<string | null>(null)

  const [tempConnection, setTempConnection] = useState<{fromNode: string, currentX: number, currentY: number} | null>(null)
  const drawingConnectionRef = useRef<{fromNode: string, mouseStartX: number, mouseStartY: number, nodeStartX: number, nodeStartY: number} | null>(null)

  const draggingNodeRef = useRef<string | null>(null)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const dragStartNodePos = useRef({ x: 0, y: 0 })
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

  // Keep refs in sync for window event listeners
  positionsRef.current = positions;
  nodesRef.current = [...nodes, ...dummyNodes];

  const { isDarkMode } = useTheme()

  /**
   * Stable positions map (no drag override). Consumed by the canvas layers so
   * their spatial-grid cache stays valid across per-frame drag updates: the
   * reference only changes on real layout / data events, not when the user is
   * dragging a node.
   */
  const stablePositions = useMemo(() => {
    const r: Record<string, { x: number; y: number }> = {}
    for (const n of [...nodes, ...dummyNodes]) {
      r[n.id] = positions[n.id] || { x: 100, y: 100 }
    }
    return r
  }, [nodes, dummyNodes, positions])

  /**
   * DOM-facing positions: same as `stablePositions` plus the live drag preview
   * for the currently-dragged node. Only DOM consumers (card mounting + SVG
   * connection lines) need this, so the canvas grid cache stays stable.
   */
  const resolvedPositions = useMemo(() => {
    if (!nodeDragPreview) return stablePositions
    return {
      ...stablePositions,
      [nodeDragPreview.id]: { x: nodeDragPreview.x, y: nodeDragPreview.y },
    }
  }, [stablePositions, nodeDragPreview])

  const resolveNodePosition = useCallback(
    (nodeId: string): { x: number; y: number } => resolvedPositions[nodeId] || { x: 100, y: 100 },
    [resolvedPositions]
  )

  const nodeHeightsSnapshot = useMemo(
    () => ({ ...nodeHeightsRef.current }),
    [layoutEpoch, positions]
  )

  const visibleNodeIds = useMemo(() => {
    const all = [...nodes, ...dummyNodes]
    const allIds = all.map((n) => n.id)
    if (
      !viewportInfo ||
      allIds.length === 0 ||
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
    const grid = buildNodeCellGrid(
      allIds,
      stablePositions,
      nodeHeightsRef.current,
      IMPRENTA_NODE_W,
      IMPRENTA_ROW_H
    )
    const candidates = collectIdsFromGrid(grid, vw)
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
  }, [nodes, dummyNodes, viewportInfo, stablePositions, layoutEpoch])

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

  const imprentaHoverChainIds = useMemo(() => {
    if (!imprentaHoveredNodeId) return null
    return collectNodeAndAncestorIds(imprentaHoveredNodeId, [...nodes, ...dummyNodes])
  }, [imprentaHoveredNodeId, nodes, dummyNodes])

  const handleImprentaNodeHover = useCallback((nodeId: string | null) => {
    setImprentaHoveredNodeId(nodeId)
  }, [])

  const canvasNodes = useMemo(() => [...nodes, ...dummyNodes], [nodes, dummyNodes])

  /**
   * Skip the lite canvas layer entirely for small/medium graphs. Canvas rendering
   * is only a win when DOM full-cards would otherwise flood the viewport at far
   * zoom; below `IMPRENTA_LOD_LITE_MIN_NODES` total nodes, React virtualization
   * handles the load and the skeleton-pop on zoom-out is just UX noise.
   */
  const isLargeGraph = canvasNodes.length >= IMPRENTA_LOD_LITE_MIN_NODES
  const showFullNodeDetail =
    !viewportInfo ||
    !isLargeGraph ||
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
    console.log("domRenderNodes count:", out.length, "vis set size:", vis?.size, "all nodes:", all.length)
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
    const all = [...nodes, ...dummyNodes]
    const out = new Set<string>()
    for (const n of all) {
      if (!loadingNodeIds.has(n.id)) continue
      const parentId = n.parent_node_id
      if (!parentId) continue
      if (loadingNodeIds.has(parentId)) continue
      out.add(parentId)
    }
    return out
  }, [nodes, dummyNodes, loadingNodeIds])

  /**
   * Parent→loading-node edge pairs along the full ancestry of every loading
   * node. Lets the SVG overlay animate the *route* (every segment on the way
   * from the root down to the result), not only the last hop.
   */
  const loadingRouteEdges = useMemo<Array<{ parentId: string; childId: string }>>(() => {
    if (loadingNodeIds.size === 0) return []
    const all = [...nodes, ...dummyNodes]
    const byId = new Map<string, InstanceNode>()
    for (const n of all) byId.set(n.id, n)
    const seen = new Set<string>()
    const edges: Array<{ parentId: string; childId: string }> = []
    loadingNodeIds.forEach((startId) => {
      let current = byId.get(startId)
      while (current) {
        const parentId = current.parent_node_id
        if (!parentId) break
        const key = `${parentId}->${current.id}`
        if (seen.has(key)) break
        seen.add(key)
        edges.push({ parentId, childId: current.id })
        current = byId.get(parentId)
      }
    })
    return edges
  }, [nodes, dummyNodes, loadingNodeIds])

  // Reset initial prompt when changing instances
  useEffect(() => {
    setInitialPrompt("")
  }, [activeInstanceId])

  // Media parameters state
  const [selectedMediaType, setSelectedMediaType] = useState<'text' | 'image' | 'video' | 'audio' | 'audience' | 'publish'>('text')
  const [textParams, setTextParams] = useState<any>({ expectedResults: 1, length: 'medium', styles: ['default'] })
  const [imageParams, setImageParams] = useState<ImageParameters>({ format: 'PNG', aspectRatio: '1:1', quality: 100, expectedResults: 1 })
  const [videoParams, setVideoParams] = useState<VideoParameters>({ aspectRatio: '16:9', resolution: '1080p', duration: 4, expectedResults: 1 })
  const [audioParams, setAudioParams] = useState<AudioParameters>({ format: 'MP3', sampleRate: '44.1kHz', channels: 'stereo', duration: 15, expectedResults: 1 })

  // Fetch nodes for the selected instance
  useEffect(() => {
    if (!activeInstanceId) return

    let cancelled = false
    
    const fetchNodes = async () => {
      setIsLoading(true)
      let deferLoadingEnd = false
      try {
        const PAGE = 500
        let data: InstanceNode[] = []
        let from = 0
        let fetchError: unknown = null
        while (!cancelled) {
          const { data: page, error } = await supabase
            .from('instance_nodes')
            .select('*')
            .eq('instance_id', activeInstanceId)
            .order('created_at', { ascending: true })
            .range(from, from + PAGE - 1)
          if (cancelled) return
          if (error) {
            fetchError = error as unknown
            break
          }
          if (!page?.length) break
          data = data.concat(page as InstanceNode[])
          if (page.length < PAGE) break
          from += PAGE
        }

        if (cancelled) return

        if (fetchError) {
          console.error(fetchError)
          toast.error("Failed to load workflow nodes")
        } else if (data.length === 0) {
            // Claim synchronously before any await so parallel requests cannot both insert.
            if (rootCreationPendingRef.current.has(activeInstanceId)) {
              deferLoadingEnd = true
              return
            }
            rootCreationPendingRef.current.add(activeInstanceId)

            try {
              const { data: sessionData } = await supabase.auth.getSession()
              if (cancelled) return
              if (!sessionData?.session) return

              const newNode = {
                instance_id: activeInstanceId,
                site_id: currentSite?.id,
                user_id: sessionData.session.user.id,
                parent_node_id: null,
                type: 'prompt',
                status: 'pending',
                prompt: { text: '' },
                settings: {},
                result: {}
              }
              const { data: newDbNode, error: insertError } = await supabase.from('instance_nodes').insert(newNode).select('*').single()
              if (insertError) {
                rootCreationPendingRef.current.delete(activeInstanceId)
                throw insertError
              }
              if (cancelled) return
              if (newDbNode) {
                setNodes(prev => {
                  if (prev.some(n => n.id === newDbNode.id)) return prev
                  return [...prev, newDbNode as InstanceNode]
                })
              }
            } catch (err) {
              rootCreationPendingRef.current.delete(activeInstanceId)
              console.error("Failed to create root node:", err)
            }
        } else {
            console.log("Fetched nodes from DB:", data)
            console.log("Nodes missing positions:", data.filter(n => !n.settings?.ui_position))
            setNodes(data)
            const nodeIds = data.map((n) => n.id)
            if (nodeIds.length > 0) {
              const CTX_CHUNK = 200
              const allCtx: any[] = []
              for (let i = 0; i < nodeIds.length; i += CTX_CHUNK) {
                const slice = nodeIds.slice(i, i + CTX_CHUNK)
                const { data: ctxData } = await supabase
                  .from("instance_node_contexts")
                  .select("*")
                  .in("target_node_id", slice)
                if (cancelled) return
                if (ctxData?.length) allCtx.push(...ctxData)
              }
              if (allCtx.length) setContexts(allCtx)
            }
          }
      } finally {
        if (!cancelled && !deferLoadingEnd) setIsLoading(false)
      }
    }
    
    fetchNodes()

    // Subscribe to realtime updates for nodes
    const subscription = supabase
      .channel(`instance_nodes_${activeInstanceId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'instance_nodes',
        filter: `instance_id=eq.${activeInstanceId}`
      }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          setNodes(prev => {
            if (prev.some(n => n.id === payload.new.id)) return prev;
            return [...prev, payload.new as InstanceNode];
          })
          setDummyNodes(prev => {
            // Find dummies for the same parent
            const dummiesForParent = prev.filter(d => d.parent_node_id === payload.new.parent_node_id);
            
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
                      [payload.new.id]: currPositions[dummyToReplace.id]
                    };
                    
                    if (nodeHeightsRef.current[dummyToReplace.id]) {
                      nodeHeightsRef.current[payload.new.id] = nodeHeightsRef.current[dummyToReplace.id];
                    }
                    
                    // Immediately clean up the dummy node's position so it doesn't bump the new node
                    delete (newPositions as any)[dummyToReplace.id];
                    
                    return newPositions;
                  }
                  return currPositions;
                });
                
                setGeneratingNodeIds(prev => {
                  const next = new Set(prev);
                  next.add(payload.new.id);
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
          setNodes(prev => prev.map(n => n.id === payload.new.id ? payload.new as InstanceNode : n))
          
          if (payload.new.status === 'completed' || payload.new.status === 'failed') {
            setGeneratingNodeIds(prev => {
              if (prev.has(payload.new.id)) {
                const next = new Set(prev);
                next.delete(payload.new.id);
                return next;
              }
              return prev;
            });
          }
          
          // If the executed node fails or completes without a child, we might want to clear dummy children
          if (payload.new.status === 'failed' || payload.new.status === 'completed') {
            setDummyNodes(prev => {
              const toRemove = prev.filter(d => d.parent_node_id === payload.new.id);
              if (toRemove.length > 0) {
                // Also clean up their positions to prevent memory leaks
                setPositions(curr => {
                  const copy = { ...curr };
                  toRemove.forEach(d => delete copy[d.id]);
                  return copy;
                });
                return prev.filter(d => d.parent_node_id !== payload.new.id);
              }
              return prev;
            });
          }
        } else if (payload.eventType === 'DELETE') {
          setNodes(prev => prev.filter(n => n.id !== payload.old.id))
        }
      })
      .subscribe()

    // Subscribe to realtime updates for contexts
    const contextSubscription = supabase
      .channel(`instance_node_contexts_${activeInstanceId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'instance_node_contexts'
      }, async () => {
        // Refetch contexts on any change
        const currentNodes = nodesRef.current.map(n => n.id)
        if (currentNodes.length > 0) {
          const { data } = await supabase.from('instance_node_contexts').select('*').in('target_node_id', currentNodes)
          if (data) setContexts(data)
        }
      })
      .subscribe()

    return () => {
      cancelled = true
      subscription.unsubscribe()
      contextSubscription.unsubscribe()
    }
  }, [activeInstanceId, supabase, currentSite])

  const handleExecuteNode = async (node: InstanceNode) => {
    if (node.type === "publish") {
      const err = validatePublishNodeInputs(node, contexts, [...nodes, ...dummyNodes])
      if (err) {
        toast.error(err)
        return
      }
    }
    toast.info("Executing node...")
    try {
      // Create a dummy placeholder child node visually
      const expectedAmount = Number((node.settings as any)?.parameters?.expectedResults) || 1;
      const newDummies = Array.from({ length: expectedAmount }).map((_, i) => ({
        id: `dummy-${Date.now()}-${i}`,
        instance_id: node.instance_id,
        parent_node_id: node.id,
        original_node_id: null,
        parent_instance_log_id: null,
        type: 'Generating...',
        status: 'running',
        prompt: { text: '' },
        settings: {},
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
      const currentMediaType = (node.settings as any)?.media_type || (node.type === 'prompt' ? 'text' : node.type.replace('generate-', ''));
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

    const curPos = positionsRef.current[nodeId] || { x: 100, y: 100 }
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
          media_type: mediaType 
        },
        result: {
          outputs: [{ url: path, type: mediaType }]
        }
      }

      const { error } = await supabase.from('instance_nodes').insert(newNode)
      
      if (error) {
        throw error
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
    
    // Pass media type and params into settings
    const nodeSettings = selectedMediaType === 'text' 
      ? { media_type: 'text', parameters: textParams } 
      : {
          media_type: selectedMediaType,
          parameters: selectedMediaType === 'image' ? imageParams :
                      selectedMediaType === 'video' ? videoParams :
                      selectedMediaType === 'audio' ? audioParams : {}
        };
    
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
    
    const { data, error } = await supabase.from('instance_nodes').insert(newNode).select('id').single()
    if (error) {
      toast.error("Failed to create node")
      console.error(error)
      return null
    } else {
      toast.success("Node created")
      return data.id
    }
  }

  // Keyboard shortcuts for the toolbar: Shift+N creates a new action, Shift+U
  // opens the file picker. Skipped when a field is focused so typing keeps working.
  useEffect(() => {
    if (!activeInstanceId || nodes.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
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
    
    const { data: actionNode, error } = await supabase.from('instance_nodes').insert(newNode).select('id').single()
    if (error || !actionNode) {
      toast.error("Failed to create action node")
      return
    }

    // 2. Link context
    const contextLink = {
      target_node_id: actionNode.id,
      context_node_id: contextNodeId,
      site_id: currentSite.id,
      user_id: session.user.id
      // 'type' could be specified here if we had a prompt for it, leaving null for now
    }
    await supabase.from('instance_node_contexts').insert(contextLink)
    
    toast.success("Action node created with context")
  }

  const handleWindowMouseMove = useCallback((e: MouseEvent) => {
    const nodeId = draggingNodeRef.current
    if (!nodeId) return
    
    let scale = 1
    const contentDiv = document.getElementById('imprenta-canvas-content')
    if (contentDiv && contentDiv.parentElement) {
       const transform = contentDiv.parentElement.style.transform
       const match = transform.match(/scale\(([^)]+)\)/)
       if (match) scale = parseFloat(match[1]) || 1
    }

    const dx = (e.clientX - dragStartPos.current.x) / scale
    const dy = (e.clientY - dragStartPos.current.y) / scale

    const nx = dragStartNodePos.current.x + dx
    const ny = dragStartNodePos.current.y + dy
    lastNodeDragPosRef.current = { x: nx, y: ny }

    const el = nodeElementsRef.current[nodeId]
    if (el) {
      el.style.left = `${nx}px`
      el.style.top = `${ny}px`
    }

    if (nodeDragRafRef.current == null) {
      nodeDragRafRef.current = requestAnimationFrame(() => {
        nodeDragRafRef.current = null
        const id = draggingNodeRef.current
        const last = lastNodeDragPosRef.current
        if (id && last) {
          setNodeDragPreview({ id, x: last.x, y: last.y })
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
    window.removeEventListener('mousemove', handleWindowMouseMove)
    window.removeEventListener('mouseup', handleWindowMouseUp)
    window.removeEventListener('click', handleWindowMouseUp, { capture: true })

    setNodeDragPreview(null)
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
    setNodeDragPreview({
      id: nodeId,
      x: dragStartNodePos.current.x,
      y: dragStartNodePos.current.y,
    })
    setDraggingNodeId(nodeId)

    // Ensure we don't attach multiple times if somehow called twice
    window.removeEventListener('mousemove', handleWindowMouseMove)
    window.removeEventListener('mouseup', handleWindowMouseUp)
    window.removeEventListener('click', handleWindowMouseUp, { capture: true })

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    window.addEventListener('click', handleWindowMouseUp, { capture: true, once: true })
  }, [handleWindowMouseMove, handleWindowMouseUp])

  /** Entry point from the lite canvas layer (no React synthetic event is available). */
  const handleCanvasNodePointerDown = useCallback((nodeId: string, ev: PointerEvent) => {
    if (ev.button !== 0) return
    const target = ev.target as HTMLElement
    if (target && (target.closest('button') || target.closest('textarea') || target.closest('input') || target.closest('a') || target.closest('[role="button"]') || target.closest('[role="menuitem"]') || target.closest('[role="menu"]') || target.closest('[role="dialog"]') || target.closest('[role="listbox"]') || target.closest('[role="option"]') || target.closest('[role="combobox"]') || target.closest('[role="tab"]') || target.closest('[role="tabpanel"]') || target.closest('video') || target.closest('audio'))) return
    
    ev.stopPropagation()
    ev.preventDefault()
    beginNodeDrag(nodeId, ev.clientX, ev.clientY)
  }, [beginNodeDrag])

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return // Only left click
    const target = e.target as HTMLElement
    // Prevent dragging if clicking on an input/button or an SVG icon inside a button
    if (target.closest('button') || target.closest('textarea') || target.closest('input') || target.closest('a') || target.closest('[role="button"]') || target.closest('[role="menuitem"]') || target.closest('[role="menu"]') || target.closest('[role="dialog"]') || target.closest('[role="listbox"]') || target.closest('[role="option"]') || target.closest('[role="combobox"]') || target.closest('[role="tab"]') || target.closest('[role="tabpanel"]') || target.closest('video') || target.closest('audio')) return
    
    e.stopPropagation()
    e.preventDefault() // Prevents native image drag and text selection which breaks mousemove

    beginNodeDrag(nodeId, e.clientX, e.clientY)
  }

  const handleConnectionStart = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    
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
    window.addEventListener('mouseup', handleConnectionEnd);
    window.addEventListener('click', handleConnectionEnd, { capture: true, once: true });
  }

  const handleConnectionMove = (e: MouseEvent) => {
    if (!drawingConnectionRef.current) return;
    
    let scale = 1;
    const contentDiv = document.getElementById('imprenta-canvas-content');
    if (contentDiv && contentDiv.parentElement) {
       const transform = contentDiv.parentElement.style.transform;
       const match = transform.match(/scale\(([^)]+)\)/);
       if (match) scale = parseFloat(match[1]) || 1;
    }
    
    const dx = (e.clientX - drawingConnectionRef.current.mouseStartX) / scale;
    const dy = (e.clientY - drawingConnectionRef.current.mouseStartY) / scale;
    
    setTempConnection({
      fromNode: drawingConnectionRef.current.fromNode,
      currentX: drawingConnectionRef.current.nodeStartX + dx,
      currentY: drawingConnectionRef.current.nodeStartY + dy
    });
  }

  const handleConnectionEnd = (e?: MouseEvent | Event) => {
    drawingConnectionRef.current = null;
    setTempConnection(null);
    window.removeEventListener('mousemove', handleConnectionMove);
    window.removeEventListener('mouseup', handleConnectionEnd);
    window.removeEventListener('click', handleConnectionEnd as any, { capture: true });
  }

  const handleConnectionDrop = async (
    e: React.MouseEvent,
    targetNodeId: string,
    slot?: "content" | "context" | "audience"
  ) => {
    e.stopPropagation();
    if (!drawingConnectionRef.current) return;
      const sourceNodeId = drawingConnectionRef.current.fromNode;
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
        <div className="relative w-full overflow-hidden rounded-xl bg-black/10 aspect-square flex items-center justify-center">
          <video 
            src={url} 
            controls 
            className="w-full h-full object-cover absolute inset-0 m-auto" 
            onClick={(e) => e.stopPropagation()}
          />
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
          orphansWithCtx.forEach(node => {
            if (!pos[node.id]) return
            const anchored = computeContextAnchoredPosition(node.id, pos)
            if (!anchored) return
            const dx = anchored.x - pos[node.id].x
            const dy = anchored.y - pos[node.id].y
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
              shiftSubtree(node.id, dx, dy)
              changed = true
            }
          })
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
      // Parentless nodes that are anchored to their contexts are excluded from
      // the root stack so we don't collapse them back into column 0.
      for (const key of Object.keys(parentGroups)) {
        const sorted = parentGroups[key]
          .filter(n => pos[n.id] && !isNaN(pos[n.id].y))
          .filter(n => !(key === '__root__' && hasInboundContexts(n.id)))
        
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
        
        for (let i = 1; i < sorted.length; i++) {
          const prevNodeId = sorted[i - 1].id;
          const currNodeId = sorted[i].id;
          
          const prevBottom = pos[prevNodeId].y + h(prevNodeId)
          const currNode = currentNodes.find(n => n.id === currNodeId);
          const hasUserPos = currNode && !currNode.id.startsWith('dummy-') && (currNode.settings as any)?.ui_position;
          
          if (pos[currNodeId].y < prevBottom) {
            // Only bump if they are actually colliding, but ignore exact same Y overlaps 
            // since that indicates a replacement in progress where they share the exact slot
            if (Math.abs(pos[currNodeId].y - pos[prevNodeId].y) > 1 && !prevNodeId.startsWith('dummy-')) {
              pos[currNodeId] = { ...pos[currNodeId], y: prevBottom }
            } else if (Math.abs(pos[currNodeId].y - pos[prevNodeId].y) > 1 && prevNodeId.startsWith('dummy-')) {
              pos[currNodeId] = { ...pos[currNodeId], y: prevBottom }
            }
          } else if (pos[currNodeId].y > prevBottom && !hasUserPos) {
            // Pull up to close gap if it was placed automatically
            pos[currNodeId] = { ...pos[currNodeId], y: prevBottom }
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

  // Tight artboard from node extents (no fixed 800×600 floor when nodes exist).
  const maxBounds = useMemo(() => {
    let maxX = 0
    let maxY = 0

    Object.entries(positions).forEach(([id, pos]) => {
      if (typeof pos.x !== 'number' || typeof pos.y !== 'number' || isNaN(pos.x) || isNaN(pos.y)) return

      const nh = (nodeHeightsRef.current[id] || ROW_H) + 50
      maxX = Math.max(maxX, pos.x + NODE_W + 50)
      maxY = Math.max(maxY, pos.y + nh)
    })

    if (maxX === 0 && maxY === 0) {
      return { width: 800, height: 600 }
    }

    return {
      width: Math.max(maxX, 320),
      height: Math.max(maxY, 320),
    }
  }, [positions])

  return (
    <div 
      className="h-full min-h-0 flex flex-col transition-[margin-left,width] duration-300 ease-out relative"
      style={{
        marginLeft: `-${sidebarWidth}px`,
        width: `calc(100% + ${sidebarWidth}px)`
      }}
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {!activeInstanceId || isLoading ? (
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
          viewportStore={viewportStore}
          screenSpaceBehind={
            <ImprentaParentEdgesCanvas
              nodes={canvasNodes}
              positions={stablePositions}
              dragOverride={nodeDragPreview}
              nodeHeights={nodeHeightsSnapshot}
              nodeW={NODE_W}
              rowH={ROW_H}
              strokeStyle={parentEdgeStroke}
              hoverChainNodeIds={imprentaHoverChainIds}
              hoverChainStroke={parentEdgeHoverStroke}
              viewportStore={viewportStore}
              // On small graphs we keep full bezier edges at every zoom; the
              // straight-line LOD only pays off when many edges fit on screen.
              straightLinesBelowScale={isLargeGraph ? IMPRENTA_LOD_FULL_DETAIL_SCALE : 0}
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
              fullDetailScale={isLargeGraph ? IMPRENTA_LOD_FULL_DETAIL_SCALE : 0.001}
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
                </div>
              </TooltipProvider>
            ) : null
          }
        >
            <div 
              id="imprenta-canvas-content" 
              className="relative"
              style={{ minWidth: maxBounds.width, minHeight: maxBounds.height }}
              onClick={() => setSelectedContextId(null)}
            >
                  {/* Parent edges are drawn by the viewport-sized canvas mounted in screenSpaceBehind. */}

                  {/* Context edges: single SVG for all paths; labels/UI stay in per-context overlays. */}
                  {contexts.length > 0 && (
                    <svg
                      className="absolute top-0 left-0 w-full h-full pointer-events-none"
                      style={{ zIndex: 0, overflow: 'visible' }}
                      shapeRendering="optimizeSpeed"
                    >
                      {contexts.map((ctx) => {
                        if (!positions[ctx.context_node_id] || !positions[ctx.target_node_id]) return null
                        const start = resolveNodePosition(ctx.context_node_id)
                        const end = resolveNodePosition(ctx.target_node_id)
                        const startCy = (nodeHeightsRef.current[ctx.context_node_id] || ROW_H) / 2
                        const targetNodeForCtx = nodesRef.current.find((n) => n.id === ctx.target_node_id)
                        const endH = nodeHeightsRef.current[ctx.target_node_id] || ROW_H
                        const endCy = getPublishContextAnchorY(targetNodeForCtx?.type, ctx.type, endH)
                        const startX = start.x + NODE_W
                        const startY = start.y + startCy
                        const endX = end.x
                        const endY = end.y + endCy
                        const isSelected = selectedContextId === ctx.id
                        const chain = imprentaHoverChainIds
                        const touchesHoverChain =
                          chain != null &&
                          (chain.has(ctx.context_node_id) || chain.has(ctx.target_node_id))
                        const strokeClass =
                          isSelected || touchesHoverChain ? "text-primary" : "text-primary/50"
                        const strokeWidth = isSelected ? 4 : touchesHoverChain ? 3 : 2
                        const d = `M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`
                        return (
                          <g key={`ctx-edge-${ctx.id}`}>
                            <path
                              d={d}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={strokeWidth}
                              className={`${strokeClass} stroke-dashed cursor-pointer`}
                              strokeDasharray="4 4"
                              style={{ pointerEvents: "stroke" }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedContextId(isSelected ? null : ctx.id)
                              }}
                            />
                            <path
                              d={d}
                              fill="none"
                              stroke="transparent"
                              strokeWidth="20"
                              className="cursor-pointer"
                              style={{ pointerEvents: "stroke" }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedContextId(isSelected ? null : ctx.id)
                              }}
                            />
                          </g>
                        )
                      })}
                    </svg>
                  )}

                  {contexts.map((ctx) => {
                    if (!positions[ctx.context_node_id] || !positions[ctx.target_node_id]) return null
                    const start = resolveNodePosition(ctx.context_node_id)
                    const end = resolveNodePosition(ctx.target_node_id)
                    const startCy = (nodeHeightsRef.current[ctx.context_node_id] || ROW_H) / 2
                    const targetNodeForCtx = nodesRef.current.find((n) => n.id === ctx.target_node_id)
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
                            className="absolute px-2 py-0.5 bg-background border border-primary/20 text-primary text-[10px] font-medium rounded-full shadow-sm pointer-events-auto cursor-pointer"
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
                    const pos = resolvedPositions[node.id] || { x: 100, y: 100 }
                    const isDummy = node.id.startsWith('dummy-');
                    const hasResult = node.result && Object.keys(node.result).length > 0;
                    const isEffectivelyDummy = isDummy || (!hasResult && generatingNodeIds.has(node.id) && (node.status === 'running' || node.status === 'pending'));
                    
                    if (isEffectivelyDummy) {
                      /** Below full-detail zoom, strip expensive composites from the dummy card (animate-pulse gradient, etc). */
                      const liteDummy = !showFullNodeDetail
                      return (
                        <div 
                          key={node.id}
                          ref={(el) => registerNodeRef(node.id, el)}
                          data-node-id={node.id}
                          className="absolute group z-10"
                          style={{ 
                            left: pos.x, 
                            top: pos.y,
                          }}
                        >
                          <Card
                            className={
                              "w-[480px] min-h-[280px] border-2 border-dashed border-primary/25 bg-card/50 rounded-3xl overflow-hidden relative flex flex-col justify-center items-center " +
                              (liteDummy ? "" : "shadow-sm")
                            }
                          >
                            {/* Fancy floating orbs (EmptyCard vibe). Skipped in lite mode
                                to avoid expensive blur layers when hundreds of cards are
                                on screen. */}
                            {!liteDummy && (
                              <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                                <div
                                  className="imprenta-orb bg-violet-500/30"
                                  style={{ top: "18%", left: "14%", width: 140, height: 140, animation: "imprenta-orb-float-a 6s ease-in-out infinite", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
                                />
                                <div
                                  className="imprenta-orb bg-indigo-500/25"
                                  style={{ top: "58%", left: "62%", width: 120, height: 120, animation: "imprenta-orb-float-b 7.5s ease-in-out infinite", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
                                />
                                <div
                                  className="imprenta-orb bg-pink-500/25"
                                  style={{ top: "10%", left: "68%", width: 90, height: 90, animation: "imprenta-orb-float-c 6.8s ease-in-out infinite", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
                                />
                                <div
                                  className="imprenta-orb bg-emerald-500/20"
                                  style={{ top: "62%", left: "10%", width: 100, height: 100, animation: "imprenta-orb-float-b 8.2s ease-in-out infinite", animationDelay: "0.6s", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
                                />
                                <div
                                  className="imprenta-orb bg-cyan-500/20"
                                  style={{ top: "36%", left: "44%", width: 80, height: 80, animation: "imprenta-orb-float-c 7s ease-in-out infinite", animationDelay: "1.2s", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
                                />
                                <div
                                  className="imprenta-orb bg-purple-500/22"
                                  style={{ top: "32%", left: "30%", width: 70, height: 70, animation: "imprenta-orb-float-a 9s ease-in-out infinite", animationDelay: "1.8s", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
                                />
                              </div>
                            )}

                            <CardContent className="p-5 relative z-10 w-full h-full" />
                          </Card>
                        </div>
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
                      <div 
                        key={node.id}
                        ref={(el) => registerNodeRef(node.id, el)}
                        data-node-id={node.id}
                        className="absolute cursor-grab active:cursor-grabbing"
                        style={{ 
                          left: pos.x, 
                          top: pos.y,
                          zIndex: 10
                        }}
                        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
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
                            (actionNodeIds.has(node.id) ? " imprenta-action-running" : "")
                          }
                          onMouseEnter={() => handleImprentaNodeHover(node.id)}
                          onMouseLeave={() => handleImprentaNodeHover(null)}
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
                                    handleDeleteNode(node.id)
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6} className="text-xs max-w-[240px]">
                                Delete this node and all nested nodes
                              </TooltipContent>
                            </Tooltip>
                            {isImprentaWorkflowActionNode(node) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-8 w-8 rounded-full p-0 shadow-md border border-border/70 bg-background hover:bg-muted shrink-0 [&_svg]:size-3"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void handleDuplicateNode(node.id)
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
                                  const dest = Array.isArray((node.settings as any)?.publish_destinations)
                                    ? ((node.settings as any).publish_destinations as string[])
                                    : [];
                                  const needAudience = destinationsRequireAudience(dest);
                                  const allNodes = [...nodes, ...dummyNodes];
                                  const hasCnt = hasPublishContentInput(contexts, node.id, allNodes);
                                  const hasAud = hasPublishAudienceInput(contexts, node.id, allNodes);
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
                                          onMouseUp={(e) => handleConnectionDrop(e, node.id, "content")}
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
                                          onMouseUp={(e) => handleConnectionDrop(e, node.id, "context")}
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
                                          onMouseUp={(e) => handleConnectionDrop(e, node.id, "audience")}
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
                                onMouseUp={(e) => handleConnectionDrop(e, node.id)}
                              >
                                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full pointer-events-none" />
                              </div>
                              ))}

                            {hasResult && (
                              <div 
                                className="absolute top-1/2 -translate-y-1/2 -right-3 w-4 h-4 bg-background border-2 border-primary rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20 hover:scale-125 transition-transform" 
                                title="Drag to a context input"
                                onMouseDown={(e) => handleConnectionStart(e, node.id)}
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

                              {isImprentaWorkflowActionNode(node) && (
                                <div
                                  className="flex flex-wrap items-center bg-muted/50 p-1 rounded-2xl gap-1"
                                  title={
                                    hasResult
                                      ? "This result is fixed. Pick another mode to create a new pending node with that type (same prompt, settings, and context links)."
                                      : "Card mode"
                                  }
                                >
                                  {IMPRENTA_MODE_OPTIONS.map(({ type: modeType, label }) => (
                                    <Button
                                      key={modeType}
                                      type="button"
                                      variant={node.type === modeType ? "outline" : "ghost"}
                                      size="sm"
                                      className={`flex-1 h-7 text-[11px] rounded-full font-medium ${
                                        node.type === modeType
                                          ? "bg-background shadow-sm border-white/10"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        if (hasResult) {
                                          if (modeType === node.type) return
                                          await cloneImprentaNodeWithType(node.id, modeType)
                                          return
                                        }
                                        setNodes((prev) =>
                                          prev.map((n) => (n.id === node.id ? { ...n, type: modeType } : n))
                                        )
                                        await supabase.from("instance_nodes").update({ type: modeType }).eq("id", node.id)
                                      }}
                                    >
                                      {label}
                                    </Button>
                                  ))}
                                </div>
                              )}
                              
                              {!hasResult && (
                                <>
                                <Textarea 
                                  defaultValue={node.prompt?.text || ''}
                                  onBlur={async (e) => {
                                    const newText = e.target.value;
                                    if (newText !== node.prompt?.text) {
                                      setNodes(prev => prev.map(n => n.id === node.id ? { ...n, prompt: { ...n.prompt, text: newText } } : n));
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
                                          setNodes(prev => prev.map(n => n.id === node.id ? { ...n, settings: { ...((n.settings as any) || {}), audience_channels: newChannels } } : n));
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
                                    setNodes(prev => prev.map(n => n.id === node.id ? { ...n, settings: { ...((n.settings as any) || {}), publish_destinations: newDest } } : n));
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
                                        setNodes(prev => prev.map(n => n.id === node.id ? { ...n, settings: updatedSettings } : n));
                                        await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id);
                                      }}
                                      onImageParameterChange={async (key, value) => {
                                        const currentParams = (node.settings as any)?.parameters || imageParams;
                                        const newParams = { ...currentParams, [key]: value };
                                        const updatedSettings = { ...((node.settings as any) || {}), media_type: 'image', parameters: newParams };
                                        setNodes(prev => prev.map(n => n.id === node.id ? { ...n, settings: updatedSettings } : n));
                                        await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id);
                                      }}
                                      onVideoParameterChange={async (key, value) => {
                                        const currentParams = (node.settings as any)?.parameters || videoParams;
                                        const newParams = { ...currentParams, [key]: value };
                                        const updatedSettings = { ...((node.settings as any) || {}), media_type: 'video', parameters: newParams };
                                        setNodes(prev => prev.map(n => n.id === node.id ? { ...n, settings: updatedSettings } : n));
                                        await supabase.from('instance_nodes').update({ settings: updatedSettings }).eq('id', node.id);
                                      }}
                                      onAudioParameterChange={async (key, value) => {
                                        const currentParams = (node.settings as any)?.parameters || audioParams;
                                        const newParams = { ...currentParams, [key]: value };
                                        const updatedSettings = { ...((node.settings as any) || {}), media_type: 'audio', parameters: newParams };
                                        setNodes(prev => prev.map(n => n.id === node.id ? { ...n, settings: updatedSettings } : n));
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
                                  const hasStructuredMedia = !!(node.result as any).outputs || !!(node.result as any).media || !!(node.result as any).images || !!(node.result as any).image || !!(node.result as any).video || !!(node.result as any).audio;
                                  let textContent = (node.result as any).text 
                                    ? String((node.result as any).text) 
                                    : "```json\n" + JSON.stringify(node.result, null, 2) + "\n```";
                                  if (hasStructuredMedia && textContent) {
                                    textContent = textContent.replace(/https?:\/\/[^\s"'<>()]+\.(wav|mp3|ogg|m4a|aac|flac|webm)/gi, '').trim();
                                  }
                                  if (!textContent) return null;
                                  return (
                                    <div className="text-xs bg-accent/10 border border-accent/20 p-3 rounded-xl text-accent-foreground max-h-[200px] overflow-y-auto custom-scrollbar prose prose-sm dark:prose-invert max-w-none">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                        {textContent}
                                      </ReactMarkdown>
                                    </div>
                                  );
                                })()}
                              </div>
                              );
                              })()
                            )}
                            
                              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                              {hasResult ? (
                                <div className="flex gap-2 w-full">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="flex-1"
                                    disabled={!!(node.settings as any)?.imprenta_mode && !contexts.some(ctx => ctx.target_node_id === node.id)}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const parentNode = node.parent_node_id ? nodes.find(n => n.id === node.parent_node_id) : null;
                                      if (parentNode) {
                                        handleExecuteNode(parentNode);
                                      } else {
                                        handleExecuteNode(node); // Fallback: execute current if root
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
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCreateActionFromContext(node.id);
                                    }}
                                    title="New Action"
                                  >
                                    <Plus className="w-4 h-4 mr-2" /> Action
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
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

                                      return isAssetUrl ? (
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          className="flex-1"
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onClick={async (e) => {
                                            e.stopPropagation();
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
                                          }}
                                          title="Download Asset"
                                        >
                                          <Download className="w-4 h-4 mr-2" /> Download
                                        </Button>
                                      ) : null;
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
                                      handleExecuteNode(node);
                                    }}
                                  >
                                    <Play className="w-4 h-4 mr-2" /> Generate
                                  </Button>
                                </div>
                              )}
                            </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
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
      {zoomedMedia && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
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
        </div>
      )}
    </div>
  )
}
import { InstanceNode } from "@/app/types/instance-nodes"
import { imprentaNodeMediaAspectCss } from "@/app/lib/imprenta-media-aspect"
import { useMemo, memo } from "react"
import { ImprentaLazyPreviewImage, ImprentaLazyPreviewVideo } from "@/app/components/agents/imprenta-lazy-media"
import { imprentaLiteSkeletonBand, collectImprentaLiteImagePreviewUrls, collectImprentaLiteVideoPreviewUrls, IMPRENTA_ROW_H } from './preview-helpers'
import { imprentaNodeHasResult, imprentaSegmentedActiveIndex, skBlock, skLine, IMPRENTA_LITE_MEDIA_WIDTH, skMedia, isImprentaVisualMediaResultCard } from './result-helpers'

export function ImprentaLiteSkeletonBody({ node, zoomScale }: { node: InstanceNode; zoomScale: number }) {
  const band = imprentaLiteSkeletonBand(zoomScale)
  const type = node.type ?? "prompt"
  const rich = band === "rich"
  const micro = band === "micro"
  const mediaAspect = imprentaNodeMediaAspectCss(node)
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
  // Image/video results skip this — they are edge-to-edge media at every zoom.
  if (micro && !(hasResult && (cover || coverVideo))) {
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
    const bleedMedia = !!(cover || coverVideo)
    if (bleedMedia) {
      return (
        <div className="relative h-full w-full min-h-0 overflow-hidden">
          <div className="h-full w-full min-h-0" style={{ aspectRatio: mediaAspect }}>
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
        </div>
      )
    }
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {header}
        <div className={`flex-1 min-h-[60px] rounded-xl ${skBlock} p-3 space-y-2`}>
          <div className={`h-2 w-[92%] ${skLine}`} />
          <div className={`h-2 w-[80%] ${skLine}`} />
          {rich && <div className={`h-2 w-[68%] ${skLine}`} />}
        </div>
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
            className={`flex-1 h-7 rounded-full flex items-center justify-center ${active ? "bg-background shadow-sm border border-border" : ""
              }`}
          >
            <div
              className={`h-1.5 w-6 rounded-full ${active ? "bg-foreground/40" : "bg-foreground/20"
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
          className={`${IMPRENTA_LITE_MEDIA_WIDTH} max-w-full shrink-0 min-h-0 overflow-hidden rounded-2xl border border-border`}
          style={{ aspectRatio: mediaAspect }}
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

export const ImprentaLiteGraphNode = memo(function ImprentaLiteGraphNode({
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
  const bleedMedia = isImprentaVisualMediaResultCard(node)
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
      <div className={`flex-1 min-h-0 flex flex-col ${bleedMedia ? "p-0" : micro ? "p-3" : "p-5"}`}>
        <ImprentaLiteSkeletonBody node={node} zoomScale={zoomScale} />
      </div>
    </div>
  )
})

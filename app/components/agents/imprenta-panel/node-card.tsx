import { useState, memo } from "react"

import { imprentaNodeMediaAspectCss } from "@/app/lib/imprenta-media-aspect"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/app/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip"
import { Button } from "@/app/components/ui/button"
import { Trash2, Copy } from "@/app/components/ui/icons"
import { PUBLISH_ANCHOR_AUDIENCE_Y, PUBLISH_ANCHOR_CONTENT_Y, PUBLISH_ANCHOR_CONTEXT_Y, PUBLISH_ANCHOR_LABELS } from "@/app/components/agents/imprenta-publish-context"
import { Badge } from "@/app/components/ui/badge"

import { ImprentaTestPublishDialog } from "../imprenta-test-publish-dialog"
import { isImprentaVisualMediaResultCard, IMPRENTA_SHOP_OVERLAY_BTN, IMPRENTA_SHOP_OVERLAY_ICON } from './result-helpers'

import type { ImprentaNodeCardProps } from './card-types'
import { ImprentaCardEditor } from './card-editor'
import { ImprentaCardResult } from './card-result'
import { ImprentaCardActions } from './card-actions'

export const ImprentaNodeCardInner = memo(function ImprentaNodeCardInner({
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
  logs,
  supabase,
  generatingNodeIds,
  currentSite,
  textParams,
  imageParams,
  videoParams,
  audioParams,
  renderMediaWithZoom,
  actions,
}: ImprentaNodeCardProps) {
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false)
  const mediaAspect = imprentaNodeMediaAspectCss(node, actions.getParentNode(node))
  const isVisualMediaCard = isImprentaVisualMediaResultCard(node)
  const renderResultMedia = (url: string, type: "image" | "video", key: React.Key) =>
    renderMediaWithZoom(url, type, key, mediaAspect, isVisualMediaCard)
  const resultBtnClass = cn("flex-1", isVisualMediaCard && IMPRENTA_SHOP_OVERLAY_BTN)
  const resultIconClass = isVisualMediaCard ? IMPRENTA_SHOP_OVERLAY_ICON : "h-4 w-4 mr-2"
  const resultBtnVariant = isVisualMediaCard ? "ghost" : "outline"
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

        {hasResult && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -right-3 w-4 h-4 bg-background border-2 border-primary rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20 hover:scale-125 transition-transform"
            title="Drag to a context input"
            onClick={(e) => actions.handleConnectionStart(e, node.id)}
          >
            <div className="w-1.5 h-1.5 bg-primary rounded-full pointer-events-none" />
          </div>
        )}

        <CardContent className={cn("relative", isVisualMediaCard ? "p-0 overflow-hidden rounded-[1.35rem]" : "p-5")}>
          {!hasResult &&
            (node.type === "publish" ? (
              (() => {
                const contentWarn = !hasCnt;
                const audienceWarn = needAudience && !hasAud;
                const anchorClass = (warn: boolean) =>
                  `w-4 h-4 bg-background border-2 rounded-full flex items-center justify-center shrink-0 hover:scale-125 transition-transform ${warn ? "border-amber-500" : "border-muted-foreground"
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
                          ? "Audience: Audience node including audience_id: (required for Mail, WhatsApp, Newsletter, SMS, Message, Email)"
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

          <div className={isVisualMediaCard ? "relative" : "space-y-3"}>
            <div className={cn(
              "flex items-center justify-between",
              isVisualMediaCard && "absolute inset-x-0 top-0 z-10 px-5 pt-4 pointer-events-none transition-opacity bg-gradient-to-b from-black/50 to-transparent pb-8 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
            )}>
              <span className={cn(
                "text-xs font-medium uppercase leading-none",
                isVisualMediaCard ? "text-white/90 drop-shadow" : "text-muted-foreground"
              )}>
                {hasResult ? 'Result' : node.type}
              </span>
              {hasResult && (
                <Badge variant={
                  node.status === 'completed' ? 'success' :
                    node.status === 'failed' ? 'destructive' :
                      node.status === 'running' ? 'default' : 'secondary'
                } className="text-[10px] px-1.5 py-0">
                  {node.status}
                </Badge>
              )}
            </div>

            <ImprentaCardEditor actions={actions} node={node} hasResult={hasResult} nodes={nodes} generatingNodeIds={generatingNodeIds} supabase={supabase} currentSite={currentSite} textParams={textParams} imageParams={imageParams} videoParams={videoParams} audioParams={audioParams} />

            <ImprentaCardResult hasResult={hasResult} isVisualMediaCard={isVisualMediaCard} nodes={nodes} dummyNodes={dummyNodes} actions={actions} node={node} logs={logs} currentSite={currentSite} renderResultMedia={renderResultMedia} mediaAspect={mediaAspect} />

            <ImprentaCardActions isVisualMediaCard={isVisualMediaCard} actions={actions} node={node} hasResult={hasResult} resultBtnVariant={resultBtnVariant} resultBtnClass={resultBtnClass} contexts={contexts} resultIconClass={resultIconClass} needAudience={needAudience} setIsTestDialogOpen={setIsTestDialogOpen} />
          </div>
        </CardContent>
      </Card>
      {node.type === "publish" && (
        <ImprentaTestPublishDialog
          isOpen={isTestDialogOpen}
          onClose={() => setIsTestDialogOpen(false)}
          destinations={Array.isArray((node.settings)?.publish_destinations) ? ((node.settings).publish_destinations as string[]) : []}
          onConfirm={(testDestinations) => {
            actions.handleExecuteNode(node, testDestinations)
          }}
        />
      )}
    </div>
  )
})
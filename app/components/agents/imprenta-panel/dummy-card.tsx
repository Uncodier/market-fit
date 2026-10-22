import { memo } from "react"
import { InstanceNode } from "@/app/types/instance-nodes"
import { imprentaNodeMediaAspectCss } from "@/app/lib/imprenta-media-aspect"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Bot } from "@/app/components/ui/icons"

export const ImprentaDummyCardInner = memo(function ImprentaDummyCardInner({
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
}) {
  const mediaTypeForDummy = (node.settings)?.media_type || node.type.replace('generate-', '')
  const isMediaDummy = mediaTypeForDummy === 'image' || mediaTypeForDummy === 'video' || mediaTypeForDummy === 'audio'
  const isVisualDummy = mediaTypeForDummy === 'image' || mediaTypeForDummy === 'video'
  const aspectStyle = imprentaNodeMediaAspectCss(node)

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
        <CardContent className={cn("flex flex-col", isVisualDummy ? "p-0 overflow-hidden rounded-[1.35rem]" : "p-5 gap-3")}>
          {!isVisualDummy && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none truncate">
                Result
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-secondary/50">
                {node.status === 'pending' ? 'pending' : 'running'}
              </Badge>
            </div>
          )}

          {isMediaDummy ? (
            <div
              className={cn(
                "w-full overflow-hidden bg-muted/30 flex flex-col items-center justify-center pointer-events-none",
                isVisualDummy ? "rounded-none border-0" : "rounded-xl border border-border/50"
              )}
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

          {!isVisualDummy && (
            <div className="flex items-center justify-between pt-3 border-t border-white/5 opacity-50 pointer-events-none">
              <div className="flex gap-2 w-full">
                <div className="h-8 flex-1 rounded-md bg-muted/50 border border-border/50" />
                <div className="h-8 flex-1 rounded-md bg-muted/50 border border-border/50" />
                <div className="h-8 flex-1 rounded-md bg-muted/50 border border-border/50" />
                <div className="h-8 flex-1 rounded-md bg-muted/50 border border-border/50" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})

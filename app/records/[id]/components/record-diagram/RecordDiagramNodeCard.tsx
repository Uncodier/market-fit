"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import Image from "next/image"
import { Button } from "@/app/components/ui/button"
import { Card } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { FileText, Trash2, X } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import {
  RECORD_NODE_PORTS,
  type RecordDiagramNode,
  type RecordNodeBorderWidth,
  type RecordNodeColor,
  type RecordNodeKind,
  type RecordNodePort,
} from "@/app/records/lib/record-diagram"
import {
  getRecordDiagramNodeSize,
  getRecordDiagramNodeTextHeight,
} from "./record-diagram-layout"
import { RecordDiagramNodeOptions } from "./RecordDiagramNodeOptions"
import { RecordNodeMarkdownPreview } from "./RecordNodeMarkdownPreview"

const FRAME_COLOR_CLASSES: Record<RecordNodeColor, string> = {
  neutral: "bg-foreground/20",
  blue: "bg-blue-500/45",
  green: "bg-emerald-500/45",
  amber: "bg-amber-500/50",
  rose: "bg-rose-500/45",
  violet: "bg-violet-500/45",
}

const FILL_COLOR_CLASSES: Record<RecordNodeColor, string> = {
  neutral: "bg-card",
  blue: "bg-blue-50 dark:bg-blue-950",
  green: "bg-emerald-50 dark:bg-emerald-950",
  amber: "bg-amber-50 dark:bg-amber-950",
  rose: "bg-rose-50 dark:bg-rose-950",
  violet: "bg-violet-50 dark:bg-violet-950",
}

const NODE_SHAPE_CLASSES: Record<RecordNodeKind, string> = {
  title: "rounded-xl",
  description: "rounded-xl",
  note: "[clip-path:polygon(0_0,92%_0,100%_13%,100%_100%,0_100%)]",
  concept: "rounded-3xl",
  question: "rounded-[50%]",
  decision: "[clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]",
  source: "[clip-path:polygon(0_0,100%_0,100%_88%,75%_97%,50%_88%,25%_97%,0_88%)] rounded-t-xl",
  process: "rounded-sm",
  data: "[clip-path:polygon(10%_0,100%_0,90%_100%,0_100%)]",
  database: "rounded-[50%/14%]",
  terminator: "rounded-full",
}

const NODE_CONTENT_CLASSES: Record<RecordNodeKind, string> = {
  title: "px-6",
  description: "px-6 py-2",
  note: "px-6 pb-10 pt-0",
  concept: "px-6 pb-10 pt-0",
  question: "px-12 pb-11 pt-1 text-center",
  decision: "px-24 pb-16 pt-4 text-center",
  source: "px-7 pb-9 pt-0",
  process: "px-7 pb-10 pt-0",
  data: "px-12 pb-10 pt-0",
  database: "px-12 pb-11 pt-1 text-center",
  terminator: "px-12 pb-10 pt-0 text-center",
}

const BORDER_INSET_CLASSES: Record<RecordNodeBorderWidth, string> = {
  thin: "inset-px",
  medium: "inset-[2px]",
  thick: "inset-1",
}

const PORT_POSITION_STYLES: Record<RecordNodePort, CSSProperties> = {
  top: { left: "50%", top: -12, transform: "translateX(-50%)" },
  right: { right: -12, top: "50%", transform: "translateY(-50%)" },
  bottom: { bottom: -12, left: "50%", transform: "translateX(-50%)" },
  left: { left: -12, top: "50%", transform: "translateY(-50%)" },
}

interface RecordDiagramNodeCardProps {
  node: RecordDiagramNode
  selected: boolean
  connecting: boolean
  activeConnectionPort?: RecordNodePort | null
  onSelect: (additive?: boolean) => void
  onMouseDown: (event: React.MouseEvent) => void
  onChange: (patch: Partial<RecordDiagramNode>) => void
  onContentFocus?: (element: HTMLTextAreaElement) => void
  onContentBlur?: () => void
  onDelete: () => void
  onConnector: (port: RecordNodePort) => void
}

export function RecordDiagramNodeCard({
  node,
  selected,
  connecting,
  activeConnectionPort,
  onSelect,
  onMouseDown,
  onChange,
  onContentFocus,
  onContentBlur,
  onDelete,
  onConnector,
}: RecordDiagramNodeCardProps) {
  const color = node.metadata.visual?.color || "neutral"
  const borderColor = node.metadata.visual?.borderColor || color
  const borderWidth = node.metadata.visual?.borderWidth || "medium"
  const minimal = node.kind === "title" || node.kind === "description"
  const size = getRecordDiagramNodeSize(node)
  const textHeight = getRecordDiagramNodeTextHeight(node)
  const attachments = node.metadata.attachments || []
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const [isEditingContent, setIsEditingContent] = useState(false)
  useEffect(() => {
    if (!selected) setIsEditingContent(false)
  }, [selected])
  useEffect(() => {
    if (isEditingContent) contentRef.current?.focus()
  }, [isEditingContent])
  const removeAttachment = (attachmentId: string) => {
    onChange({
      metadata: {
        ...node.metadata,
        attachments: attachments.filter((attachment) => attachment.id !== attachmentId),
      },
    })
  }

  return (
    <Card
      data-node-kind={node.kind}
      className="group relative flex cursor-grab flex-col overflow-visible border-0 bg-transparent shadow-none active:cursor-grabbing"
      style={size}
      onMouseDown={onMouseDown}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(event.shiftKey || event.metaKey || event.ctrlKey)
      }}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 drop-shadow-[0_4px_10px_rgba(0,0,0,0.08)]",
          NODE_SHAPE_CLASSES[node.kind],
          selected || connecting
            ? "bg-primary"
            : minimal
              ? "bg-transparent drop-shadow-none"
              : FRAME_COLOR_CLASSES[borderColor]
        )}
      >
        <div
          className={cn(
            "absolute",
            BORDER_INSET_CLASSES[borderWidth],
            NODE_SHAPE_CLASSES[node.kind],
            minimal && !selected && !connecting ? "bg-transparent" : FILL_COLOR_CLASSES[color]
          )}
        />
      </div>
      <div
        className="absolute -right-1.5 -top-9 z-30 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <RecordDiagramNodeOptions node={node} onChange={onChange} onOpen={onSelect} />
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full p-0 shadow-md [&_svg]:size-3"
          aria-label={`Delete ${node.title}`}
          title="Delete node"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {RECORD_NODE_PORTS.map((port) => {
        const active = connecting && activeConnectionPort === port
        return (
          <button
            key={port}
            type="button"
            aria-label={`Connector ${port} for ${node.title}`}
            title={connecting ? "Change relation origin" : "Start or complete relation"}
            className={cn(
              "absolute z-20 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-background transition-colors hover:border-primary",
              active ? "border-primary" : "border-muted-foreground",
              minimal && !selected && !connecting ? "opacity-0 group-hover:opacity-100" : ""
            )}
            style={PORT_POSITION_STYLES[port]}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onConnector(port)
            }}
          >
            <span className={cn(
              "pointer-events-none h-1.5 w-1.5 rounded-full",
              active ? "bg-primary" : "bg-muted-foreground"
            )} />
          </button>
        )
      })}

      <div className={cn(
        "absolute inset-0 z-10 flex min-h-0 flex-col justify-center gap-1",
        NODE_CONTENT_CLASSES[node.kind],
        node.kind === "title" ? "overflow-visible" : "overflow-hidden",
      )} style={node.kind === "title" ? {
        alignItems: "center",
        bottom: 0,
        flexDirection: "row",
        left: 0,
        position: "absolute",
        right: 0,
        top: 0,
      } : undefined}>
        {node.kind !== "description" && (
          <Input
            value={node.title}
            maxLength={240}
            aria-label="Node title"
            className={cn(
              "h-9 shrink-0 border-0 bg-transparent px-0 py-0 font-semibold shadow-none focus-visible:ring-0",
              node.kind === "title"
                ? "-translate-y-4 text-2xl leading-[2.25rem]"
                : "text-base leading-[2.25rem]",
            )}
            onChange={(event) => onChange({ title: event.target.value })}
            onBlur={() => {
              if (!node.title.trim()) onChange({ title: "Untitled" })
            }}
          />
        )}
        {node.kind !== "title" && isEditingContent && (
          <Textarea
            ref={contentRef}
            value={node.content}
            maxLength={12_000}
            aria-label="Node content"
            placeholder="Add the semantic content agents should understand..."
            className={cn(
              "min-h-0 flex-none resize-none rounded-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0",
              node.kind === "description" ? "text-base" : "text-sm",
            )}
            style={{ minHeight: 20, height: textHeight }}
            onFocus={(event) => onContentFocus?.(event.currentTarget)}
            onBlur={() => {
              setIsEditingContent(false)
              onContentBlur?.()
            }}
            onChange={(event) => onChange({ content: event.target.value })}
          />
        )}
        {node.kind !== "title" && !isEditingContent && (
          <RecordNodeMarkdownPreview
            markdown={node.content}
            showPlaceholder={selected}
            onEdit={() => {
              onSelect(false)
              setIsEditingContent(true)
            }}
          />
        )}
        {!minimal && attachments.length > 0 && (
          <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group/attachment relative flex h-14 min-w-14 max-w-40 items-center overflow-hidden rounded-xl border bg-background/80"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-xs"
                  title={attachment.name}
                >
                  {attachment.kind === "image" ? (
                    <Image
                      src={attachment.url}
                      alt={attachment.name}
                      width={56}
                      height={56}
                      unoptimized
                      className="h-14 w-14 object-cover"
                    />
                  ) : (
                    <>
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{attachment.name}</span>
                    </>
                  )}
                </a>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-1 top-1 h-5 w-5 rounded-full opacity-0 shadow-sm group-hover/attachment:opacity-100"
                  aria-label={`Remove ${attachment.name}`}
                  onClick={() => removeAttachment(attachment.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

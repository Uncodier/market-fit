"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { FileText, ImageIcon, MoreHorizontal } from "@/app/components/ui/icons"
import { ScreenAnchoredPanel } from "@/app/components/ui/screen-anchored-panel"
import {
  RECORD_NODE_COLORS,
  RECORD_NODE_BORDER_WIDTHS,
  RECORD_NODE_KINDS,
  formatRecordNodeKind,
  type RecordDiagramNode,
  type RecordNodeBorderWidth,
  type RecordNodeColor,
} from "@/app/records/lib/record-diagram"
import {
  MAX_RECORD_NODE_ATTACHMENTS,
  uploadRecordNodeAttachment,
} from "./record-node-attachments"

const COLOR_LABELS: Record<RecordNodeColor, string> = {
  neutral: "Neutral",
  blue: "Blue",
  green: "Green",
  amber: "Amber",
  rose: "Rose",
  violet: "Violet",
}

const COLOR_DOT_CLASSES: Record<RecordNodeColor, string> = {
  neutral: "bg-muted-foreground",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
}

const BORDER_WIDTH_LABELS: Record<RecordNodeBorderWidth, string> = {
  thin: "Thin",
  medium: "Medium",
  thick: "Thick",
}

const BORDER_WIDTH_PIXELS: Record<RecordNodeBorderWidth, number> = {
  thin: 1,
  medium: 2,
  thick: 4,
}

type RecordDiagramNodeOptionsProps = {
  node: RecordDiagramNode
  onChange: (patch: Partial<RecordDiagramNode>) => void
  onOpen: () => void
}

export function RecordDiagramNodeOptions({
  node,
  onChange,
  onOpen,
}: RecordDiagramNodeOptionsProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  const visual: NonNullable<RecordDiagramNode["metadata"]["visual"]> = node.metadata.visual || {
    color: "neutral",
    shape: "rounded",
    borderWidth: "medium",
  }

  useEffect(() => {
    if (!menuOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        !menuRef.current?.contains(target)
        && !triggerRef.current?.contains(target)
      ) setMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer)
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer)
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [menuOpen])

  const updateVisual = (patch: Partial<typeof visual>) => {
    onChange({
      metadata: {
        ...node.metadata,
        visual: { ...visual, ...patch },
      },
    })
  }

  const upload = async (file: File | undefined, kind: "image" | "file") => {
    if (!file) return
    const attachments = node.metadata.attachments || []
    if (attachments.length >= MAX_RECORD_NODE_ATTACHMENTS) {
      toast.error(`A node can contain up to ${MAX_RECORD_NODE_ATTACHMENTS} attachments`)
      return
    }

    setIsUploading(true)
    try {
      const attachment = await uploadRecordNodeAttachment(file, kind)
      onChange({
        metadata: {
          ...node.metadata,
          attachments: [...attachments, attachment],
        },
      })
      toast.success(kind === "image" ? "Image attached" : "File attached")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setIsUploading(false)
      if (imageInputRef.current) imageInputRef.current.value = ""
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0], "image")}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0], "file")}
      />
      <div
        ref={triggerRef}
        className="relative"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background p-0 text-foreground shadow-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Options for ${node.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(event) => {
            onOpen()
            setMenuAnchor({ x: event.clientX, y: event.clientY })
            setMenuOpen((open) => !open)
          }}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
      {menuOpen && menuAnchor && (
        <ScreenAnchoredPanel anchor={menuAnchor} alignY="center">
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Node options for ${node.title}`}
            className="max-h-[calc(100vh-1rem)] w-56 overflow-y-auto rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="px-2 pb-1 pt-0.5 text-xs font-medium text-muted-foreground">Type</p>
            <div role="group" className="grid grid-cols-2 gap-1">
              {RECORD_NODE_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="menuitemradio"
                  aria-checked={node.kind === kind}
                  className={menuItemClass(node.kind === kind)}
                  onClick={() => {
                    onChange({ kind })
                    setMenuOpen(false)
                  }}
                >
                  {formatRecordNodeKind(kind)}
                </button>
              ))}
            </div>
            <div className="my-2 h-px bg-border" />
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Fill color</p>
            <div role="group" className="grid grid-cols-3 gap-1">
              {RECORD_NODE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="menuitemradio"
                  aria-checked={visual.color === color}
                  aria-label={COLOR_LABELS[color]}
                  title={COLOR_LABELS[color]}
                  className={menuItemClass(visual.color === color, "justify-center")}
                  onClick={() => {
                    updateVisual({ color })
                    setMenuOpen(false)
                  }}
                >
                  <span className={`h-3 w-3 rounded-full ${COLOR_DOT_CLASSES[color]}`} />
                </button>
              ))}
            </div>
            <div className="my-2 h-px bg-border" />
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Border color</p>
            <div role="group" aria-label="Border color" className="grid grid-cols-3 gap-1">
              {RECORD_NODE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="menuitemradio"
                  aria-checked={(visual.borderColor || visual.color) === color}
                  aria-label={`Border ${COLOR_LABELS[color]}`}
                  title={`Border ${COLOR_LABELS[color]}`}
                  className={menuItemClass(
                    (visual.borderColor || visual.color) === color,
                    "justify-center",
                  )}
                  onClick={() => updateVisual({ borderColor: color })}
                >
                  <span className={`h-3 w-3 rounded-full ${COLOR_DOT_CLASSES[color]}`} />
                </button>
              ))}
            </div>
            <p className="mt-2 px-2 pb-1 text-xs font-medium text-muted-foreground">Border thickness</p>
            <div role="group" aria-label="Border thickness" className="grid grid-cols-3 gap-1">
              {RECORD_NODE_BORDER_WIDTHS.map((width) => (
                <button
                  key={width}
                  type="button"
                  role="menuitemradio"
                  aria-checked={(visual.borderWidth || "medium") === width}
                  aria-label={BORDER_WIDTH_LABELS[width]}
                  title={BORDER_WIDTH_LABELS[width]}
                  className={menuItemClass((visual.borderWidth || "medium") === width, "justify-center")}
                  onClick={() => updateVisual({ borderWidth: width })}
                >
                  <span
                    aria-hidden="true"
                    className="w-9 rounded-full bg-current"
                    style={{ height: BORDER_WIDTH_PIXELS[width] }}
                  />
                </button>
              ))}
            </div>
            {node.kind !== "title" && node.kind !== "description" && (
              <>
                <div className="my-2 h-px bg-border" />
                <button
                  type="button"
                  role="menuitem"
                  disabled={isUploading}
                  className={menuItemClass(false, "w-full")}
                  onClick={() => {
                    setMenuOpen(false)
                    imageInputRef.current?.click()
                  }}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Upload image
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isUploading}
                  className={menuItemClass(false, "mt-1 w-full")}
                  onClick={() => {
                    setMenuOpen(false)
                    fileInputRef.current?.click()
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {isUploading ? "Uploading..." : "Attach file"}
                </button>
              </>
            )}
          </div>
        </ScreenAnchoredPanel>
      )}
    </>
  )
}

function menuItemClass(selected: boolean, extra = "") {
  return [
    "flex min-h-8 items-center rounded-md px-2 text-left text-xs transition-colors",
    "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
    "disabled:pointer-events-none disabled:opacity-50",
    selected ? "bg-accent font-medium text-accent-foreground" : "",
    extra,
  ].join(" ")
}

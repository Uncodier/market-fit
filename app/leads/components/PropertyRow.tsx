"use client"

import React, { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Check, X, Copy, ExternalLink } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function hasPropertyValue(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === "string") return value.trim() !== ""
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(hasPropertyValue)
  }
  return true
}

interface PropertyRowProps<T = string> {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  empty?: boolean
  showEmpty?: boolean
  copyValue?: string
  linkHref?: string
  editValue?: T
  onCommit?: (value: T) => Promise<void>
  renderEditor?: (draft: T, setDraft: (value: T) => void) => React.ReactNode
  saveOnEnter?: boolean
  readOnly?: boolean
  multiline?: boolean
  className?: string
}

export function PropertyRow<T = string>({
  icon,
  label,
  value,
  empty = false,
  showEmpty = false,
  copyValue,
  linkHref,
  editValue,
  onCommit,
  renderEditor,
  saveOnEnter = true,
  readOnly = false,
  multiline = false,
  className,
}: PropertyRowProps<T>) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<T>(editValue as T)
  const [saving, setSaving] = useState(false)

  const canEdit = Boolean(onCommit && renderEditor && !readOnly)

  if (empty && !showEmpty && !editing) return null

  const startEdit = () => {
    if (!canEdit) return
    setDraft(editValue as T)
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setDraft(editValue as T)
  }

  const save = async () => {
    if (!onCommit) return
    setSaving(true)
    try {
      await onCommit(draft)
      setEditing(false)
    } catch (error) {
      console.error(error)
      toast.error("Could not save field")
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation()
    if (!copyValue) return
    await navigator.clipboard.writeText(copyValue)
    toast.success("Copied")
  }

  const handleLink = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (linkHref) window.open(linkHref, "_blank")
  }

  return (
    <div className={cn("group flex items-start gap-2.5 min-h-8 py-1 min-w-0", className)}>
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </div>
      <div className="w-[92px] shrink-0 pt-0.5">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div
            className="flex items-start gap-1"
            onKeyDown={(event) => {
              if (saveOnEnter && event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void save()
              }
              if (event.key === "Escape") cancel()
            }}
          >
            <div className="flex-1 min-w-0">{renderEditor?.(draft, setDraft)}</div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => void save()}
              disabled={saving}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={cancel}
              disabled={saving}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              "flex items-center gap-1 min-w-0 rounded-md px-1 -mx-1 py-0.5",
              canEdit && "cursor-text hover:bg-muted/60"
            )}
            onClick={startEdit}
          >
            <div
              className={cn(
                "flex-1 min-w-0 text-sm",
                multiline ? "whitespace-pre-wrap break-words" : "truncate",
                empty && "text-muted-foreground italic"
              )}
              title={typeof value === "string" ? value : undefined}
            >
              {empty ? "Not specified" : value}
            </div>
            {(copyValue || linkHref) && (
              <div className="flex shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {copyValue && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleCopy}>
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
                {linkHref && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleLink}>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function ShowEmptyFieldsToggle({
  showEmpty,
  onToggle,
  hiddenCount,
}: {
  showEmpty: boolean
  onToggle: () => void
  hiddenCount: number
}) {
  if (showEmpty) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="text-xs text-muted-foreground hover:text-foreground mt-2"
      >
        Hide empty fields
      </button>
    )
  }

  if (hiddenCount <= 0) return null

  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-xs text-muted-foreground hover:text-foreground mt-2"
    >
      Show {hiddenCount} empty field{hiddenCount === 1 ? "" : "s"}
    </button>
  )
}

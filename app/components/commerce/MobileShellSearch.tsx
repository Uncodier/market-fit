"use client"

import { useEffect, useRef } from "react"
import { Search, X } from "@/app/components/ui/icons"
import { shellClasses } from "@/app/components/commerce/CommerceShellHeader"

type ExpandedProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Compact control in the header center on mobile. Fills available width; shrinks to icon-only. */
export function MobileShellSearchTrigger({
  value,
  label,
  onOpen,
}: {
  value: string
  label: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      // !important: globals.css forces Safari buttons to justify-center + inline-flex
      className="relative !flex !w-full !justify-start items-center gap-2 h-9 min-w-9 max-w-full pl-2.5 pr-2 rounded-full bg-muted/50 border border-transparent text-left overflow-hidden transition-colors hover:bg-muted/80"
      aria-label={label}
    >
      <Search className="h-3.5 w-3.5 text-muted-foreground pointer-events-none shrink-0 !m-0 !static" />
      <span className="truncate text-xs text-muted-foreground capitalize min-w-0 flex-1 text-left">
        {value || label}
      </span>
      {value ? (
        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
      ) : null}
    </button>
  )
}

/** Full-width search that replaces the mobile header contents. */
export function MobileShellSearchExpanded({
  value,
  onChange,
  placeholder,
  open,
  onOpenChange,
}: ExpandedProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 10)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className={shellClasses.iconButton}
        aria-label="Close search"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-[1]" />
        <input
          ref={inputRef}
          id="mobile-search-input"
          type="text"
          inputMode="search"
          enterKeyHint="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onOpenChange(false)
            }
          }}
          className="w-full pl-10 pr-3 h-9 text-sm bg-muted/50 focus:bg-white dark:focus:bg-gray-950 border border-transparent focus:border-black/10 dark:focus:border-white/10 rounded-full transition-all outline-none"
        />
      </div>
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="shrink-0 h-9 px-3 rounded-full text-sm font-semibold text-slate-900 dark:text-white hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
      >
        OK
      </button>
    </>
  )
}

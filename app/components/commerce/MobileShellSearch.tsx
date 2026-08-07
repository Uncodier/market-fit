"use client"

import { useEffect, useRef, useState } from "react"
import { Search, X } from "@/app/components/ui/icons"
import { shellClasses } from "@/app/components/commerce/CommerceShellHeader"

/** Min center width before the compact bar relocates as an icon on the right. */
const COMPACT_SEARCH_MIN_PX = 112

type ExpandedProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * True when the header center cannot host a usable compact search bar.
 * Measures: header − brand content − actions-core − gaps.
 * Pass `initialCollapsed` (e.g. !session) to avoid a flash before the first measure.
 */
export function useMobileShellSearchCollapsed(initialCollapsed = false) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    let ro: ResizeObserver | null = null

    const measure = () => {
      if (!mq.matches) {
        setCollapsed(false)
        return
      }

      const header = document.querySelector<HTMLElement>("[data-commerce-shell-header]")
      if (!header) return

      const brand = header.querySelector<HTMLElement>("[data-commerce-shell-brand]")
      const actionsCore = header.querySelector<HTMLElement>("[data-commerce-shell-actions-core]")
      if (!brand || !actionsCore) return

      if (!ro) {
        ro = new ResizeObserver(measure)
        ro.observe(header)
        ro.observe(brand)
        ro.observe(actionsCore)
      }

      const headerStyles = window.getComputedStyle(header)
      const padX =
        (parseFloat(headerStyles.paddingLeft) || 0) +
        (parseFloat(headerStyles.paddingRight) || 0)
      const brandContent = brand.firstElementChild as HTMLElement | null
      const brandW = Math.ceil(
        (brandContent ?? brand).getBoundingClientRect().width
      )
      const actionsW = Math.ceil(actionsCore.getBoundingClientRect().width)
      const headerW = Math.ceil(header.getBoundingClientRect().width)
      // gaps between the three columns + center horizontal padding
      const gaps = 18
      const available = headerW - padX - brandW - actionsW - gaps

      setCollapsed((prev) => {
        const next = available < COMPACT_SEARCH_MIN_PX
        return prev === next ? prev : next
      })
    }

    measure()
    mq.addEventListener("change", measure)
    window.addEventListener("resize", measure)

    return () => {
      ro?.disconnect()
      mq.removeEventListener("change", measure)
      window.removeEventListener("resize", measure)
    }
  }, [initialCollapsed])

  return collapsed
}

/** Compact control in the header center on mobile. Fills available width. */
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

/** Icon-only search for the right actions cluster when the center bar does not fit. */
export function MobileShellSearchIconButton({
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
      className={`md:hidden relative ${shellClasses.iconButton} !bg-muted/50 hover:!bg-muted/80`}
      aria-label={label}
    >
      <Search className="h-4 w-4" />
      {value ? (
        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
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

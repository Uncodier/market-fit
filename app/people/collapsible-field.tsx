'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from '@/app/components/ui/icons'

interface CollapsibleFieldProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  countBadge?: number
  onClear?: () => void
  onOpenChange?: (open: boolean) => void
}

export function CollapsibleField({ title, children, defaultOpen = true, countBadge, onClear, onOpenChange }: CollapsibleFieldProps) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => {
    setOpen(defaultOpen)
  }, [defaultOpen])
  const handleToggle = () => {
    const newOpen = !open
    setOpen(newOpen)
    onOpenChange?.(newOpen)
  }
  return (
    <div className="rounded-lg border border-border/30 bg-muted/40 transition-colors hover:bg-muted/70 hover:border-border">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {typeof countBadge === "number" && countBadge > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-xs rounded-full border border-border/40 px-2 py-0.5 text-muted-foreground bg-background/60">
                {countBadge}
              </span>
              {onClear && (
                <button
                  type="button"
                  className="text-xs rounded-full border border-border/40 px-2 py-0.5 text-muted-foreground hover:bg-muted"
                  onClick={(e) => { e.stopPropagation(); onClear() }}
                  aria-label={`Clear ${title}`}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      {open && (
        <div className="px-4 py-3 border-t border-border/30 bg-background/40">
          {children}
        </div>
      )}
    </div>
  )
}
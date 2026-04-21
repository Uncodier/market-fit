"use client"

import * as React from "react"
import { ChevronDown, Search } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover"
import { Input } from "@/app/components/ui/input"
import {
  IMPRENTA_CONTEXT_RELATION_GROUPS,
  getContextRelationLabel,
  type ImprentaContextRelationGroup,
} from "@/app/components/agents/imprenta-publish-context"

interface ImprentaContextTypeSelectProps {
  value: string
  onValueChange: (value: string) => void
  groups?: ImprentaContextRelationGroup[]
  className?: string
  contentClassName?: string
  placeholder?: string
}

/**
 * Searchable picker for the context-edge `type` field. Shows the grouped
 * catalogue of relation types and lets the user commit a free-form label
 * (trimmed) when none of the presets fit.
 */
export function ImprentaContextTypeSelect({
  value,
  onValueChange,
  groups = IMPRENTA_CONTEXT_RELATION_GROUPS,
  className,
  contentClassName,
  placeholder = "Type",
}: ImprentaContextTypeSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    setQuery("")
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  const trimmed = query.trim()
  const lower = trimmed.toLowerCase()

  const filteredGroups = React.useMemo(() => {
    if (!lower) return groups
    return groups
      .map((g) => ({
        ...g,
        options: g.options.filter(
          (o) =>
            o.label.toLowerCase().includes(lower) ||
            o.value.toLowerCase().includes(lower)
        ),
      }))
      .filter((g) => g.options.length > 0)
  }, [groups, lower])

  // Custom value = what we persist to `instance_node_contexts.type`. We keep
  // the user's casing/spacing so `getContextRelationLabel` can render it back
  // verbatim (e.g. "Hero Closeup" or "product beauty shot").
  const customValue = trimmed
  const existingLabelMatch = groups.some((g) =>
    g.options.some(
      (o) =>
        o.label.toLowerCase() === lower || o.value.toLowerCase() === lower
    )
  )
  const canCommitCustom = trimmed.length > 0 && !existingLabelMatch

  const displayLabel = getContextRelationLabel(value) || placeholder

  const commit = (val: string) => {
    if (!val) return
    onValueChange(val)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const firstOpt = filteredGroups[0]?.options[0]
      if (firstOpt) commit(firstOpt.value)
      else if (canCommitCustom) commit(customValue)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-7 w-[140px] items-center justify-between gap-1 rounded-md border-0 bg-transparent px-2 text-xs font-inter text-left outline-none focus:ring-0 hover:bg-muted/60 transition-colors",
            className
          )}
        >
          <span className="truncate min-w-0">{displayLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-60 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn("p-0 w-[220px] font-inter", contentClassName)}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <div className="flex items-center gap-2 border-b px-2 py-1.5">
          <Search className="h-3.5 w-3.5 opacity-50 flex-shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or type custom..."
            className="h-7 border-0 shadow-none focus-visible:ring-0 px-0 text-xs font-inter"
          />
        </div>
        <div className="max-h-[260px] overflow-y-auto">
          {filteredGroups.length === 0 && !canCommitCustom ? (
            <div className="py-4 px-2 text-center text-xs text-muted-foreground">
              No matches
            </div>
          ) : (
            <div className="py-1">
              {filteredGroups.map((g) => (
                <div key={g.label} className="mb-1 last:mb-0">
                  <div className="px-2 pt-1.5 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </div>
                  {g.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={cn(
                        "flex w-full items-center rounded-sm px-2 py-1.5 text-xs text-left outline-none font-inter hover:bg-accent hover:text-accent-foreground",
                        value === opt.value && "bg-accent/50 text-accent-foreground"
                      )}
                      onClick={() => commit(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          {canCommitCustom && (
            <div className={cn("py-1", filteredGroups.length > 0 && "border-t")}>
              <button
                type="button"
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs leading-none text-left outline-none font-inter hover:bg-accent hover:text-accent-foreground"
                onClick={() => commit(customValue)}
              >
                <span className="text-muted-foreground">Use</span>
                <span className="font-medium truncate">&ldquo;{trimmed}&rdquo;</span>
                <span className="ml-auto text-[10px] text-muted-foreground">Enter</span>
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

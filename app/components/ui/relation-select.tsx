"use client"

import * as React from "react"
import { ChevronDown, X, Plus } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover"
import { Input } from "@/app/components/ui/input"
import { Skeleton } from "@/app/components/ui/skeleton"

export type RelationSelectValue =
  | { mode: "existing"; id: string; label: string }
  | { mode: "create"; label: string }
  | null

export interface RelationSelectOption {
  id: string
  label: string
  searchText?: string
}

interface RelationSelectProps {
  options: RelationSelectOption[]
  value: RelationSelectValue
  onValueChange: (value: RelationSelectValue) => void
  allowCreate?: boolean
  /**
   * Picker mode: after selecting (or creating), clear the input and do not keep
   * a committed value in the field. Useful for multi-select filters that own
   * selection as chips outside this control.
   */
  clearAfterSelect?: boolean
  placeholder?: string
  emptyMessage?: string
  className?: string
  clearable?: boolean
  disabled?: boolean
  searchPlaceholder?: string
  label?: string
  icon?: React.ReactNode
  /** Renders inside the input on the right (before clear/chevron). */
  endAction?: React.ReactNode
  createLabel?: (query: string) => string
}

export function RelationSelect({
  options,
  value,
  onValueChange,
  allowCreate = true,
  clearAfterSelect = false,
  placeholder = "Select option...",
  emptyMessage = "No results found",
  className,
  clearable = true,
  disabled = false,
  searchPlaceholder = "Search...",
  label,
  icon,
  endAction,
  createLabel = (q) => `Use "${q}"`
}: RelationSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options
    const lowerCaseQuery = searchQuery.toLowerCase()
    return options.filter(option =>
      (option.searchText ?? option.label).toLowerCase().includes(lowerCaseQuery)
    )
  }, [options, searchQuery])

  const exactMatch = React.useMemo(() => {
    return options.find(o => o.label.toLowerCase() === searchQuery.trim().toLowerCase())
  }, [options, searchQuery])

  const showCreate = allowCreate && searchQuery.trim().length > 0 && !exactMatch

  // Existing selection whose display name is still resolving — show skeleton, not "Loading..." / blank.
  // Empty label only counts as pending while options have not loaded yet (avoids stuck skeleton
  // when the referenced entity was deleted).
  const isResolvingLabel =
    value?.mode === "existing" &&
    (value.label === "Loading..." ||
      (value.label.trim() === "" && options.length === 0))

  const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onValueChange(null)
    setSearchQuery("")
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchQuery(newValue)
    if (!open) setOpen(true)
  }

  const handleSelectExisting = (option: RelationSelectOption) => {
    onValueChange({ mode: "existing", id: option.id, label: option.label })
    if (clearAfterSelect) {
      setSearchQuery("")
    } else {
      setSearchQuery(option.label)
    }
    setOpen(false)
  }

  const handleSelectCreate = () => {
    if (!searchQuery.trim()) return
    onValueChange({ mode: "create", label: searchQuery.trim() })
    if (clearAfterSelect) {
      setSearchQuery("")
    }
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (filteredOptions.length > 0) {
        handleSelectExisting(filteredOptions[0])
      } else if (showCreate) {
        handleSelectCreate()
      }
    }
  }

  // Sync internal search query if external value changes (like form reset).
  // In picker mode the parent often keeps value=null; avoid wiping in-progress typing.
  React.useEffect(() => {
    if (clearAfterSelect) {
      if (value) {
        setSearchQuery("")
      }
      return
    }
    if (!value) {
      setSearchQuery("")
    } else if (value.label === "Loading..." || value.label.trim() === "") {
      setSearchQuery("")
    } else {
      setSearchQuery(value.label)
    }
  }, [value, clearAfterSelect])

  return (
    <div className={cn("w-full", label ? "space-y-2" : "")}>
      {label && (
        <label className="text-sm font-medium">{label}</label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative w-full">
            {isResolvingLabel && !open ? (
              <Skeleton
                className={cn("h-10 w-full rounded-md cursor-pointer", className)}
                aria-label="Loading selection"
                onClick={() => setOpen(true)}
              />
            ) : (
              <>
                <Input
                  ref={inputRef}
                  value={isResolvingLabel ? "" : searchQuery}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  disabled={disabled}
                  className={cn(
                    "w-full font-inter cursor-pointer",
                    endAction ? "pr-28" : "pr-9",
                    icon && "pl-9",
                    className
                  )}
                  onClick={() => setOpen(true)}
                />
                {icon && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-muted-foreground">
                    {icon}
                  </div>
                )}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {endAction && (
                    <div
                      className="flex items-center"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {endAction}
                    </div>
                  )}
                  {clearable && !clearAfterSelect && value && !disabled && !isResolvingLabel && (
                    <button
                      type="button"
                      className="h-3.5 w-3.5 flex items-center justify-center rounded-full font-inter text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
                      onClick={handleClear}
                      aria-label="Clear selection"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden={true} />
                </div>
              </>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="p-1 w-[var(--radix-popover-trigger-width)] max-h-[300px] z-[1000000] font-inter overflow-auto" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {filteredOptions.length > 0 ? (
            <div className="pb-1">
              {filteredOptions.map((option) => (
                <div
                  key={option.id}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm font-inter outline-none hover:bg-accent hover:text-accent-foreground transition-colors",
                    value?.mode === "existing" && value.id === option.id && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => handleSelectExisting(option)}
                >
                  {option.label}
                </div>
              ))}
            </div>
          ) : !showCreate ? (
            <div className="py-6 text-center text-sm font-inter text-muted-foreground">{emptyMessage}</div>
          ) : null}

          {showCreate && (
            <>
              {filteredOptions.length > 0 && <div className="h-px bg-border my-1" />}
              <div
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm font-inter outline-none hover:bg-accent hover:text-accent-foreground transition-colors text-primary"
                onClick={handleSelectCreate}
              >
                <Plus className="h-3.5 w-3.5 mr-2" />
                {createLabel(searchQuery.trim())}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

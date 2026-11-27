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
import {
  filterRelationSelectOptions,
  shouldFilterRelationSelectOptions,
} from "@/app/components/ui/relation-select-filter"

export type RelationSelectValue =
  | { mode: "existing"; id: string; label: string }
  | { mode: "create"; label: string }
  | null

export interface RelationSelectOption {
  id: string
  label: string
  description?: string
  disabled?: boolean
  searchText?: string
  /** Optional dropdown section label; consecutive options with the same group share one header. */
  group?: string
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
  clearLabel?: string
  loadingLabel?: string
  label?: string
  icon?: React.ReactNode
  /** Optional visual representation of the committed selection when not browsing. */
  selectedAdornment?: React.ReactNode
  /** Renders inside the input on the right (before clear/chevron). */
  endAction?: React.ReactNode
  createLabel?: (query: string) => string
  /** Always-visible action at the top of the dropdown (e.g. New Order). */
  pinnedAction?: {
    label: string
    selected?: boolean
    onSelect: () => void
  }
  onSearchChange?: (query: string) => void
  /** Reports every manual text edit, including retyping the selected label. */
  onInputValueChange?: (query: string) => void
  /** Keep focus on the input while interacting with portalled options. */
  keepInputFocus?: boolean
  openOnFocus?: boolean
}

export function RelationSelect({
  options: rawOptions,
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
  clearLabel = "Clear selection",
  loadingLabel = "Loading selection",
  label,
  icon,
  selectedAdornment,
  endAction,
  createLabel = (q) => `Use "${q}"`,
  pinnedAction,
  onSearchChange,
  onInputValueChange,
  keepInputFocus = false,
  openOnFocus = false,
}: RelationSelectProps) {
  const options = rawOptions || []
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const inputId = React.useId()
  const listId = `${inputId}-options`
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null)
  if (disabled && open) setOpen(false)

  const selectedLabel = value?.label
  const collapsedAdornment = !open && value && selectedAdornment
  const isBrowseQuery = !shouldFilterRelationSelectOptions(
    searchQuery,
    selectedLabel,
  )

  const filteredOptions = React.useMemo(
    () => filterRelationSelectOptions(options, searchQuery, selectedLabel),
    [options, searchQuery, selectedLabel],
  )
  const highlightedIndex = filteredOptions.findIndex(option => option.id === highlightedId)

  const exactMatch = React.useMemo(() => {
    return options.find(o => o?.label?.toLowerCase() === searchQuery.trim().toLowerCase())
  }, [options, searchQuery])

  const showCreate =
    allowCreate &&
    !isBrowseQuery &&
    searchQuery.trim().length > 0 &&
    !exactMatch

  // Existing selection whose display name is still resolving — show skeleton, not "Loading..." / blank.
  // Empty label only counts as pending while options have not loaded yet (avoids stuck skeleton
  // when the referenced entity was deleted).
  const isResolvingLabel =
    value?.mode === "existing" &&
    (value?.label === "Loading..." ||
      (value?.label?.trim() === "" && options.length === 0))

  const notifySearchChange = (query: string) => {
    if (!onSearchChange) return
    if (selectedLabel && query === selectedLabel) return
    onSearchChange(query)
  }

  const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (disabled) return
    onValueChange(null)
    setSearchQuery("")
    onSearchChange?.("")
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    const newValue = e.target.value
    setSearchQuery(newValue)
    setHighlightedId(null)
    onInputValueChange?.(newValue)
    notifySearchChange(newValue)
    if (!open) setOpen(true)
  }

  const handleSelectExisting = (option: RelationSelectOption) => {
    if (disabled || option.disabled) return
    onValueChange({ mode: "existing", id: option.id, label: option.label })
    if (clearAfterSelect) {
      setSearchQuery("")
    } else {
      setSearchQuery(option.label)
    }
    setOpen(false)
  }

  const handleSelectCreate = () => {
    if (disabled || !searchQuery.trim()) return
    onValueChange({ mode: "create", label: searchQuery.trim() })
    if (clearAfterSelect) {
      setSearchQuery("")
    }
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || e.nativeEvent.isComposing) return
    if (collapsedAdornment && (e.key === "Enter" || e.key === "ArrowDown")) {
      e.preventDefault()
      setOpen(true)
      requestAnimationFrame(() => inputRef.current?.select())
      return
    }
    if (openOnFocus && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault()
      setOpen(true)
      const indexes = filteredOptions.flatMap((option, index) => option.disabled ? [] : [index])
      if (!indexes.length) return
      const direction = e.key === "ArrowDown" ? 1 : -1
      const current = indexes.indexOf(highlightedIndex)
      const next = current === -1 ? (direction === 1 ? 0 : indexes.length - 1)
        : (current + direction + indexes.length) % indexes.length
      const index = indexes[next]
      setHighlightedId(filteredOptions[index].id)
      document.getElementById(`${listId}-${index}`)?.scrollIntoView?.({ block: "nearest" })
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      const option = filteredOptions[highlightedIndex] ?? filteredOptions.find(option => !option.disabled)
      if (option) {
        handleSelectExisting(option)
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
    } else if (value.label === "Loading..." || value.label?.trim() === "") {
      setSearchQuery("")
    } else {
      setSearchQuery(value.label || "")
    }
  }, [value, clearAfterSelect])

  return (
    <div className={cn("w-full min-w-0", label ? "space-y-2" : "")}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium">{label}</label>
      )}
      <Popover
        open={open && !disabled}
        onOpenChange={(next) => {
          if (disabled && next) return
          setOpen(next)
          if (next) {
            requestAnimationFrame(() => inputRef.current?.select())
          }
        }}
      >
        <PopoverTrigger asChild>
          <div className="relative w-full">
            {isResolvingLabel && !open ? (
              <Skeleton
                className={cn("h-10 w-full rounded-md cursor-pointer", className)}
                aria-label={loadingLabel}
                onClick={() => { if (!disabled) setOpen(true) }}
              />
            ) : (
              <>
                <Input
                  id={inputId}
                  role={openOnFocus ? "combobox" : undefined}
                  aria-expanded={openOnFocus ? open : undefined}
                  aria-controls={openOnFocus && open ? listId : undefined}
                  aria-autocomplete={openOnFocus ? "list" : undefined}
                  aria-description={collapsedAdornment ? selectedLabel : undefined}
                  aria-activedescendant={openOnFocus && open && highlightedIndex >= 0 ? `${listId}-${highlightedIndex}` : undefined}
                  ref={inputRef}
                  value={isResolvingLabel || collapsedAdornment ? "" : searchQuery}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={collapsedAdornment ? undefined : placeholder}
                  disabled={disabled}
                  onFocus={openOnFocus ? () => { setOpen(true); inputRef.current?.select() } : undefined}
                  className={cn(
                    "w-full font-inter cursor-pointer",
                    endAction ? "pr-28" : "pr-9",
                    icon && "pl-9",
                    className
                  )}
                  onClick={() => {
                    if (disabled) return
                    setOpen(true)
                    inputRef.current?.select()
                  }}
                />
                {(collapsedAdornment || icon) && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-muted-foreground">
                    {collapsedAdornment || icon}
                  </span>
                )}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {endAction && (
                    <span
                      className="flex items-center"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {endAction}
                    </span>
                  )}
                  {clearable && !clearAfterSelect && value && !disabled && !isResolvingLabel && (
                    <button
                      type="button"
                      className="h-3.5 w-3.5 flex items-center justify-center rounded-full font-inter text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
                      onClick={handleClear}
                      aria-label={clearLabel}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden={true} />
                </span>
              </>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="p-1 w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] max-h-[min(300px,var(--radix-popover-content-available-height))] font-inter overflow-auto"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={openOnFocus ? event => event.preventDefault() : undefined}
          onMouseDown={keepInputFocus ? event => event.preventDefault() : undefined}
        >
          {pinnedAction && (
            <>
              <div
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm font-inter outline-none hover:bg-accent hover:text-accent-foreground transition-colors text-primary",
                  pinnedAction.selected && "bg-accent text-accent-foreground",
                )}
                onClick={() => {
                  if (disabled) return
                  pinnedAction.onSelect()
                  setSearchQuery("")
                  onSearchChange?.("")
                  setOpen(false)
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-2" />
                {pinnedAction.label}
              </div>
              <div className="h-px bg-border my-1" />
            </>
          )}
          {filteredOptions.length > 0 ? (
            <div className="pb-1" id={openOnFocus ? listId : undefined} role={openOnFocus ? "listbox" : undefined} aria-label={openOnFocus ? label : undefined}>
              {filteredOptions.map((option, index) => {
                const prevGroup = filteredOptions[index - 1]?.group
                const showGroupHeader =
                  Boolean(option.group) && option.group !== prevGroup
                const isSelected = value?.mode === "existing" && value.id === option.id
                return (
                  <React.Fragment key={option.id}>
                    {showGroupHeader && (
                      <>
                        {index > 0 && <div className="h-px bg-border my-1" />}
                        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                          {option.group}
                        </div>
                      </>
                    )}
                    <div
                      id={openOnFocus ? `${listId}-${index}` : undefined}
                      role={openOnFocus ? "option" : undefined}
                      aria-selected={openOnFocus ? isSelected : undefined}
                      data-relation-id={option.id}
                      aria-disabled={option.disabled || undefined}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm font-inter outline-none hover:bg-accent hover:text-accent-foreground transition-colors",
                        isSelected && "bg-accent text-accent-foreground",
                        openOnFocus && highlightedId === option.id && "bg-accent text-accent-foreground",
                        option.disabled && "cursor-not-allowed opacity-60"
                      )}
                      onClick={() => handleSelectExisting(option)}
                    >
                      <div className="min-w-0">
                        <div className="truncate">{option.label}</div>
                        {option.description && (
                          <div className="truncate text-xs text-muted-foreground">
                            {option.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          ) : showCreate && !pinnedAction ? null : (
            <div id={openOnFocus ? listId : undefined} className="py-6 text-center text-sm font-inter text-muted-foreground">{emptyMessage}</div>
          )}

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

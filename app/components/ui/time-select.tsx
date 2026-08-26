"use client"

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "@/lib/utils"
import { floatingLayerZClassName } from "@/app/components/ui/overlay-styles"
import { ChevronDown } from "./icons"

const MINUTE_STEP = 30

export function normalizeTimeValue(raw?: string | null): string {
  if (!raw) return ""
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return raw.trim()
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

export function parseTypedTime(raw?: string | null): string | null {
  if (!raw) return null
  let value = raw.trim().toLowerCase().replace(/\s+/g, "")
  if (!value) return null

  let period: "am" | "pm" | null = null
  if (/(a\.?m\.?)$/.test(value)) {
    period = "am"
    value = value.replace(/a\.?m\.?$/, "")
  } else if (/(p\.?m\.?)$/.test(value)) {
    period = "pm"
    value = value.replace(/p\.?m\.?$/, "")
  } else if (/[0-9]a$/.test(value)) {
    period = "am"
    value = value.slice(0, -1)
  } else if (/[0-9]p$/.test(value)) {
    period = "pm"
    value = value.slice(0, -1)
  }

  value = value.replace(/[.:]/g, "")
  if (!/^\d{1,4}$/.test(value)) return null

  let hours: number
  let minutes: number
  if (value.length <= 2) {
    hours = Number(value)
    minutes = 0
  } else if (value.length === 3) {
    hours = Number(value.slice(0, 1))
    minutes = Number(value.slice(1))
  } else {
    hours = Number(value.slice(0, 2))
    minutes = Number(value.slice(2))
  }

  if (period === "am") {
    if (hours === 12) hours = 0
    else if (hours > 12) return null
  } else if (period === "pm") {
    if (hours === 12) hours = 12
    else if (hours > 12) return null
    else hours += 12
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

export function buildTimeOptions(
  extraValues: Array<string | undefined | null> = [],
  step = MINUTE_STEP
) {
  const options: { value: string; label: string }[] = []
  const seen = new Set<string>()
  const minuteStep = step > 0 && step <= 60 ? step : MINUTE_STEP

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += minuteStep) {
      const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
      seen.add(time)
      options.push({ value: time, label: time })
    }
  }

  let inserted = false
  for (const raw of extraValues) {
    const value = normalizeTimeValue(raw)
    if (value && !seen.has(value)) {
      seen.add(value)
      options.push({ value, label: value })
      inserted = true
    }
  }

  if (inserted) {
    options.sort((a, b) => a.value.localeCompare(b.value))
  }

  return options
}

export function filterTimeOptions(
  options: { value: string; label: string }[],
  query: string
) {
  const trimmed = query.trim()
  if (!trimmed) return options

  const parsed = parseTypedTime(trimmed)
  const compact = trimmed.toLowerCase().replace(/[^0-9]/g, "")
  const matches = options.filter((option) => {
    if (parsed) return option.value.startsWith(`${parsed.slice(0, 2)}:`)
    const optionCompact = option.value.replace(":", "")
    return optionCompact.startsWith(compact) || option.label.toLowerCase().startsWith(trimmed.toLowerCase())
  })

  if (parsed && !matches.some((option) => option.value === parsed)) {
    return [...matches, { value: parsed, label: parsed }].sort((a, b) => a.value.localeCompare(b.value))
  }

  return matches
}

export const TIME_OPTIONS = buildTimeOptions()

interface TimeSelectProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  step?: number
  modal?: boolean
}

export function TimeSelect({
  value,
  onValueChange,
  placeholder = "Select time",
  disabled,
  className,
  triggerClassName,
  step = MINUTE_STEP,
  modal = false,
}: TimeSelectProps) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const skipCloseCommitRef = useRef(false)
  const normalized = normalizeTimeValue(value)
  const options = useMemo(
    () => buildTimeOptions([normalized], step),
    [normalized, step]
  )
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(normalized)
  const [highlight, setHighlight] = useState(0)

  const filtered = useMemo(
    () => filterTimeOptions(options, open && draft !== normalized ? draft : ""),
    [options, open, draft, normalized]
  )

  useEffect(() => {
    if (!open) setDraft(normalized)
  }, [normalized, open])

  useEffect(() => {
    const parsed = parseTypedTime(draft)
    const index = filtered.findIndex((option) => option.value === (parsed || normalized))
    setHighlight(index >= 0 ? index : 0)
  }, [draft, filtered, normalized])

  useEffect(() => {
    if (!open) return
    selectedRef.current?.scrollIntoView({ block: "nearest" })
  }, [open, highlight, filtered])

  const commit = (next: string) => {
    skipCloseCommitRef.current = true
    onValueChange(next)
    setDraft(next)
    setOpen(false)
  }

  const commitDraftOrRevert = () => {
    if (!draft.trim()) {
      setDraft(normalized)
      return
    }
    const parsed = parseTypedTime(draft)
    if (parsed) {
      onValueChange(parsed)
      setDraft(parsed)
      return
    }
    const highlighted = filtered[highlight]
    if (highlighted) {
      onValueChange(highlighted.value)
      setDraft(highlighted.value)
      return
    }
    setDraft(normalized)
  }

  const handleOpenChange = (next: boolean) => {
    if (next) {
      skipCloseCommitRef.current = false
      setDraft(normalized)
      setOpen(true)
      return
    }
    if (open && !skipCloseCommitRef.current) commitDraftOrRevert()
    skipCloseCommitRef.current = false
    setOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (!open) setOpen(true)
      else setHighlight((current) => Math.min(current + 1, filtered.length - 1))
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      if (!open) setOpen(true)
      else setHighlight((current) => Math.max(current - 1, 0))
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      event.stopPropagation()
      const parsed = parseTypedTime(draft)
      commit(parsed || filtered[highlight]?.value || normalized)
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      skipCloseCommitRef.current = true
      setDraft(normalized)
      setOpen(false)
    }
  }

  return (
    <div className={cn("min-w-0 flex-1", className)} data-time-select>
      <PopoverPrimitive.Root modal={modal} open={open} onOpenChange={handleOpenChange}>
        <PopoverPrimitive.Anchor asChild>
          <div className="relative w-full">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              placeholder={placeholder}
              value={open ? draft : normalized}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              onFocus={(event) => {
                setDraft(normalized)
                setOpen(true)
                requestAnimationFrame(() => event.target.select())
              }}
              onChange={(event) => {
                setDraft(event.target.value)
                if (!open) setOpen(true)
              }}
              onKeyDown={handleKeyDown}
              className={cn(
                "block h-11 w-full rounded-md border border-input bg-background py-2 pl-2.5 pr-8 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50",
                open && "bg-primary/5 ring-1 ring-inset ring-primary/30",
                triggerClassName
              )}
            />
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
          </div>
        </PopoverPrimitive.Anchor>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            data-time-select
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              const target = event.target as HTMLElement | null
              // If click is inside the input, don't close (let the input handle it)
              if (target === inputRef.current) {
                event.preventDefault()
              }
            }}
            onFocusOutside={(event) => {
              // Prevent closing when parent Dialog's FocusScope tries to steal focus back
              // due to a re-render from SWR or other state changes.
              event.preventDefault()
            }}
            className={cn(
              floatingLayerZClassName,
              "max-h-[240px] min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            )}
            style={{ width: inputRef.current?.offsetWidth }}
          >
            <div id={listId} role="listbox" className="max-h-[232px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-2.5 py-6 text-center text-sm text-muted-foreground">
                  No matching time
                </div>
              ) : (
                filtered.map((time, index) => {
                  const isSelected = time.value === normalized
                  const isHighlighted = index === highlight
                  return (
                    <button
                      key={time.value}
                      ref={isHighlighted ? selectedRef : undefined}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlight(index)}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        commit(time.value)
                      }}
                      className={cn(
                        "flex w-full cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-left text-sm outline-none",
                        isSelected && "bg-primary/5 text-primary",
                        isHighlighted && !isSelected && "bg-accent text-accent-foreground",
                        isHighlighted && isSelected && "bg-primary/10"
                      )}
                    >
                      {time.label}
                    </button>
                  )
                })
              )}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  )
}

interface TimeRangeSelectProps {
  start?: string
  end?: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  toLabel?: string
  startPlaceholder?: string
  endPlaceholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  step?: number
}

export function TimeRangeSelect({
  start,
  end,
  onStartChange,
  onEndChange,
  toLabel = "to",
  startPlaceholder = "Start time",
  endPlaceholder = "End time",
  disabled,
  className,
  triggerClassName,
  step,
}: TimeRangeSelectProps) {
  return (
    <div className={cn("flex items-center gap-2 flex-1", className)}>
      <TimeSelect
        value={start}
        onValueChange={onStartChange}
        placeholder={startPlaceholder}
        disabled={disabled}
        triggerClassName={triggerClassName}
        step={step}
      />
      <span className="text-muted-foreground shrink-0">{toLabel}</span>
      <TimeSelect
        value={end}
        onValueChange={onEndChange}
        placeholder={endPlaceholder}
        disabled={disabled}
        triggerClassName={triggerClassName}
        step={step}
      />
    </div>
  )
}

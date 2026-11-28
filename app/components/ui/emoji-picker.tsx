"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Button } from "./button"
import { ScrollArea } from "./scroll-area"
import { cn } from "@/lib/utils"
import { Input } from "./input"
import { Search } from "./icons"
import { loadEmojiCatalog, searchEmojiCatalog, type IndexedEmoji } from "./emoji-search"

const PAGE_SIZE = 120
const DEFAULT_GROUP = "Objects"

interface EmojiPickerProps {
  value?: string
  onChange: (emoji: string) => void
  disabled?: boolean
  className?: string
  defaultEmoji?: string
}

export function EmojiPicker({
  value,
  onChange,
  disabled = false,
  className,
  defaultEmoji = "📁"
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [catalog, setCatalog] = React.useState<IndexedEmoji[]>([])
  const [failed, setFailed] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [group, setGroup] = React.useState(DEFAULT_GROUP)
  const [limit, setLimit] = React.useState(PAGE_SIZE)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const groups = React.useMemo(() => [...new Set(catalog.map(entry => entry.group))], [catalog])
  const matches = React.useMemo(() => query.trim() ? searchEmojiCatalog(catalog, query)
    : catalog.filter(entry => entry.group === group), [catalog, group, query])

  function fetchCatalog() {
    setFailed(false)
    void loadEmojiCatalog().then(setCatalog, () => setFailed(true))
  }

  function changeOpen(open: boolean) {
    setIsOpen(open)
    if (open) {
      setQuery("")
      setGroup(DEFAULT_GROUP)
      setLimit(PAGE_SIZE)
      if (!catalog.length) fetchCatalog()
    }
  }

  const handleSelect = (emoji: string) => {
    onChange(emoji)
    setIsOpen(false)
  }

  const currentEmoji = value && !/[A-Za-z_]/.test(value) ? value : defaultEmoji

  return (
    <Popover open={isOpen} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn("h-8 w-8 text-base shrink-0", className)}
          title="Choose category icon"
          aria-label="Choose category icon"
        >
          {currentEmoji}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 max-w-[calc(100vw-2rem)] space-y-2 p-2.5 z-[1000050]"
        align="start"
        sideOffset={8}
        portal={false}
        onOpenAutoFocus={event => { event.preventDefault(); searchRef.current?.focus() }}
      >
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input ref={searchRef} aria-label="Search emojis" placeholder="Search emojis…" value={query}
            className="h-8 pl-7 text-xs" onChange={event => { setQuery(event.target.value); setLimit(PAGE_SIZE) }}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) event.preventDefault()
            }} />
        </div>
        {!query.trim() && groups.length > 0 && <select aria-label="Emoji category" value={group}
          className="h-7 w-full rounded-md border bg-background px-2 text-xs"
          onChange={event => { setGroup(event.target.value); setLimit(PAGE_SIZE) }}>
          {groups.map(name => <option key={name}>{name}</option>)}
        </select>}
        {failed ? <Button type="button" variant="ghost" size="sm" onClick={fetchCatalog}>Retry loading emojis</Button>
          : !catalog.length ? <p role="status" className="p-2 text-xs text-muted-foreground">Loading emojis…</p>
          : matches.length === 0 ? <p role="status" className="p-2 text-xs text-muted-foreground">No emojis found.</p>
          : <ScrollArea key={`${group}:${query}`} className="h-60 w-full pr-2">
            <div className="grid grid-cols-7 gap-1">
              {matches.slice(0, limit).map(({ emoji, name, spanish }) => (
                <button key={emoji} type="button" onClick={() => handleSelect(emoji)} aria-label={name}
                  aria-pressed={emoji === value} title={spanish ? `${name} · ${spanish}` : name}
                  className="flex h-8 min-w-0 items-center justify-center rounded-md text-lg hover:bg-accent aria-pressed:bg-accent">
                  {emoji}
                </button>
              ))}
            </div>
            {matches.length > limit && <Button type="button" variant="ghost" size="sm" className="mt-2 w-full"
              onClick={() => setLimit(current => current + PAGE_SIZE)}>Show more ({matches.length - limit})</Button>}
        </ScrollArea>
        }
      </PopoverContent>
    </Popover>
  )
}

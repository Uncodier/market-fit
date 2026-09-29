import { useCallback, useEffect, useRef, useState } from "react"
import { Input } from "@/app/components/ui/input"
import { X } from "@/app/components/ui/icons"
import type { LookupOption } from "./finder-api"

export function LookupChipsInput({
  values,
  onChange,
  placeholder = "Search",
  fetcher
}: {
  values: LookupOption[]
  onChange: (next: LookupOption[]) => void
  placeholder?: string
  fetcher: (query: string) => Promise<LookupOption[]>
}) {
  const [text, setText] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<LookupOption[]>([])
  const listRef = useRef<HTMLDivElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generation = useRef(0)
  const fetcherRef = useRef(fetcher)

  // The page supplies inline fetchers; a render must not restart the debounce.
  useEffect(() => { fetcherRef.current = fetcher }, [fetcher])

  const cancel = useCallback(() => {
    generation.current += 1
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => cancel, [cancel])

  // Selection, chip removal and parent filter clears invalidate pending lookups.
  useEffect(() => {
    cancel()
    setText("")
    setOpen(false)
    setLoading(false)
    setSuggestions([])
  }, [values, cancel])

  const doSearch = useCallback((value: string) => {
    // Invalidate immediately, not when the next debounce fires.
    cancel()
    setLoading(false)
    setSuggestions([])
    const query = value.trim()
    if (!query) return
    const requestGeneration = generation.current
    timer.current = setTimeout(async () => {
      timer.current = null
      setLoading(true)
      try {
        const results = await fetcherRef.current(query)
        if (requestGeneration === generation.current) setSuggestions(results)
      } catch {
        if (requestGeneration === generation.current) setSuggestions([])
      } finally {
        if (requestGeneration === generation.current) setLoading(false)
      }
    }, 250)
  }, [cancel])

  const add = (v: string | LookupOption) => {
    const val = typeof v === 'string' ? v.trim() : v.text
    if (!val) return
    const option: LookupOption = typeof v === 'string' ? { id: null, text: val } : v
    const seen = new Set(values.map(x => x.text))
    const next = seen.has(option.text) ? values : [...values, option]
    cancel()
    setLoading(false)
    setSuggestions([])
    setText("")
    setOpen(false)
    onChange(next)
  }

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = 0
  }, [open, suggestions])

  const existingTexts = new Set(values.map(v => v.text))
  const visibleSuggestions = suggestions.filter(s => !existingTexts.has(s.text))

  return (
    <div className="relative space-y-2">
      <Input
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          setOpen(Boolean(v.trim()))
          doSearch(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(text)
          }
        }}
        className="h-10"
      />
      {open && visibleSuggestions.length > 0 && (
        <div ref={listRef} className="absolute z-20 top-[44px] left-0 right-0 border bg-background rounded-md shadow-sm max-h-56 overflow-y-auto overflow-x-hidden divide-y max-w-full !flex !flex-col items-start">
          {visibleSuggestions.map(s => (
            <button
              key={`${s.id ?? s.text}`}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted leading-snug"
              onClick={() => add(s)}
              title={s.text}
            >
              <span className="block truncate">{s.text}</span>
            </button>
          ))}
        </div>
      )}
      {values.length > 0 && (
        <div className="flex flex-row flex-wrap gap-2 items-center justify-start">
          {values.map((v) => (
            <span key={`${v.id ?? v.text}`} className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-2 py-1">
              {v.text}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x.text !== v.text))}
                className="hover:text-destructive"
                aria-label={`Remove ${v.text}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {loading && <p className="text-xs text-muted-foreground">Searching…</p>}
    </div>
  )
}
import { useCallback, useRef, useState, useSyncExternalStore } from "react"
import { readSiteSelectionLabel, SITE_SELECTION_CACHE_KEY } from "@/app/context/site-selection-cache"
import { isDemoModeActive } from "@/lib/demo-utils"
import { cn } from "@/lib/utils"
import { Button } from "../ui/button"
import { AlertCircle, Folder, RotateCcw } from "../ui/icons"
import { Skeleton } from '../ui/skeleton'

const noServerHint = () => null

// SiteContext clears the cache on denial, sign-out and authoritative removal. Read
// it again on render rather than retaining a label past one of those transitions.
function useSavedProjectName(actorId: string | null, currentSiteId?: string) {
  const read = useCallback(() => actorId && !isDemoModeActive()
    ? readSiteSelectionLabel(actorId, currentSiteId) : null, [actorId, currentSiteId])
  const subscribe = useCallback((notify: () => void) => {
    if (!actorId) return () => {}
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      clearTimeout(timer)
      const hint = read()
      if (hint) timer = setTimeout(update, Math.max(0, hint.expiresAt - Date.now()))
      notify()
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === SITE_SELECTION_CACHE_KEY || event.key === "currentSiteId") update()
    }
    update()
    window.addEventListener("storage", onStorage)
    return () => { clearTimeout(timer); window.removeEventListener("storage", onStorage) }
  }, [actorId, read])
  return useSyncExternalStore(subscribe, () => read()?.name ?? null, noServerHint)
}

interface PlaceholderProps {
  actorId: string | null
  currentSiteId?: string
  collapsed: boolean
  loading: boolean
  failed: boolean
  retry: () => Promise<void>
}

/** A label, never a Site: no project switch, logo fetch, settings, or create action. */
export function SiteSelectorPlaceholder({ actorId, currentSiteId, collapsed, loading, failed, retry }: PlaceholderProps) {
  const name = useSavedProjectName(loading || failed ? actorId : null, currentSiteId)
  const pending = useRef(false)
  const [retrying, setRetrying] = useState(false)
  const status = failed ? "Couldn't load project" : "No project selected"
  const Icon = failed ? AlertCircle : Folder

  async function onRetry() {
    if (!actorId || !failed || loading || pending.current) return
    pending.current = true
    setRetrying(true)
    try { await retry() }
    catch { /* SiteContext owns load errors. A failed read remains retryable. */ }
    finally { pending.current = false; setRetrying(false) }
  }

  if (loading || retrying) return <div role="status" aria-label={name ?? 'Loading project'} aria-busy="true"
    className={cn('mx-auto flex items-center gap-2 px-3 py-2 motion-reduce:[&_.animate-pulse]:animate-none', !collapsed && 'w-[232px]')}>
    <Skeleton aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full" />
    {!collapsed && <Skeleton aria-hidden="true" className="h-4 w-32" />}
  </div>

  return (
    <div className={cn("mx-auto flex items-center gap-2 px-3 py-2", collapsed ? "flex-col" : "w-[232px]")}>
      <div role="status" title={collapsed ? [name, status].filter(Boolean).join(" — ") : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <Icon aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground motion-reduce:animate-none" />
        <span className={cn("min-w-0", collapsed && "sr-only")}>
          {name && <span className="block truncate font-medium">{name}</span>}
          <span className="block text-xs text-muted-foreground">{status}</span>
        </span>
      </div>
      {actorId && failed && !loading && (
        <Button type="button" variant="outline" size={collapsed ? "icon" : "sm"} aria-label="Retry loading project"
          title="Retry loading project" onClick={onRetry} disabled={retrying}>
          {collapsed ? <RotateCcw aria-hidden className="h-4 w-4" /> : "Retry"}
        </Button>
      )}
    </div>
  )
}
/** Byte-bounded LRU of complete card rasters. Positions/selection never enter keys. */
export const IMPRENTA_SPRITE_BYTES = 32 * 1024 * 1024

export interface CardSprite {
  key: string
  group: string
  nodeId: string
  bucket: number
  canvas: HTMLCanvasElement
  bytes: number
  urls: readonly string[]
  /** Padding relative to the unpadded raster footprint. */
  padX: number
  padY: number
}

export function createImprentaSpriteCache(maxBytes = IMPRENTA_SPRITE_BYTES) {
  const entries = new Map<string, CardSprite>()
  const groups = new Map<string, Set<string>>()
  const media = new Map<string, Set<string>>()
  const revisions = new Map<string, number>()
  let revision = 0
  let bytes = 0
  let evictions = 0
  let protectedNodes = new Set<string>()

  const remove = (key: string) => {
    const entry = entries.get(key)
    if (!entry) return
    entries.delete(key)
    bytes -= entry.bytes
    const group = groups.get(entry.group)
    group?.delete(key)
    if (!group?.size) groups.delete(entry.group)
    for (const url of entry.urls) {
      const keys = media.get(url)
      keys?.delete(key)
      if (!keys?.size) media.delete(url)
    }
    // Release the backing store immediately, not when GC eventually runs.
    entry.canvas.width = 0
    entry.canvas.height = 0
  }
  const touch = (entry: CardSprite) => {
    entries.delete(entry.key)
    entries.set(entry.key, entry)
    return entry
  }

  return {
    protect(nodeIds: Set<string>) { protectedNodes = nodeIds },
    mediaRevision(urls: readonly string[]) {
      return urls.map((url) => revisions.get(url) ?? 0).join(",")
    },
    get(key: string) {
      const entry = entries.get(key)
      return entry ? touch(entry) : null
    },
    closest(group: string, bucket: number) {
      let best: CardSprite | null = null
      let distance = Infinity
      for (const key of groups.get(group) ?? []) {
        const entry = entries.get(key)!
        const delta = Math.abs(Math.log(entry.bucket / bucket))
        if (delta < distance) { best = entry; distance = delta }
      }
      return best ? touch(best) : null
    },
    put(entry: CardSprite) {
      if (!Number.isFinite(entry.bytes) || entry.bytes <= 0 || entry.bytes > maxBytes) {
        entry.canvas.width = entry.canvas.height = 0
        return false
      }
      remove(entry.key)
      // Changed content/theme/media supersedes all previous versions of this card.
      for (const [key, old] of entries) {
        if (old.nodeId === entry.nodeId && old.group !== entry.group) remove(key)
      }
      for (const [key, old] of entries) {
        if (bytes + entry.bytes <= maxBytes && entries.size < 2048) break
        if (protectedNodes.has(old.nodeId) && old.nodeId !== entry.nodeId) continue
        remove(key)
        evictions++
      }
      if (bytes + entry.bytes > maxBytes || entries.size >= 2048) {
        entry.canvas.width = entry.canvas.height = 0
        return false
      }
      entries.set(entry.key, entry)
      bytes += entry.bytes
      if (!groups.has(entry.group)) groups.set(entry.group, new Set())
      groups.get(entry.group)!.add(entry.key)
      for (const url of entry.urls) {
        if (!media.has(url)) media.set(url, new Set())
        media.get(url)!.add(entry.key)
      }
      return true
    },
    invalidateMedia(url: string) {
      for (const key of [...(media.get(url) ?? [])]) remove(key)
      revisions.delete(url)
      revisions.set(url, ++revision)
      // Revision metadata is bounded too; no stale raster survives a reset.
      if (revisions.size > 4096) {
        const oldest = revisions.keys().next().value!
        for (const key of [...(media.get(oldest) ?? [])]) remove(key)
        revisions.delete(oldest)
      }
    },
    retainNodes(ids: Set<string>) {
      for (const [key, entry] of entries) if (!ids.has(entry.nodeId)) remove(key)
    },
    clear() {
      for (const key of entries.keys()) remove(key)
      revisions.clear()
      protectedNodes = new Set()
    },
    stats: () => ({ bytes, entries: entries.size, evictions, maxBytes }),
  }
}

export type ImprentaSpriteCache = ReturnType<typeof createImprentaSpriteCache>